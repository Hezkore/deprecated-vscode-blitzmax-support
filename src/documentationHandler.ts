import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { AnalyzeDoc, BmxModule } from './bmxModules'
import { BlitzMax } from './blitzmax'
import { capitalize, generateCommandText } from './common'

let webPanel: vscode.WebviewPanel | undefined
let documentationContext: vscode.ExtensionContext
let cssStyle: string
let headerStyle: string
let footerStyle: string = `
</style>
</head>`

export function registerDocumentationContext( context: vscode.ExtensionContext ) {
	documentationContext = context
}

export async function showModuleDocumentation( name: string, command: string ){
	
	if (BlitzMax.warnNotReady()) return
	
	if (!name) return
	name = name.toLowerCase()
	if (command) command = command.toLowerCase()
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		vscode.commands.executeCommand( 'blitzmax.helpExplorerSelect', name, command )
		
		// Find the actual module
		const module: BmxModule | undefined = BlitzMax.getModule( name )
		if (!module) {
			vscode.window.showErrorMessage( name + ' is not a known module' )
			return resolve()
		}
		
		// Show or create the web panel
		if (webPanel) webPanel.reveal( vscode.ViewColumn.One )
		else {
			// Create web panel
			webPanel = vscode.window.createWebviewPanel(
				'bmxHelp',
				'BlitzMax Help - ' + module.name,
				vscode.ViewColumn.One,
				{
					retainContextWhenHidden: true,
					enableScripts: true,
					enableCommandUris: true,
					enableFindWidget: true,
					localResourceRoots: [vscode.Uri.parse( path.join( documentationContext.extensionPath, 'media' ) )]
				}
			)
			
			// Handle messages from the webview
			webPanel.webview.onDidReceiveMessage( message => {
				console.log('YE?=!')
				switch (message.command) {
						case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
					}
				},
				undefined,
				documentationContext.subscriptions
			)
			
			webPanel.onDidDispose( () => {
					webPanel = undefined
				},
				undefined,
				documentationContext.subscriptions
			)
		}
		
		webPanel.webview.html = getWebviewContent( module, command )
		
		return resolve()
	})
}

function getWebviewContent( module: BmxModule, command: string ): string {
	
	if (!module.cacheDocumentation) {
		
		// Read the CSS styling
		if (!cssStyle) cssStyle = fs.readFileSync( path.join(
			documentationContext.extensionPath,
			'media',
			'style.css'
		) ).toString()
		
		if (!headerStyle) {
			headerStyle = `<!DOCTYPE html>
			<html lang="en">
			<head>
			<meta charset="utf-8" />
			<meta http-equiv="Content-Security-Policy" content="img-src ${webPanel?.webview.cspSource} http:;">
			<style type="text/css">
			`
		}
		
		let html: string = headerStyle
		html += cssStyle
		html += footerStyle
		
		html += `
		<body class="page-margins">
			
			<div id="sidebar" class="sidebar">
				${generateSidebar( module )}
			</div>
			
			<div id="main" class="main">
				${generateMain( module )}
			</div>
			
			<script>
				function jumpTo(id){
					var elmnt = document.getElementById(id);
					elmnt.scrollIntoView();
					var oldColor = elmnt.style.backgroundColor;
					setTimeout(function() {
						elmnt.style.backgroundColor = oldColor;
					  }, 1000);
					elmnt.style.backgroundColor = 'green';
				}
				
				window.onload = function() {
					jumpTo("${command}");
				};
			</script>
		</body>`
		
		module.cacheDocumentation = html + `</html>`
	}
	
	return module.cacheDocumentation
}

function generateSidebar( module: BmxModule ): string {
	
	return `
	<div style="height: 90px; display: block">
		<table>
			<td>
				<img src="${webPanel?.webview.asWebviewUri(vscode.Uri.file(path.join(documentationContext.extensionPath, 'media')))}/icon.svg" height="76" width="76" alt="BlitzMax Logo" title="BlitzMax Logo" style="padding-right: 10px">
			</td>
			<td>
			<div style="font-size: 20px; font-weight: 400; line-height: 24px">BlitzMax ${BlitzMax.version}<br>${module.name}</div>
			</td>
		</table>
	</div>
	
    <hr>
    <div style="height: 30px; display: block"></div>

	<div style="padding-right: 10px; color: var(--vscode-foreground);">
		${generateSidebarLinks( module )}
    </div>`
}

function generateSidebarLinks( module: BmxModule ): string {
	
	if (!module || !module.commands) return ''
	
	let links: string = ''
	
	module.commands.sort().forEach( cmd => {
		links += `<span>
		<a onclick="jumpTo('${cmd.searchName}');" title="Jump to ${cmd.regards.name}">
		${cmd.regards.name}
		</a></span><br>`
	})
	
	return links
}

function generateMain( module: BmxModule ): string {
	
	if (!module || !module.commands) return ''
	
	let main: string = generateMainTitle()
	
	module.commands.forEach( cmd => {
		main += generateSection( cmd )
	})
	
	return main
}

function generateMainTitle(): string {
	return `
    <div style=" height: 90px; display: inline-block;">
      <div class="main-title" data-loc-id="intellisense.configurations">IntelliSense Configurations</div>
      <div style="color: var(--vscode-foreground);">
        <span data-loc-id="intellisense.configurations.description">Use this editor to edit IntelliSense settings defined in the underlying <a href="command:C_Cpp.ConfigurationEditJSON" title="Edit configurations in JSON file" data-loc-id-title="edit.configurations.in.json">c_cpp_properties.json</a> file. Changes made in this editor only apply to the selected configuration. To edit multiple configurations at once go to <a href="command:C_Cpp.ConfigurationEditJSON" title="Edit configurations in JSON file" data-loc-id-title="edit.configurations.in.json">c_cpp_properties.json</a>.</span>
      </div>
    </div>`
}

function generateSection( cmd: AnalyzeDoc ): string {
	return `
	<div class="section">
	<div id="${cmd.searchName}" class="section-title">${cmd.regards.name}</div>
	<div class="section-text">${cmd.info}</div>
	<div>
	  <div class="section-note">${cmd.aboutStripped}</div>
	</div>
  </div>`
}
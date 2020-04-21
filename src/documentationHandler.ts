import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { AnalyzeDoc, BmxModule } from './bmxModules'
import { BlitzMax } from './blitzmax'
import { capitalize, generateCommandText, readFile, exists } from './common'
import { resolve } from 'dns'

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
		
		webPanel.webview.html = await getWebviewContent( module, command )
		
		return resolve()
	})
}

async function getWebviewContent( module: BmxModule, command: string ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		const endingScript = `
				window.onload = function() {
					jumpTo("${command}");
				};
				</script>
			</body>
		</html>`
		
		if (!module.cacheDocumentation) {
			await vscode.window.withProgress( {
				location: vscode.ProgressLocation.Notification,
				title:  'Generating documentation',
				cancellable: false
			}, (progress, token) => { return new Promise<boolean>( async ( resolve, reject ) => {
				
				progress.report( {message: module.name, increment: 25} )
				
				// Read the CSS styling
				if (!cssStyle) {
					
					const cssPath = path.join(
						documentationContext.extensionPath,
						'media',
						'style.css'
					)
					
					cssStyle = await readFile( cssPath )
				}
				
				progress.report( {increment: 25} )
				
				if (!headerStyle) {
					headerStyle = `<!DOCTYPE html>
					<html lang="en">
					<head>
					<meta charset="utf-8" />
					<meta http-equiv="Content-Security-Policy" content="img-src ${webPanel?.webview.cspSource} http:;">
					<style type="text/css">
					`
				}
				
				progress.report( {increment: 25} )
				
				let html: string = headerStyle
				html += cssStyle
				html += footerStyle
				
				html += `
				<body class="page-margins">
					
					<div id="sidebar" class="sidebar">
						${await generateSidebar( module )}
					</div>
					
					<div id="main" class="main">
						${await generateMain( module )}
					</div>
					
					<script>
						function jumpTo(id){
							var elmnt = document.getElementById(id);
							elmnt.scrollIntoView();
							/*
							var oldColor = elmnt.style.backgroundColor;
							setTimeout(function() {
								elmnt.style.backgroundColor = oldColor;
							}, 1000);
							elmnt.style.backgroundColor = 'green';
							*/
						}
				`
				
				progress.report( {increment: 25} )
				
				module.cacheDocumentation = html
				return resolve()
			})})
		}
		
		return resolve( module.cacheDocumentation + endingScript )
	})
}

async function generateSidebar( module: BmxModule ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		return resolve( `
		<div style="height: 90px; display: block">
			<table>
				<td>
					<img src="${webPanel?.webview.asWebviewUri(vscode.Uri.file(path.join(documentationContext.extensionPath, 'media')))}/icon.svg" height="76" width="76" alt="BlitzMax Logo" title="BlitzMax Logo" style="padding-right: 10px">
				</td>
				<td>
				<div style="font-size: 20px; font-weight: 400; line-height: 24px">BlitzMax ${BlitzMax.version}</div>
				<div style="font-size: 16px; font-weight: 300; line-height: 24px">Version ${BlitzMax.releaseVersion.split( ' ' )}</div>
				</td>
			</table>
		</div>
		
		<hr>
		<div style="height: 30px; display: block"></div>

		<div style="padding-right: 10px; color: var(--vscode-foreground);">
			${await generateSidebarLinks( module )}
		</div>` )
	})
}

async function generateSidebarLinks( module: BmxModule ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		if (!module || !module.commands) return resolve( '' )
		
		let links: string = ''
		let previousItemSearchName: string = ''
		let previousItemType: string = ''
		
		module.commands.sort().forEach( cmd => {
			
			if (cmd.regards.name != module.name) {
				
				if (cmd.regards.type && cmd.regards.type != previousItemType) {
					previousItemType = cmd.regards.type
					links += `<br><span style="font-weight: 700">${capitalize( cmd.regards.type )}s</span><br>`
				}
				
				if (cmd.searchName != previousItemSearchName) {
					previousItemSearchName = cmd.searchName
					links += `<span>
					<a class="headerBtn" onclick="jumpTo('${cmd.searchName}');" title="Jump to ${cmd.regards.name}">
					${cmd.regards.name}
					</a></span><br>`
				}
			}
		})
		
		return resolve( links )
	})
}

async function generateMain( module: BmxModule ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		if (!module || !module.commands) return resolve( '' )
		
		let main: string = await generateMainTitle( module )
		let previousSearchName: string | undefined = undefined
		let similarCmds: AnalyzeDoc[] = []
		
		for (let i = 0; i < module.commands.length; i++) {
			const cmd = module.commands[i]
			const isLast = i >= module.commands.length - 1
			
			// Skip the module itself
			if (cmd.regards.name == module.name) continue
			
			if (!previousSearchName)
				previousSearchName = cmd.searchName
			
			// If this a similar command we bunch them together
			if (previousSearchName == cmd.searchName) {
				similarCmds.push( cmd )
			}
			
			// If this command is not the same!
			if (previousSearchName != cmd.searchName) {
				previousSearchName = cmd.searchName
				main += await generateSection( module, similarCmds )
				similarCmds = []
				similarCmds.push( cmd )
			}
			
			if (isLast) {
				main += await generateSection( module, similarCmds )
			}
		}
		
		return resolve( main )
	})
}

async function generateMainTitle( module: BmxModule ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		const bbintroPath: string = path.join( BlitzMax.modPath, module.parent, module.folderName, 'doc', 'intro.bbdoc' )
		let bbintro: string = 'No information'
		
		if (await exists( bbintroPath ))
			bbintro = await readFile( bbintroPath )
		
		return resolve(`
		<div style="height: 90px; display: inline-block;">
		<div class="main-title">${module.name}</div>
		<div style="color: var(--vscode-foreground);">
			<span>${bbintro}</span>
		</div>
		</div>`)
	})
}

async function generateSection( module: BmxModule, cmds: AnalyzeDoc[] ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		const hasExample = await BlitzMax.hasExample( cmds[0] )
		let example: string = ''
		if (hasExample) {
			example = await BlitzMax.getExample( cmds[0] )
			if (example)
				example = `<br><span>
					<a href="${generateCommandText( 'blitzmax.findHelp', ['print'] )}" title="Open example">
						Example
					</a>
				</span>
				<div class="section-example">
					<pre><code>${example}</code></pre>
				</div>`
		}
		
		const title = `
		<div class="section">
		<div id="${cmds[0].searchName}" class="section-name">${cmds[0].regards.name}</div>
		<div style="height: 12px; display: block"></div>
		<div class="section-text">${cmds[0].info}</div>
		<dl>`
		
		let aboutInfo: string = ''
		if (cmds[0].aboutStripped && cmds[0].aboutStripped.length > 0) {
			aboutInfo = `<div class="section-note">
				${cmds[0].aboutStripped}
			</div>`
		}
		
		let detail: string = ''
		
		cmds.forEach( cmd => {
			detail += `<div class="section-title"><li><a href="${generateCommandText( 'blitzmax.openModule', [module.name, cmd.regards.line] )}" title="Go to ${module.name} line ${cmd.regards.line}">${cmd.regards.prettyData}</a></li></div>`
		})
		
		return resolve( title + detail +
		`</dl>
				${aboutInfo}
				${example}
		</div>`)
	})
}
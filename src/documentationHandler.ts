import * as vscode from 'vscode'
import * as path from 'path'
import { AnalyzeDoc, BmxModule, AnalyzeItem } from './bmxModules'
import { BlitzMax } from './blitzmax'
import { capitalize, generateCommandText, readFile, exists } from './common'
import { formatBBDocText, FormatSettings } from './bbdocFormat'

let webPanel: vscode.WebviewPanel | undefined
let documentationContext: vscode.ExtensionContext
let cssStyle: string
let headerStyle: string
let footerStyle: string = `
</style>
</head>`
let bbdocFormatSettings: FormatSettings = {
	referenceText: `<a onclick="jumpTo('{{word}}');" title="Jump to {{word}}">{{word}}</a>`,
	highlightText: '<strong>{{word}}</strong>',
	externalText: 'EXT[{{word}}]'
}

export function registerDocumentationContext( context: vscode.ExtensionContext ) {
	documentationContext = context
}

export async function showModuleDocumentation( moduleName: string, command: string ){
	
	if (BlitzMax.warnNotReady()) return
	
	if (!moduleName) return
	moduleName = moduleName.toLowerCase()
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		vscode.commands.executeCommand( 'blitzmax.helpExplorerSelect', moduleName, command )
		
		// Find the actual module
		const module: BmxModule | undefined = BlitzMax.getModule( moduleName )
		if (!module) {
			vscode.window.showErrorMessage( moduleName + ' is not a known module' )
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
				console.log('Got message from webpanel')
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
	
	if (!module.commands || module.commands.length <= 0) return ''
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		const endingScript = `
				window.onload = function() {
					jumpTo('${command}');
					setTimeout(function(){ jumpTo('${command}'); }, 50);
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
							if (elmnt) elmnt.scrollIntoView(true);
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
	
	if (!module.commands || module.commands.length <= 0) return ''
	
	return new Promise<string>( async ( resolve, reject ) => {
		return resolve( `
		<div class="sidebar-content">
			<div>
				<table>
				<!--
					<td>
						<img src="${webPanel?.webview.asWebviewUri(vscode.Uri.file(path.join(documentationContext.extensionPath, 'media')))}/icon.png" height="76" width="76" alt="BlitzMax Logo" title="BlitzMax Logo">
					</td>
				-->
					<td>
					<div class="sidebar-module">${module.name}</div>
					<div class="sidebar-bmx">BlitzMax ${BlitzMax.version}</div>
					</td>
				</table>
			</div>
			
			<hr>
			
			<div>
				${await generateSidebarLinks( module )}
			</div>
		</div>`)
	})
}

async function generateSidebarLinks( module: BmxModule ): Promise<string> {
	
	if (!module.commands || module.commands.length <= 0) return ''
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		if (!module || !module.commands) return resolve( '' )
		
		let links: string = '<div>'
		let previousItemSearchName: string = ''
		let previousItemInside: string | undefined
		let previousItemType: string | undefined
		
		module.commands.forEach( cmd => {
			
			if (cmd.regards.name != module.name) {
				
				if (cmd.regards.type != previousItemType) {
					links += `<div class="sidebar-category">${capitalize( cmd.regards.type )}s</div>`
				}
				
				if (cmd.searchName != previousItemSearchName ||
				cmd.regards.inside?.name != previousItemInside ||
				cmd.regards.type != previousItemType) {
					links += `<div class="sidebar-item">
					<a onclick="jumpTo('${cmd.depthName}');" title="Jump to ${cmd.depthName}">
					${cmd.depthName}
					</a></div>`
				}
				
				previousItemSearchName = cmd.searchName
				previousItemInside = cmd.regards.inside?.name
				previousItemType = cmd.regards.type
			}
		})
		
		links += '</div>'
		
		return resolve( links )
	})
}

async function generateMain( module: BmxModule ): Promise<string> {
	
	if (!module.commands || module.commands.length <= 0) return ''
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		if (!module || !module.commands) return resolve( '' )
		
		let main: string = `<div class="main-content">` + await generateMainTitle( module )
		let previousSearchName: string | undefined = undefined
		let previousType: string | undefined = undefined
		let previousInside: string | undefined = undefined
		let similarCmds: AnalyzeDoc[] = []
		
		for (let i = 0; i < module.commands.length; i++) {
			const cmd = module.commands[i]
			const isLast = i >= module.commands.length - 1
			let isSame: boolean = false
			
			// Skip the module itself
			if (cmd.regards.name == module.name) {
				if (isLast)
					main += await generateSection( module, similarCmds )
				continue
			}
			
			if (!previousSearchName) {
				isSame = true
			} else {
				isSame = previousSearchName == cmd.searchName
				if (isSame) isSame = previousType == cmd.regards.type
				if (isSame) isSame = previousInside == cmd.regards.inside?.name
			}
			
			// If this a similar command we bunch them together
			if (!isSame) {
				//console.log( 'Generated' )
				main += await generateSection( module, similarCmds )
				similarCmds = []
			}
			
			//console.log( 'Pushed ' + cmd.searchName )
			similarCmds.push( cmd )
			
			if (isLast) {
				//console.log( 'Generated by last' )
				main += await generateSection( module, similarCmds )
			}
			
			previousSearchName = cmd.searchName
			previousInside = cmd.regards.inside?.name
			previousType = cmd.regards.type
		}
		
		return resolve( main + "</div>" )
	})
}

async function generateMainTitle( module: BmxModule ): Promise<string> {
	
	return new Promise<string>( async ( resolve, reject ) => {
		const bbintroPath: string = path.join( BlitzMax.modPath, module.parent, module.folderName, 'doc', 'intro.bbdoc' )
		let bbintro: string = 'No information'
		
		if (await exists( bbintroPath ))
			bbintro = await readFile( bbintroPath )
		
		return resolve(`
		<a href="${generateCommandText( 'blitzmax.openModule', [module.name] )}" class="main-title">${module.name}</a>
		<div class="main-info">${formatBBDocText(bbintro, bbdocFormatSettings)}</div>`)
	})
}

async function generateSection( module: BmxModule, cmds: AnalyzeDoc[] ): Promise<string> {
	
	if (!cmds || cmds.length <= 0) return ''
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		let example: string | undefined
		if (await BlitzMax.hasExample( cmds[0] )) {
			example = await BlitzMax.getExample( cmds[0] )
			if (example)
				example = `
					<div class="section-example">
						<a href="${generateCommandText( 'blitzmax.showExample', [cmds[0]] )}" title="Open example">
							Example
						</a>
					</div>
				<code>
					<div>
					<pre>${example}</pre>
					</div>
				</code>`
		}
		const title = `
		<div class="section">
		<div id="${cmds[0].depthName}" class="section-name">${capitalize(cmds[0].regards.type)} ${cmds[0].depthName}</div>
		<div class="section-description">${formatBBDocText(cmds[0].info, bbdocFormatSettings)}</div>`
		
		let aboutInfo: string | undefined
		if (cmds[0].about && cmds[0].about.length > 0) {
			aboutInfo = `<div class="section-information">
				${formatBBDocText(cmds[0].about, bbdocFormatSettings)}
			</div>`
		}
		
		let alts: string = '<div class="section-alts">'
		
		cmds.forEach( cmd => {
			alts += `<a href="
				${generateCommandText( 'blitzmax.openModule', [module.name, cmd.regards.line] )}"
				title="Go to ${module.name} line ${cmd.regards.line}">
				${cmd.regards.prettyData}</a><br>`
		})
		
		alts += '</div>'
		
		let result = title + alts
		if (aboutInfo) result += aboutInfo
		if (example) result += example
		
		return resolve( result + '</div>' )
	})
}
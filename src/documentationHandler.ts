import * as vscode from 'vscode'
import * as path from 'path'
import { AnalyzeDoc, BmxModule } from './bmxModules'
import { BlitzMax } from './blitzmax'
import { capitalize, generateCommandText, readFile, exists } from './common'
import { formatBBDocText, FormatType, FormatResult } from './bbdocFormat'

let webPanel: vscode.WebviewPanel | undefined
let documentationContext: vscode.ExtensionContext
let cssStyle: string
let headerStyle: string
let footerStyle: string = `
</style>
</head>`
let currentModule: BmxModule | undefined

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
		currentModule = BlitzMax.getModule( moduleName )
		if (!currentModule) {
			vscode.window.showErrorMessage( moduleName + ' is not a known module' )
			return resolve()
		}
		
		// Show or create the web panel
		if (webPanel) {
			webPanel.title = 'BlitzMax Help - ' + currentModule.name
			webPanel.reveal( vscode.ViewColumn.One )
		} else {
			// Create web panel
			webPanel = vscode.window.createWebviewPanel(
				'bmxHelp',
				'BlitzMax Help - ' + currentModule.name,
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
		
		webPanel.webview.html = await getWebviewContent( currentModule, command )
		
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
					
					<button onclick="topFunction()" id="scrollToTop" title="Go to top">Top</button>
					
					<div id="sidebar" class="sidebar">
						${await generateSidebar( module )}
					</div>
					
					<div id="main" class="main">
						${await generateMain( module )}
					</div>
					
					<script>
						var coll = document.getElementsByClassName("section-name");
						var i;
						
						for (i = 0; i < coll.length; i++) {
							coll[i].addEventListener("click", function() {
								this.classList.toggle("active");
								var content = this.nextElementSibling;
								if (content.style.maxHeight){
								content.style.maxHeight = null;
								} else {
								content.style.maxHeight = content.scrollHeight + "px";
								}
							});
						}
						
						function jumpTo(id){
							var elmnt = document.getElementById(id);
							if (elmnt) elmnt.scrollIntoView(true);
						}
						
						//Get the button
						var topButton = document.getElementById("scrollToTop");
						
						// When the user scrolls down 20px from the top of the document, show the button
						window.onscroll = function() {scrollFunction()};
						
						function scrollFunction() {
						if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
							topButton.style.display = "block";
						} else {
							topButton.style.display = "none";
						}
						}
						
						// When the user clicks on the button, scroll to the top of the document
						function topFunction() {
							document.body.scrollTop = 0;
							document.documentElement.scrollTop = 0;
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
					<a href="${generateCommandText( 'blitzmax.openModule', [module.name] )}" class="sidebar-module">${module.name}</a>
					<div class="sidebar-bmx">BlitzMax ${BlitzMax.version}</div>
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
		
		if (await exists( bbintroPath )) {
			bbintro = await readFile( bbintroPath )
		}
		
		return resolve(`
		<a href="${generateCommandText( 'blitzmax.openModule', [module.name] )}" class="main-title">${module.name}</a>
		<div class="main-info"><pre>${formatBBDocText(bbintro, formatForDocs)}</pre></div>`)
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
					<div class="example-link">
						<a href="${generateCommandText( 'blitzmax.showExample', [cmds[0]] )}" title="Open example">
							${cmds[0].regards.name} Example
						</a>
					</div>
				<code><div class="example"><pre>${example}</pre></div></code>`
		}
		
		let section = '<div class="section">'
		
		let alts: string = '<div>'
		
		for (let i = 0; i < cmds.length; i++) {
			const cmd = cmds[i]
			
			// First we add a button for the command itself
			alts += `<button id="${cmds[0].depthName}" type="button" class="section-name">${cmd.regards.prettyData}</button>`
			
			// Add its content
			if (!i)
				alts += '<div style="max-height:100%;" class="content">'
			else
				alts += '<div class="content">'
			
			if (cmd.info)
				alts += `<div class="section-information">
					<pre><strong>Information: </strong>${formatBBDocText(cmd.info, formatForDocs)}</pre>
				</div>`
			
			if (cmd.about)
				alts += `<div class="section-about">
					<pre><strong>About: </strong>${formatBBDocText(cmd.about, formatForDocs)}</pre>
				</div>`
			
			if (cmd.returns)
				alts += `<div class="section-returns">
					<pre><strong>Returns: </strong>${formatBBDocText(cmd.returns, formatForDocs)}</pre>
				</div>`
			
			alts += `<div class="section-source">
				<pre><strong>Source: </strong>${cmd.regards.file}:${cmd.regards.line}</pre>
			</div>`
			
			alts += '</div>' // Close content
		}
		
		alts += '</div>'
		
		let result = section + alts
		if (example) result += example
		result += '</div>' // Close section
		
		return resolve( result )
	})
}

export function formatForDocs( result: FormatResult ): string {
	
	switch (result.Type) {
		case FormatType.Reference:
			// Is this just straight up a module?
			const mod = BlitzMax.getModule( result.Words[0] )
			if (mod)
				return `<a class="section-link" href="${generateCommandText( 'blitzmax.moduleHelp', [mod.name] )}" title="Read about ${mod.name}">${result.Words[0]}</a>`
			
			if (currentModule && currentModule.commands) {
				
				// First we attempt to get a matching command from this module
				for (let i = 0; i < currentModule.commands.length; i++) {
					const cmd = currentModule.commands[i]
					if (cmd.depthName == result.Words[0])
						return `<a class="section-link" onclick="jumpTo('${cmd.depthName}');" title="Jump to ${cmd.depthName}">${result.Words[0]}</a>`
				}
				
				// Attempt to get a matching command without the depth!
				for (let i = 0; i < currentModule.commands.length; i++) {
					const cmd = currentModule.commands[i]
					if (cmd.searchName == result.Words[0].toLowerCase())
						return `<a class="section-link" onclick="jumpTo('${cmd.depthName}');" title="Jump to ${cmd.depthName}">${result.Words[0]}</a>`
				}
			}
			
			// Otherwise we do a global search
			return `<a class="section-link" href="${generateCommandText( 'blitzmax.findHelp', [result.Words[0]] )}" title="Find ${result.Words[0]}">${result.Words[0]}</a>`
			
		case FormatType.Highlight:
			return `<strong>${result.Words[0]}</strong>`
			
		case FormatType.Header1:
			return `<strong style="font-size:140%">${result.Words[0]}</strong>`
			
		case FormatType.Header2:
			return `<strong style="font-size:115%">${result.Words[0]}</strong>`
			
		case FormatType.Header3:
			return `<strong style="font-size:100%">${result.Words[0]}</strong>`
			
		case FormatType.Header4:
			return `<strong style="font-size:85%">${result.Words[0]}</strong>`
			
		case FormatType.Header5:
			return `<strong style="font-size:60%">${result.Words[0]}</strong>`
			
		case FormatType.Header6:
			return `<strong style="font-size:40%">${result.Words[0]}</strong>`
			
		case FormatType.Italic:
			return `<i>${result.Words[0]}</i>`
			
		case FormatType.CodeMultiLine:
			return `<code><div class="example"><pre>${result.Words[0]}</pre></div></code>`
		
		case FormatType.Code:
			return `<code>${result.Words[0]}</code>`
		
		case FormatType.Html:
			return `<a class="section-link" href="${result.HtmlData}">${result.HtmlTag}</a>`
		
		case FormatType.Table:
			if (!result.Table) return 'No Table Data!'
			
			let text: string = '<div class="section-information"><table>\n'
			
			for (let y = 0; y < result.Table.height; y++) {
				text += '<tr>\n'
				for (let x = 0; x < result.Table.width; x++) {
					text += '<td>' + result.Table.items[x][y] + '</td>'
				}
				text += '</tr>\n'
			}
			
			text += '</table></div>\n'
			return text
	}
	
	return result.Words[0]
}
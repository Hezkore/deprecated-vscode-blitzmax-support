import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { AnalyzeDoc, BmxModule } from './bmxModules'
import { BlitzMax } from './blitzmax'
import { capitalize } from './common'

let webPanel: vscode.WebviewPanel | undefined
let documentationContext: vscode.ExtensionContext
let cssStyle: string
let headerStyle: string = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy">
<style type="text/css">
`
let footerStyle: string = `
</style>
</head>`

export function registerDocumentationContext( context: vscode.ExtensionContext ) {
	documentationContext = context
}

export async function showModuleDocumentation( name: string, command: string ){
	
	if (!name) return
	name = name.toLowerCase()
	if (command) command = command.toLowerCase()
	
	return new Promise<string>( async ( resolve, reject ) => {
		
		console.log( 'Show documentation for module ' + name + ' and jump to command ' + command )
		
		vscode.commands.executeCommand( 'blitzmax.helpExplorerSelect', name, command )
		
		// Find the actual module
		const module: BmxModule | undefined = BlitzMax.getModule( name )
		if (!module) {
			vscode.window.showErrorMessage( name + ' is not a known module' )
			return resolve()
		}
		
		// Read the CSS styling
		if (!cssStyle) cssStyle = fs.readFileSync( path.join(
			documentationContext.extensionPath,
			'media',
			'style.css'
		) ).toString()
		
		// Show or create the web panel
		if (webPanel) webPanel.reveal( vscode.ViewColumn.One )
		else {
			// Create web panel
			webPanel = vscode.window.createWebviewPanel(
				'bmxHelp',
				'BlitzMax Help - ' + module.name,
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					enableCommandUris: true,
					enableFindWidget: true,
					localResourceRoots: [vscode.Uri.file(path.join( documentationContext.extensionPath, 'media' ))]
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
		
		// Is BlitzMax even ready?!
		/*
		if (!BlitzMax.ready){
			vscode.window.showErrorMessage( 'BlitzMax not ready!' )
			return reject()
		}
		
		let example: string | undefined
		if (await BlitzMax.hasExample( cmd )) example = await BlitzMax.getExample( cmd )
		webPanel.webview.html = getWebviewContent( cmd, example )
		*/
		
		/*
		let doc: vscode.TextDocument
		
		if (showAbout){
			let text: string = 'rem ' + cmd.regards.name
			text += '\n\ninfo: ' + cmd.info
			if (cmd.aboutStripped ) text += '\n\nabout: ' + cmd.aboutStripped
			text += '\nendrem\n'
			
			if (await BlitzMax.hasExample( cmd )){
				text += '\n\' example:\n'
				text += await BlitzMax.getExample( cmd )
			}
			
			doc = await vscode.workspace.openTextDocument( { content: text, language: 'blitzmax' } )
		}else{
			const uri = vscode.Uri.parse( 'file:' + await BlitzMax.hasExample( cmd ) )
			doc = await vscode.workspace.openTextDocument( uri )
		}
		
		await vscode.window.showTextDocument( doc, { preview: true, viewColumn: vscode.ViewColumn.Active } )
		*/
		return resolve()
	})
}

function getWebviewContent( cmd: AnalyzeDoc, example: string | undefined ) {
	let html: string = headerStyle
	html += cssStyle
	html += footerStyle
	
	// Generate a pretty title
	let cmdTitle: string = cmd.regards.prettyData ? cmd.regards.prettyData : 'Undefined'
	
	//let cmdLocation: string = capitalize( cmd.regards.type ) + //' from ' + cmd.module + " : " + cmd.line
	let cmdLocation: string = `<span data-loc-id="end"> from <a href="command:blitzmax.findHelp" data="test" title="${cmd.module}" data-loc-id-title="end">${cmd.module}</a></span><br>`
	
	html += `
	<body class="page-margins">
		<!-- main -->
		<div id="main" class="main">
			
			<!-- title -->
			<div style=" height: 90px; display: inline-block;">
				<div class="main-title"><code>${cmdTitle}</code></div>
				<div style="color: var(--vscode-foreground);">
					<span>${cmdLocation}</span>
				</div>
			</div>
			
			<hr>
			<div style="height: 30px; display: block"></div>
			
			<!-- sections -->
			<div class="section">
				<div class="section-title" id="example">Example</div>
				<div class="section-text" data-loc-id="configuration.name.description">
					<pre><code>${example}</code></pre>
				</div>
			</div>
			<!-- sections end -->
		</div> <!-- main end -->	
		
		<script>
			const vscode = acquireVsCodeApi();
			window.onload = function() {
				vscode.postMessage({
					command: 'alert',
					text: '🐛  on line '
				})
				console.log('Ready to accept data.');
			};
		</script>
	</body>`
	
	return html + `</html>`
}
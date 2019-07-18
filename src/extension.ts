'use strict'

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { setWorkspaceSourceFile, currentWord, currentBmx, bmxBuild, exists } from './common'
import { BmxFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxDefinitionProvider } from './definitionProvider'
import { BmxTaskProvider } from './taskProvider'
import { BmxCompletionProvider } from './completionProvider'
import { BmxSignatureHelpProvider } from './signatureHelpProvider'
import { BmxHoverProvider } from './hoverProvider'
import { BlitzMax } from './blitzmax'

async function startup( context:vscode.ExtensionContext ) {	
	
	console.log( 'Start' )
	
	await BlitzMax.setup( context )
	
	// Make BlitzMax reload if path is changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration( event => {
			
			if ( event.affectsConfiguration( 'blitzmax.bmxPath' ) ){
				
				BlitzMax.setup( context )
			}
		})
	)
	
	// Completion item provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxCompletionProvider()
		)
	)
	
	// Signature help provider
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxSignatureHelpProvider()
			,{triggerCharacters: ['('],
			retriggerCharacters: [',']}
		)
	)
	
	// Definition provider
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxDefinitionProvider()
		)
	)
	
	// Text Document Content Providers
	context.subscriptions.push( vscode.workspace.registerTextDocumentContentProvider( 'bmx-external',
		new class implements vscode.TextDocumentContentProvider {		
			provideTextDocumentContent( uri: vscode.Uri ): string {
				
				return fs.readFileSync( uri.fsPath, 'utf8' ).toString()
			}
		}
	))
	
	// Hover provider
	context.subscriptions.push(
		vscode.languages.registerHoverProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxHoverProvider()
		)
	)
	
	// Format provider
	/*context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('blitzmax', new BmxFormatProvider )
	)*/
	
	// Help document content provider
	/*
	context.subscriptions.push( vscode.workspace.registerTextDocumentContentProvider( 'bmx-help',
		new class implements vscode.TextDocumentContentProvider {		
			provideTextDocumentContent( uri: vscode.Uri ): string {
				
				let word: string =  uri.path.slice(
					uri.path.split( '-' )[0].length + 2).toLowerCase()
				let item:HelpObject | undefined = helpStack.get( word )
				
				if (item){ return item.docsExample }
				
				return 'No help for "' + word + '"'
			}
		}
	))*/
	
	// Action provider
	/*context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider( 'blitzmax', new BmxActionProvider(), {
			providedCodeActionKinds: BmxActionProvider.providedCodeActionKinds
		})
	)*/
	
	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider( 'bmx', new BmxTaskProvider)
	)
	
	// Commands
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.findHelp', async ( word: string ) => {
			
			if (!BlitzMax.ready) return
			
			if (!word) word = currentWord()
			if (!word) return
			word = word.toLowerCase()
			
			let cmds = BlitzMax.getCommand( word )
			if (!cmds || cmds.length <= 0) return
			
			// Find a command
			for(var i=0; i<cmds.length; i++){
				
				const cmd = cmds[i]
				if (!cmd || !cmd.info) continue
				
				let examplePath = path.join( BlitzMax.path,
					path.dirname( cmd.regards.file ),
					'doc',
					cmd.searchName + '.bmx'
				)
				if (!exists( examplePath )){
					examplePath = path.join( BlitzMax.path,
						path.dirname( cmd.regards.file ),
						'examples',
						cmd.searchName + '.bmx'
					)
				}
				
				let uri = vscode.Uri.parse( 'bmx-external:' + examplePath )
				let doc = await vscode.workspace.openTextDocument( uri )
				vscode.window.showTextDocument( doc, { preview: true } )
				
				return
			}
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildConsole', () => {
			
			bmxBuild( 'makeapp', 'console' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildGui', () => {
			
			bmxBuild( 'makeapp', 'gui' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildMods', () => {
			
			bmxBuild( 'makemods' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildLib', () => {
			
			bmxBuild( 'makelib' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFile', () => {
			
			setWorkspaceSourceFile( currentBmx() )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFileMenu', context => {
			
			setWorkspaceSourceFile( context.fsPath )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.quickBuild', () => {
			
			bmxBuild( 'makeapp', 'console', true, true )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.build', () => {
			
			vscode.commands.executeCommand( 'workbench.action.tasks.build' )
		})
	)
	
}

export function activate( context: vscode.ExtensionContext ): void {
	
	startup( context )
}

export function deactivate(): void {
}
'use strict'

import * as vscode from 'vscode'
import { setWorkspaceSourceFile, currentWord, currentBmx, bmxBuild, readFile } from './common'
import { BmxFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxDefinitionProvider } from './definitionProvider'
import { BmxTaskProvider } from './taskProvider'
import { BmxCompletionProvider } from './completionProvider'
import { BmxSignatureHelpProvider } from './signatureHelpProvider'
import { BmxHoverProvider } from './hoverProvider'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc, scanModules } from './bmxModules';


async function registerProviders( context:vscode.ExtensionContext ) {	
	
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
	
	// Text document content providers
	/*
	context.subscriptions.push( vscode.workspace.registerTextDocumentContentProvider( 'bmx-external',
		new class implements vscode.TextDocumentContentProvider {		
			provideTextDocumentContent( uri: vscode.Uri ): string {
				
				return fs.readFileSync( uri.fsPath, 'utf8' ).toString()
			}
		}
	))*/
	
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
}

async function registerCommands( context:vscode.ExtensionContext ) {
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.findHelp', async ( word: string ) => {
			
			let showAbout: boolean = true
			// Okay this is a dirty hack, just sue me already!
			// Or send a tip on how to pass a second param
			// to a registered VSCode command
			if (word && word.endsWith( '&false' )){
				
				word = word.slice( 0, -6 )
				showAbout = false
			}
			
			let cmds: AnalyzeDoc[]
			if (word){
				cmds = BlitzMax.getCommand( word )
			}else{
				cmds = BlitzMax.getCommand( currentWord() )
			}
			
			// Find a command
			for(var i=0; i<cmds.length; i++){
				
				const cmd = cmds[i]
				
				await BlitzMax.showExample( cmd, showAbout )
				return
			}
			
			return
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.generateDocs', () => {
			
			scanModules( context, true )
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
	
	console.log( 'Start' )
	
	BlitzMax.setup( context )
	
	registerCommands( context )
	registerProviders( context )
}

export function deactivate(): void {
}
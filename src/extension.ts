'use strict'

import * as vscode from 'vscode'
import { setWorkspaceSourceFile, currentWord, getWordAt, currentBmx, bmxBuild, startup } from './common'
import { BmxFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxTaskProvider } from './taskProvider'
import { BmxCompletionProvider } from './completionProvider'
import { showHelp, getHelp, cacheHelp, bmxBuildDocs, HelpObject, helpStack } from './helpProvider'

export function activate( context:vscode.ExtensionContext ): void {
	
	startup( context )
	
	// Format provider
	/*context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider('blitzmax', new BmxFormatProvider )
	)*/
	
	// Completion item provider
	cacheHelp()
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider('blitzmax', new BmxCompletionProvider )
	)
	
	// Hover provider
	context.subscriptions.push( vscode.languages.registerHoverProvider( 'blitzmax' , {
		async provideHover( doc:vscode.TextDocument, position:vscode.Position ) {
			
			const result = await getHelp( getWordAt( doc, position ) )
			if (!result){ return }
			
			return new vscode.Hover( result )
		}
	}))
	
	// Help document content provider
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
	))
	
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
		vscode.commands.registerCommand( 'blitzmax.findHelp', () => {
			
			if (!currentBmx()) { return }
			let word:string = currentWord()
			if (!word) { return }
			showHelp( word )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildDocs', () => {
			
			bmxBuildDocs()
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

export function deactivate(): void {
}
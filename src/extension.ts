'use strict'

import * as vscode from 'vscode'
import { setSourceFile, currentWord, currentBmx } from './common'
import { BmxFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxDefinitionProvider } from './definitionProvider'
import { currentDefinition, BmxTaskProvider, makeTask } from './taskProvider'
import { runSelectedText } from './runSelected'
import { moveSelectedText } from './moveSelected'
import { BmxCompletionProvider } from './completionProvider'
import { BmxSignatureHelpProvider } from './signatureHelpProvider'
import { BmxHoverProvider } from './hoverProvider'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc, scanModules } from './bmxModules'
import { quickAnalyze } from './quickAnalyze'

export function activate( context: vscode.ExtensionContext ) {
	
	BlitzMax.setup( context )
	
	registerCommands( context )
	registerProviders( context )
}

export function deactivate(): void {
}

async function registerProviders( context:vscode.ExtensionContext ) {	
	
	// Make BlitzMax reload if path is changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration( event => {
			
			if ( event.affectsConfiguration( 'blitzmax.bmxPath' ) )
				BlitzMax.setup( context )
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
	
	// Action provider
	/*context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider( 'blitzmax', new BmxActionProvider(), {
			providedCodeActionKinds: BmxActionProvider.providedCodeActionKinds
		})
	)*/
	
	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider( 'bmx', new BmxTaskProvider )
	)
}

async function registerCommands( context:vscode.ExtensionContext ) {
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.moveToOwnFile', async () => {
			
			moveSelectedText( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.runSelected', () => {
			
			if (BlitzMax.warnNotReady()) return
			
			runSelectedText( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.findHelp', async ( word: string ) => {
			
			if (BlitzMax.warnNotReady()) return
			
			let showAbout: boolean = true
			// Okay this is a dirty hack, just sue me already!
			// Or send a tip on how to pass a second param
			// to a registered VSCode command
			if (word && word.endsWith( '&false' )){
				
				word = word.slice( 0, -6 )
				showAbout = false
			}
			
			let cmds: AnalyzeDoc[]
			if (word)
				cmds = BlitzMax.getCommand( word )
			else
				cmds = BlitzMax.getCommand( currentWord() )
			
			// Find a command
			for(var i=0; i<cmds.length; i++){
				const cmd = cmds[i]
				
				await BlitzMax.showExample( cmd, showAbout )
				return
			}
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.generateDocs', () => {
			
			scanModules( context, true )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFile', context => {
			
			if (context)
				setSourceFile( context )
			else
				setSourceFile( currentBmx() )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.quickBuild', () => {
			
			if (BlitzMax.warnNotReady()) return
			
			const def = currentDefinition()
			if (!def)
			{
				vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultBuildTask' )
				return
			}
			
			// Make sure that quick builds are always debug and execute
			// Set to console as well so print commands aren't stripped
			def.execute = true
			def.debug = true
			def.app = 'console'
			
			const task = makeTask( def, 'Quick Build' )
			if (!task) return
			
			vscode.tasks.executeTask( task )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.build', () => {
			
			if (BlitzMax.warnNotReady()) return
			
			vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultBuildTask' )
		})
	)
}
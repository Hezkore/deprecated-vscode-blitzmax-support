'use strict'

import * as vscode from 'vscode'
import * as bmxDiagnostics from './diagnostics'
import { setSourceFile, currentWord, currentBmx, log } from './common'
import { BmxDocumentSymbolProvider } from './documentSymbolProvider'
import { BmxFormatProvider, BmxRangeFormatProvider, BmxOnTypeFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxDefinitionProvider } from './definitionProvider'
import { currentDefinition, BmxTaskProvider, makeTask, toggleBuildOptions } from './taskProvider'
import { runSelectedText } from './runSelected'
import { moveSelectedText } from './moveSelected'
import { BmxCompletionProvider } from './completionProvider'
import { BmxSignatureHelpProvider } from './signatureHelpProvider'
import { BmxHoverProvider } from './hoverProvider'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc, scanModules } from './bmxModules'
import { askToGenerateProject } from './generateProject'
import { checkBlitzMaxUpdates } from './checkUpdates'
import { BmxBuildTreeProvider } from './buildTree'
import { BmxSamplesExplorer } from './samplesTree'

export async function activate( context: vscode.ExtensionContext ) {
	
	registerEvents( context )
	registerCommands( context )
	registerProviders( context )
	
	await BlitzMax.setup( context )
	
	registerPostMisc( context )
	
	if (!BlitzMax.problem && vscode.workspace.getConfiguration( 'blitzmax' ).get( 'checkForUpdates' ))
		checkBlitzMaxUpdates( true )
}

export function deactivate(): void {
}

async function registerPostMisc( context:vscode.ExtensionContext ) {
	
	// Samples tree provider
	new BmxSamplesExplorer( context )
}

async function registerEvents( context:vscode.ExtensionContext ) {
	
	// Setup BlitzMax again if path changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration( event => {
			
			if (event.affectsConfiguration( 'blitzmax.bmxPath' )) {
				BlitzMax.setup( context )
				vscode.commands.executeCommand( 'blitzmax.refreshSamples' )
			}
		})
	)
	
	// Register diagnostics
	context.subscriptions.push( bmxDiagnostics.collection )
	bmxDiagnostics.register( context )
}

async function registerProviders( context: vscode.ExtensionContext ) {
	
	// Build option tree provider
	const bmxBuildTreeProvider = new BmxBuildTreeProvider( context )
	vscode.window.registerTreeDataProvider( 'blitzmax-build', bmxBuildTreeProvider)
	vscode.commands.registerCommand( 'blitzmax.refreshBuildOptions', () => bmxBuildTreeProvider.refresh() )
	
	// Document symbol provider
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'blitzmax' },
            new BmxDocumentSymbolProvider()
        )
	)
	
	// Completion item provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxCompletionProvider()
		)
	)
	
	// Signature help provider
	context.subscriptions.push(
		vscode.languages.registerSignatureHelpProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxSignatureHelpProvider()
			,{triggerCharacters: ['(', '[', ']', '.', ' ', '"', ','],
			retriggerCharacters: []}
		)
	)
	
	// Definition provider
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxDefinitionProvider()
		)
	)
	
	// Hover provider
	context.subscriptions.push(
		vscode.languages.registerHoverProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxHoverProvider()
		)
	)
	
	// Format providers
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxFormatProvider()
		)
	)
	context.subscriptions.push(
		vscode.languages.registerDocumentRangeFormattingEditProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxRangeFormatProvider()
		)
	)
	context.subscriptions.push(
		vscode.languages.registerOnTypeFormattingEditProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxOnTypeFormatProvider()
		, '(', ')', '[', ']', ':', ' ', '"', ',', '%', '#', '!', '$', '=')
	)
	
	// Action provider
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: 'blitzmax' },
			new BmxActionProvider(), {
				providedCodeActionKinds: BmxActionProvider.providedCodeActionKinds
			})
	)
	
	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('bmx', new BmxTaskProvider)
	)
}

async function registerCommands( context:vscode.ExtensionContext ) {
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.selectPath', () => {
			
			BlitzMax.showSelectBlitzMaxPath()
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.checkForUpdates', () => {
			
			checkBlitzMaxUpdates()
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.generateProject', () => {
			
			askToGenerateProject( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.moveToOwnFile', () => {
			
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
			
			log( '\nUpdating all modules', true, true )
			scanModules( context, true )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFile', context => {
			
			setSourceFile( context ? context : currentBmx() )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildAndRun', () => {
			
			if (BlitzMax.warnNotReadyToBuild()) return
			
			const def = currentDefinition()
			
			// Update definition so that it ALWAYS executes
			const defaultExecuteState = def.execute
			def.execute = true
			
			const task = makeTask( def, 'Build & Run' )
			def.execute = defaultExecuteState
			if (!task) {
				vscode.window.showErrorMessage( 'Error when running task. Try removing tasks.json.' )
				return
			}
			
			vscode.tasks.executeTask( task )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.build', () => {
			
			if (BlitzMax.warnNotReadyToBuild()) return
			
			const def = currentDefinition()
			
			// Update definition so that it NEVER executes
			const defaultExecuteState = def.execute
			def.execute = false
			
			const task = makeTask( def, 'Build' )
			def.execute = defaultExecuteState
			if (!task) {
				vscode.window.showErrorMessage( 'Error when running task. Try removing tasks.json.' )
				return
			}
			
			vscode.tasks.executeTask( task )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.toggleBuildOption', async ( option: string, save: boolean ) => {
			
			toggleBuildOptions( option, save )
		})
	)
}
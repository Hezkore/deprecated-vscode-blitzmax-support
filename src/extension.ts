'use strict'

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as bmxDiagnostics from './diagnostics'
import { setSourceFile, currentWord, currentBmx, log, currentWordTrigger } from './common'
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
import { AnalyzeDoc, scanModules, AnalyzeResult } from './bmxModules'
import { askToGenerateProject } from './generateProject'
import { checkBlitzMaxUpdates } from './checkUpdates'
import { BmxBuildTreeProvider } from './buildTree'
import { BmxHelpExplorer } from './helpTree'
import { MultiBmxExplorer, addNewMultiPath, switchMultiPath, removeMultiPath, renameMultiPath } from './multiBmxHandler'
import { showModuleDocumentation, registerDocumentationContext } from './documentationHandler'

export async function activate( context: vscode.ExtensionContext ) {
	
	registerDocumentationContext( context)
	registerEvents( context )
	registerCommands( context )
	registerProviders( context )
	
	await BlitzMax.setup( context )
	
	registerPostMisc( context )
	
	if (!BlitzMax.problem && vscode.workspace.getConfiguration( 'blitzmax' ).get( 'checkForUpdates' ))
		checkBlitzMaxUpdates( true )
	
	showModuleDocumentation( 'BrL.standardio', 'print' )
}

export function deactivate(): void {
}

async function registerPostMisc( context:vscode.ExtensionContext ) {
	
	// Help tree provider
	new BmxHelpExplorer( context )
	
	// Multi Bmx tree provider
	new MultiBmxExplorer( context )
}

async function registerEvents( context:vscode.ExtensionContext ) {
	
	// Setup BlitzMax again if path changed
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration( event => {
			
			if (event.affectsConfiguration( 'blitzmax.bmxPath' )) {
				BlitzMax.setup( context )
				vscode.commands.executeCommand( 'blitzmax.refreshHelp' )
				vscode.commands.executeCommand( 'blitzmax.refreshMultiBmx' )
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
			new BmxCompletionProvider(), '.'
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
		vscode.commands.registerCommand( 'blitzmax.showExample', async (cmd: AnalyzeDoc) => {
			
			vscode.window.showTextDocument(
				vscode.Uri.file( await BlitzMax.hasExample( cmd ) ),
				{ preview: true }
			)
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.openModule', (name: string, line: number) => {
			
			const mod = BlitzMax.getModule( name )
			let range: vscode.Range | undefined
			
			if (line) {
				range = new vscode.Range(
					new vscode.Position( line, 0 ),
					new vscode.Position( line, 0 )
				)
				
			}
			
			if (mod) {
				vscode.window.showTextDocument(
					vscode.Uri.file( path.join( BlitzMax.modPath, mod.file ) ),
					{ selection: range, preview: true }
				)
			}
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.renameMultiPath', (context) => {
			
			renameMultiPath( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.removeMultiPath', (context) => {
			
			removeMultiPath( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.switchMultiPath', (context) => {
			
			switchMultiPath( context )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.addNewMultiPath', () => {
			
			addNewMultiPath()
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setPath', ( path: string, isSwitch: string | undefined ) => {
			
			if (BlitzMax.busy) {
				vscode.window.showErrorMessage( 'Cannot change path when BlitzMax is busy' )
			}
			
			BlitzMax.useNotificationProgress = true
			if (isSwitch) BlitzMax.useCustomProgressName = isSwitch
			
			vscode.workspace.getConfiguration( 'blitzmax' ).update( 'bmxPath', path, true )
		})
	)
	
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
		vscode.commands.registerCommand( 'blitzmax.findHelp', async ( word: string, fromType: boolean = false, fromModule: string[] ) => {
			
			if (BlitzMax.warnNotReady()) return
			
			if (!word) {
				word = currentWord()
				fromType = currentWordTrigger() == '.' ? true : false
				fromModule = []
			}
			
			console.log( 'requesting  help for ' + word + ' fromtype ' + fromType + ' module ' + fromModule  )
			
			const cmd = BlitzMax.searchCommand( word, fromType, fromModule )
			if (cmd) {
				vscode.window.setStatusBarMessage( 'Showing help for ' + cmd.regards.name + ' from module ' + cmd.module, 1000 * 4 )
				await showModuleDocumentation( cmd.module, cmd.regards.name ? cmd.regards.name : cmd.searchName )
			} else
				vscode.window.setStatusBarMessage( 'No help found for ' + word, 1000 * 2 )
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
		vscode.commands.registerCommand( 'blitzmax.toggleBuildOption', async ( option: any, save: boolean ) => {
			
			if (typeof option === "string") {
				toggleBuildOptions( option, save )
			} else {
				const treeItem: vscode.TreeItem = option
				if (treeItem.label) toggleBuildOptions( treeItem.label.toLocaleLowerCase(), true )
			}
		})
	)
}
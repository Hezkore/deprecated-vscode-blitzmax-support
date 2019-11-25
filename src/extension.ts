'use strict'

import * as vscode from 'vscode'
import { setSourceFile, currentWord, currentBmx, writeFile, exists, createDir, removeDir } from './common'
import { BmxFormatProvider } from './formatProvider'
import { BmxActionProvider } from './actionProvider'
import { BmxDefinitionProvider } from './definitionProvider'
import { currentDefinition, BmxTaskProvider, makeTask, BmxTaskDefinition } from './taskProvider'
import { BmxCompletionProvider } from './completionProvider'
import { BmxSignatureHelpProvider } from './signatureHelpProvider'
import { BmxHoverProvider } from './hoverProvider'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc, scanModules } from './bmxModules'
import * as path from 'path'
import * as fs from 'fs'

export function activate( context: vscode.ExtensionContext ) {
	
	console.log( 'Start' )
	
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
		vscode.commands.registerCommand( 'blitzmax.runSelected', async () => {
			
			if (!BlitzMax.ready)
			{
				vscode.window.showErrorMessage( "BlitzMax is not ready" )
				return
			}
			
			var editor = vscode.window.activeTextEditor
			if (!editor)
			{
				vscode.window.showErrorMessage( "No text editor active" )
				return
			}
			var selection = editor.selection
			var selectedText = editor.document.getText(selection)
			if (selectedText.length <= 0)
			{
				vscode.window.showErrorMessage( "No text selected" )
				return
			}
			
			let template:string = "Strict"
			let templateItems:string[] | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'runSelectedTextTemplate' )
			if (templateItems)
			{
				if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'runSelectedTextSuperStrict' ))
					template = "SuperStrict"
				
				templateItems.forEach(s => {
					template += "\n" + s
				})
				template += "\n"
			}
			let code:string = template + selectedText
			
			let tmpPath: string | undefined = context.storagePath
			if (!tmpPath)
			{
				vscode.window.showErrorMessage( "Storage path does not exist" )
				return
			}
			
			tmpPath = path.join( tmpPath, "tmp" )
			
			if (await createDir( tmpPath ) == false)
			{
				vscode.window.showErrorMessage( "Unable to create temporary folder" )
				return
			}
			
			let tmpFilePath: string = path.join( tmpPath, Math.random().toString(36).replace('0.', '')  + ".bmx" )
			
			await writeFile( tmpFilePath, code )
			
			if (!await exists( tmpFilePath ) )
			{
				vscode.window.showErrorMessage( "Unable to create temporary code file" )
				return
			}
			
			const def: BmxTaskDefinition = { type: 'bmx', make: 'makeapp', app: 'console',
			arch: 'auto', platform: 'auto', threaded: true, source: `${tmpFilePath}`,
			debug: true, execute: true, quick: true, verbose: false }
			
			const task = makeTask( def, 'Build Selected Text' )
			if (!task)
			{
				vscode.window.showErrorMessage( "Unable to create temporary task" )
				return
			}
			
			vscode.tasks.onDidEndTask(( async (e) => {
				
				if (e.execution.task == task && tmpPath && !await removeDir(tmpPath))
					vscode.window.showErrorMessage( "Unable to clean temporary folder" )
			}))
			
			console.log("Running: " + code)
			await vscode.tasks.executeTask( task )
		})
	)
	
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
		vscode.commands.registerCommand( 'blitzmax.buildCustom', async ( def: string ) => {
			
			vscode.window.showInformationMessage( def )
			
			return
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
			
			vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultBuildTask' )
		})
	)
}
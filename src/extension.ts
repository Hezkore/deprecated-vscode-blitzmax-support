'use strict'

import * as vscode from 'vscode'
import * as path from 'path';

let bmkPath: string
let provider: vscode.Disposable | undefined
let channel: vscode.OutputChannel

export function activate(context: vscode.ExtensionContext): void {
	
	channel = vscode.window.createOutputChannel('BlitzMax')
	
	vscode.commands.registerCommand('blitzmax.buildConsole', () => {
		
		bmxBuild( "makeapp", "console" )
	})
	
	vscode.commands.registerCommand('blitzmax.buildGui', () => {
		
		bmxBuild( "makeapp", "gui" )
	})
	
	vscode.commands.registerCommand('blitzmax.buildMods', () => {
		
		bmxBuild( "makemods" )
	})
	
	vscode.commands.registerCommand('blitzmax.buildLib', () => {
		
		bmxBuild( "makelib" )
	})
	
	provider = vscode.tasks.registerTaskProvider( "bmx", new BmxProvider() )
}

class BmxProvider implements vscode.TaskProvider {
	
	provideTasks(token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		
		if (!checkBmxPath()){ return }
		
		let scope: vscode.TaskScope = vscode.TaskScope.Workspace
		
		let execConsole: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildConsole}' )
		let kindConsole: vscode.TaskDefinition = { type: 'bmx', build: 'console' }
		
		let execGui: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildGui}' )
		let kindGui: vscode.TaskDefinition = { type: 'bmx', build: 'gui' }
		
		let execMods: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildMods}' )
		let kindMods: vscode.TaskDefinition = { type: 'bmx', build: 'mods' }
		
		let execLib: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildLib}' )
		let kindLib: vscode.TaskDefinition = { type: 'bmx', build: 'lib' }
		
		return [
			new vscode.Task( kindConsole, scope, 'Console Application', 'BlitzMax', execConsole ),
			new vscode.Task( kindGui, scope, 'Gui Application', 'BlitzMax', execGui ),
			new vscode.Task( kindMods, scope, 'Module', 'BlitzMax', execMods ),
			new vscode.Task( kindLib, scope, 'Library', 'BlitzMax', execLib )
		]
	}
	
	resolveTask(task: vscode.Task, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		
		vscode.window.showInformationMessage( "A TASK WAS RESOLVED?! Please report this to Hezkore" )
		
		return undefined
	}
}

async function bmxBuild( make:string, type:string = '' ){
	
	// make* type (makeapp, makemods, makelib)
	let args:string = make
	args += type ? ' -t ' + type : ''
	
	// Warn about NG stuff
	args += vscode.workspace.getConfiguration('blitzmax').get('warn') ? ' -w' : ''
	
	// Build threaded
	args += vscode.workspace.getConfiguration('blitzmax').get('threaded') ? ' -h' : ''
	
	// Build output
	let output:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('buildOut')
	args += output ? ' -o ' + output : ''
	
	// Execute after build
	let execute:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('execute')
	args += execute ? ' -x' : ''
	
	// Debug or Release
	let debug:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('debug')
	args += debug ? ' -d' : ' -r'
	
	// Actual file to build
	let source:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('sourceFile')
	if (!source){
		
		let textEditor = vscode.window.activeTextEditor
		if (!textEditor) {
			
			vscode.window.showErrorMessage('No .bmx file open.')
			return	
		}
		
		let document = textEditor.document
		if (!document) {
			
			vscode.window.showErrorMessage('No .bmx file open.')
			return
		}
		
		let filename = path.basename(document.fileName)
		if (!filename.toLocaleLowerCase().endsWith(".bmx")) {
			
			vscode.window.showErrorMessage('No .bmx file open.')
			return
		}
		
		// Update source
		await vscode.workspace.getConfiguration('blitzmax').update( 'sourceFile', filename, undefined )
		source = vscode.workspace.getConfiguration('blitzmax').get('sourceFile')
		
		await channel.appendLine( source + ' has been set as the main source file' )
		await channel.show(true)
	}
	args += ' ' + source
	
	// Create a tmp task to execute
	let exec: vscode.ShellExecution = new vscode.ShellExecution( bmkPath + ' ' + args )
	let kind: vscode.TaskDefinition = { type: 'bmx' }
	let task: vscode.Task = new vscode.Task( kind, vscode.TaskScope.Workspace, 'BlitzMax', 'Internal BlitzMax', exec, '$blitzmax')
	
	// Setup the task to function a bit like MaxIDE
	task.presentationOptions.echo = false
	task.presentationOptions.reveal = vscode.TaskRevealKind.Always
	task.presentationOptions.focus = false
	task.presentationOptions.panel = vscode.TaskPanelKind.Shared
	task.presentationOptions.showReuseMessage = false
	task.presentationOptions.clear = true
	
	// Some cleanup
	task.definition = kind
	task.group = vscode.TaskGroup.Build
	
	// EXECUTE!
	vscode.tasks.executeTask( task )
}

function checkBmxPath(): boolean{
	
	// Fetch the BlitzMax path
	let bmxPath:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('bmxPath')
	if (bmxPath) {
		
		// Figure out the BMK (compiler) path
		bmkPath = path.join(bmxPath,'bin')
		bmkPath = path.join(bmkPath,'bmk')
		return true
	}
	
	// Notify that the path is not set and offer to set it
	/*
	const errorOption = await vscode.window.showErrorMessage("BlitzMax path not set in plugin configuration.", "Configure")
	
	if (errorOption) {
		
		vscode.commands.executeCommand("workbench.action.openSettings", "@ext:hezkore.blitzmax")
	}
	*/
	
	vscode.window.showErrorMessage("BlitzMax path not set in plugin configuration.")
	vscode.commands.executeCommand("workbench.action.openSettings", "@ext:hezkore.blitzmax")
	
	return false
}

export function deactivate(): void {

	if (provider) { provider.dispose() }
}
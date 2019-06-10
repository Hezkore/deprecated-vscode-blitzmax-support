'use strict'

import * as vscode from 'vscode'
import * as path from 'path'

let bmkPath: string
let bmxPath:string | undefined

export function activate(context: vscode.ExtensionContext): void {
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.buildConsole', () => {
			
			bmxBuild('makeapp', 'console')
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.buildGui', () => {
			
			bmxBuild('makeapp', 'gui')
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.buildMods', () => {
			
			bmxBuild('makemods')
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.buildLib', () => {
			
			bmxBuild('makelib')
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.setSourceFile', () => {
			
			setWorkspaceSourceFile( currentBmx() )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand('blitzmax.quickBuild', () => {
			
			bmxBuild('makeapp', 'console', true, '-quick')
		})
	)
	
	context.subscriptions.push(
		
		vscode.tasks.registerTaskProvider( "bmx", new BmxTaskProvider() )
	)
}

class BmxTaskProvider implements vscode.TaskProvider {
	
	provideTasks(token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		
		let scope: vscode.TaskScope = vscode.TaskScope.Workspace
		let name:string = 'BlitzMax'
		
		let execConsole: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildConsole}' )
		let kindConsole: BmxTaskDefinition = { type: 'bmx', make: 'console' }
		
		let execGui: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildGui}' )
		let kindGui: BmxTaskDefinition = { type: 'bmx', make: 'gui' }
		
		let execMods: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildMods}' )
		let kindMods: BmxTaskDefinition = { type: 'bmx', make: 'mods' }
		
		let execLib: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildLib}' )
		let kindLib: BmxTaskDefinition = { type: 'bmx', make: 'lib' }
		
		return [
			new vscode.Task( kindConsole, scope, 'Console Application', name, execConsole ),
			new vscode.Task( kindGui, scope, 'Gui Application', name, execGui ),
			new vscode.Task( kindMods, scope, 'Module', name, execMods ),
			new vscode.Task( kindLib, scope, 'Shared Library', name, execLib )
		]
	}
	
	resolveTask(task: vscode.Task, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		
		vscode.window.showInformationMessage( "A TASK WAS RESOLVED?! Please report this to Hezkore" )
		return undefined
	}
}

async function setWorkspaceSourceFile( file:string ){
	
	if (!file){ return }
	
	await vscode.workspace.getConfiguration('blitzmax').update( 'sourceFile', file, undefined )
	vscode.window.showInformationMessage( file + ' has been set as the workspace source file.' )
}

function currentBmx():string{
	
	let fileType:string = '.bmx'
	let noFileMsg:string = 'No ' + fileType + ' file open.'
	let notFileMsg:string = 'This is not a ' + fileType + ' file'
	
	let textEditor = vscode.window.activeTextEditor
	if (!textEditor) {
		
		vscode.window.showErrorMessage(noFileMsg)
		return ''
	}
	
	let document = textEditor.document
	if (!document) {
		
		vscode.window.showErrorMessage(noFileMsg)
		return ''
	}
	
	let filename = path.basename(document.fileName)
	if (!filename.toLocaleLowerCase().endsWith(fileType)) {
		
		vscode.window.showErrorMessage(notFileMsg)
		return ''
	}
	
	return filename
}

async function bmxBuild( make:string, type:string = '', forceDebug:boolean = false, extraArgs:string = '' ){
	
	// Make sure we know where the BMK compiler is
	await updateBmkPath( true )
	if (!bmkPath){ return }
	
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
	if (forceDebug){
		
		args += ' -d'
	}else{
		
		let debug:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('debug')
		args += debug ? ' -d' : ' -r'
	}
	
	// Any extra args
	args += extraArgs ? ' ' + extraArgs : ''
	
	// Actual file to build
	let source:string | undefined = vscode.workspace.getConfiguration('blitzmax').get('sourceFile')
	if (!source){ // No source file set, figure one out!
		
		// Is a source file even open?
		let filename:string = currentBmx()
		if (!filename){ return }		
		
		// Do we automatically set the workspace source file?
		if (vscode.workspace.getConfiguration('blitzmax').get('autoSetSourceFile')){
			
			// Yep, set the current file as the workspace source file
			await setWorkspaceSourceFile( filename )
			
			// Update our source
			source = vscode.workspace.getConfiguration('blitzmax').get('sourceFile')
		}else{
			
			// Nope, use current file for now
			source = filename
		}
	}
	args += ' ' + source
	
	// Create a tmp task to execute
	let exec: vscode.ShellExecution = new vscode.ShellExecution( bmkPath + ' ' + args )
	let kind: BmxTaskDefinition = { type: 'bmx' }
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

interface BmxTaskDefinition extends vscode.TaskDefinition {
	
	make?: string
}

async function updateBmkPath( askToSet:boolean ){
	
	// Fetch the BlitzMax path
	bmxPath = await vscode.workspace.getConfiguration('blitzmax').get('bmxPath')
	if (bmxPath) {
		
		// Figure out the BMK (compiler) path
		bmkPath = path.join( bmxPath, 'bin', 'bmk' )
		return
	}
	
	// Notify that the path is not set and offer to set it
	const opt = await vscode.window.showErrorMessage("BlitzMax path not set in extension configuration.", "Set Path")
	if (opt) {
		
		//vscode.commands.executeCommand("workbench.action.openSettings", "@ext:hezkore.blitzmax")
		
		const folderOpt: vscode.OpenDialogOptions = {
			canSelectMany: false,
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: 'Select'
		}
		
		vscode.window.showOpenDialog( folderOpt ).then(fileUri => {
			
			if (fileUri && fileUri[0]) {
				
				vscode.workspace.getConfiguration('blitzmax').update('bmxPath', fileUri[0].fsPath, true)
				vscode.window.showInformationMessage( "BlitzMax path set" )
			}
		})
	}
	
	return
}

export function deactivate(): void {
}
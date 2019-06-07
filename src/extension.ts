'use strict'

import * as vscode from 'vscode'

let bmkPath:string
let provider:vscode.Disposable | undefined
let channel:vscode.OutputChannel

export function activate( _context:vscode.ExtensionContext ):void {
	
	channel = vscode.window.createOutputChannel( 'BlitzMax' )
	
	// Debug - so we know it's active!
	//vscode.window.showInformationMessage( "Okay so what do I do now? :S" )
	
	// Get workspace root
	let workspaceRoot = vscode.workspace.rootPath
	if ( !workspaceRoot ) {
		
		//vscode.window.showErrorMessage( "No Workspace root was found" )
		return
	}
	
	// Fetch the BlitzMax path
	let bmxPath = vscode.workspace.getConfiguration().get( "blitzmax.path" )
	if ( !bmxPath ) {
		
		vscode.window.showErrorMessage( "BlitzMax path not set in plugin configuration." )
		vscode.commands.executeCommand( "workbench.action.openSettings", "@ext:hezkore.blitzmax" )
		// FIX - After setting a path; the tasks aren't produced
		// You'll need to "restart"
		// Is the script not triggered again?
		return
	}
	
	// Figure out the BMK (compiler) path
	bmkPath = bmxPath + "\\bin\\bmk"
	
	// Provide tasks!
    provider = vscode.tasks.registerTaskProvider( "bmx", {
		
    	provideTasks: () => {
			
			//channel.appendLine( "Creating tasks!" )
			//channel.show(true)
			
			const scope = vscode.TaskScope.Workspace
			
			const kind:BmxTaskDefinition = { type: 'bmx', "file": "main.bmx" }
			
			const exec = new vscode.ShellExecution( bmkPath + ` makeapp ${kind.file}` )
			
			return [
				new vscode.Task( kind, scope, 'Just testing tasks', 'bmx', exec, ['$blitzmax'] ),
			]
		},resolveTask(_task: vscode.Task):vscode.Task | undefined {
			
			return undefined
		}
	})
	
	return
}

class BmxTaskDefinition implements  vscode.TaskDefinition {
	type:string= 'bmx'
	gui?:string
	file?:string
}

export function deactivate():void {
	
	if ( provider ) { provider.dispose() }
}
'use strict'

import * as vscode from 'vscode'

export interface BmxTaskDefinition extends vscode.TaskDefinition {
	
	make?: string
}

export class BmxTaskProvider implements vscode.TaskProvider {
	provideTasks(token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		
		let scope: vscode.TaskScope = vscode.TaskScope.Workspace
		let name: string = 'BlitzMax'
		
		let execConsole: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildConsole}' )
		let kindConsole: BmxTaskDefinition = { type: 'bmx', make: 'console' }
		
		let execGui: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildGui}' )
		let kindGui: BmxTaskDefinition = { type: 'bmx', make: 'gui' }
		
		let execMods: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildMods}' )
		let kindMods: BmxTaskDefinition = { type: 'bmx', make: 'mods' }
		
		let execLib: vscode.ProcessExecution = new vscode.ProcessExecution( '${command:blitzmax.buildLib}' )
		let kindLib: BmxTaskDefinition = { type: 'bmx', make: 'lib' }
		
		return [
			new vscode.Task(kindConsole, scope, 'Console Application', name, execConsole),
			new vscode.Task(kindGui, scope, 'Gui Application', name, execGui),
			new vscode.Task(kindMods, scope, 'Module', name, execMods),
			new vscode.Task(kindLib, scope, 'Shared Library', name, execLib)
		]
	}
	resolveTask(task: vscode.Task, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		
		vscode.window.showInformationMessage( 'A TASK WAS RESOLVED?! Please report this to Hezkore' )
		return undefined
	}
}
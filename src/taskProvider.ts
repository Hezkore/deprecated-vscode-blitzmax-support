'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'
import * as os from 'os'
import * as path from 'path'
import { currentBmx, variableSub } from './common'

export interface BmxTaskDefinition extends vscode.TaskDefinition {
	
	source?: string, // Main source file for the project
	make: string, // makeapp, makemod, makelib
	app?: string, // -t console/gui (makeapp only)
	arch?: string, // -g Architecture
	platform?: string, // -l Platform
	threaded?: boolean, // -h Threaded
	output?: string, // -o Output
	debug?: boolean, // -d Debug or Release
	gdb?: boolean, // -gdb Mappings suitable for GDB
	quick?: boolean, // -quick Do a quick build
	execute?: boolean, // -x Execute after build
	verbose?: boolean // -v Verbose (noisy) build
}

export function currentDefinition(): BmxTaskDefinition | undefined {
	
	const config = vscode.workspace.getConfiguration( 'tasks' )
	if (!config) return
	
	const tasks: vscode.WorkspaceConfiguration | undefined = config.get( 'tasks' )
	if (!tasks) return
	
	for (let i = 0; i < tasks.length; i++) {
		const def: BmxTaskDefinition = tasks[i]
		if (!def) continue
		
		if (def.group.isDefault) return def
	}
	
	return
}

export class BmxTaskProvider implements vscode.TaskProvider {
	provideTasks( token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.Task[]> {
		
		const outputPath: string = path.join( 'bin', '${platform}', '${arch}', '${build}', '${fileBasenameNoExtension}' )
		
		let tasks: vscode.Task[] = []
		
		// Console
		let defConsole: BmxTaskDefinition = { type: 'bmx', make: 'makeapp', app: 'console',
		arch: 'auto', platform: 'auto', threaded: true, output: outputPath, source: '${relativeFile}',
		debug: false, execute: false, quick: false, verbose: false }
		let taskConsole: vscode.Task | undefined = makeTask( defConsole, 'Console Application' )
		if (taskConsole) tasks.push( taskConsole )
		
		// Gui
		let defGui: BmxTaskDefinition = { type: 'bmx', make: 'makeapp', app: 'gui',
		arch: 'auto', platform: 'auto', threaded: true, output: outputPath, source: '${relativeFile}',
		debug: false, execute: false, quick: false, verbose: false }
		let taskGui: vscode.Task | undefined = makeTask( defGui, 'Gui Application' )
		if (taskGui) tasks.push( taskGui )
		
		// Module
		let defMods: BmxTaskDefinition = { type: 'bmx', make: 'makemod', output: '', source: '${relativeFile}' }
		let taskMods: vscode.Task | undefined = makeTask( defMods, 'Module' )
		if (taskMods) tasks.push( taskMods )
		
		// Shared Library
		let defLib: BmxTaskDefinition = { type: 'bmx', make: 'makelib', output: '', source: '${relativeFile}' }
		let taskLib: vscode.Task | undefined = makeTask( defLib, 'Shared Library' )
		if (taskLib) tasks.push( taskLib )
		
		return tasks
	}
	resolveTask( _task: vscode.Task ): vscode.Task | undefined {
		
		const definition: BmxTaskDefinition = <any>_task.definition
		
		return makeTask( definition, 'Custom' )
	}
}

export function makeTask( definition: BmxTaskDefinition | undefined, name: string ): vscode.Task | undefined {
	
	if (!definition){
		vscode.window.showErrorMessage( "No definition provided!" )
		return
	}
	if (definition.type != 'bmx'){
		vscode.window.showErrorMessage( "Definition provided is not for BlitzMax!" )
		return
	}
	if (!definition.make){
		vscode.window.showErrorMessage( "No 'make' defined!" )
		return
	}
	if (!BlitzMax.ready) return
	
	// Prepare args
	let args:string[] = []
	
	// make* type (makeapp, makemods, makelib)
	definition.make = definition.make.toLowerCase()
	args.push( definition.make )
	
	// App type (makeapp only)
	if (definition.make == 'makeapp'){
		if (definition.app){
			args.push( '-t' )
			args.push( definition.app )
		}else{
			vscode.window.showErrorMessage( "Task has no 'app' type defined" )
			return
		}
	}
	
	// Detect platform
	let platform:string | undefined = definition.platform
	if (!platform || platform.toLowerCase() == 'auto' || BlitzMax.legacy){
		switch (os.platform().toLowerCase()) {
			case 'darwin':
				platform = 'macos'
				break
				
			default:
				platform = os.platform().toLowerCase()
				break
		}
	}
	
	// NG stuff only
	let arch:string | undefined = 'x86'
	if (!BlitzMax.legacy){
		
		// Architecture
		arch = definition.arch
		if (!arch || arch.toLowerCase() == 'auto') arch = os.arch()
		args.push( '-g' )
		args.push( arch )
		
		// GDB
		if (definition.gdb)
			args.push( '-gdb' )
		
		// Platform
		args.push( '-l' )
		args.push( platform )
		
		// Warn about NG stuff
		let funcArgCasting = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'funcArgCasting' )
		if (funcArgCasting == 'warn')
			args.push( '-w' )
		
		// Do a quick build
		if (definition.quick)
			args.push( '-quick' )
	}
	
	// Build threaded
	if (definition.threaded)
		args.push( '-h' )
	
		// Build output
	// Okay here's something!
	// All Legacy versions and NG versions lower than 3.39 do NOT create the output for you
	// And since VScode doesn't provide us with finished var subs;
	// so we just ignore output completely
	if (BlitzMax.supportsVarSubOutput && definition.output && definition.output.length > 0)
	{
		let outPath: string =
			variableSub( definition.output, arch, definition.debug, platform )
		
		args.push( '-o' )
		args.push( outPath )
	}
	
	// Execute after build
	if (definition.execute)
		args.push( '-x' )
	
	// Debug or Release version
	args.push( definition.debug ? '-d' : '-r'  )
	
	// Verbose build
	if (definition.verbose)
		args.push( '-v' )
	
	// Actual file to build
	let source:string | undefined = definition.source
	if ( !source || source.length <= 1 ){ // No source file set, figure one out!
		
		// Is a source file even open?
		let file: vscode.Uri | undefined = currentBmx()
		if (!file){
			vscode.window.showErrorMessage( "No .bmx file open!" )
			return
		}
		source = file.fsPath
	}
	args.push( source )
	
	// Setup the task already!
	
	// Okay so this is a weird one...
	// Ideally you'd add the Bmx Bin path to PATH and just call 'bmk'
	// But that CLEARS PATH !
	// So instead we just directly call 'bmk' via its absolute path
	let bmkPath = path.join( BlitzMax.binPath, 'bmk' )
	let exec: vscode.ShellExecution = new vscode.ShellExecution( bmkPath, args)//, { env: { 'PATH': BlitzMax.binPath } } )
	
	let task: vscode.Task = new vscode.Task( definition, vscode.TaskScope.Workspace, name, 'BlitzMax', exec, '$blitzmax' )
	
	// Setup the task to function a bit like MaxIDE
	task.presentationOptions.echo = false
	task.presentationOptions.reveal = vscode.TaskRevealKind.Always
	task.presentationOptions.focus = false
	task.presentationOptions.panel = vscode.TaskPanelKind.Shared
	task.presentationOptions.showReuseMessage = false
	task.presentationOptions.clear = true
	
	return task
}
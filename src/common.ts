'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as process from 'child_process'
import { BmxTaskDefinition } from './taskProvider'

let bmxPath:string | undefined
let binPath:string | undefined
let bmxNg:boolean

export async function setWorkspaceSourceFile( file:string ){
	
	if (!file){ return }
	
	await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'sourceFile', file, undefined )
	vscode.window.showInformationMessage( file + ' has been set as the workspace source file.' )
}

export function currentBmx():string{
	
	let fileType:string = '.bmx'
	let noFileMsg:string = 'No ' + fileType + ' file open.'
	let notFileMsg:string = 'This is not a ' + fileType + ' file'
	
	let textEditor = vscode.window.activeTextEditor
	if (!textEditor) {
		
		vscode.window.showErrorMessage( noFileMsg )
		return ''
	}
	
	let document = textEditor.document
	if (!document) {
		
		vscode.window.showErrorMessage( noFileMsg )
		return ''
	}
	
	let filename = document.fileName
	if ( !filename.toLowerCase().endsWith( fileType ) )  {
		
		vscode.window.showErrorMessage( notFileMsg )
		return ''
	}
	
	return filename
}

export async function bmxBuild( make:string, type:string = '', forceDebug:boolean = false, quick:boolean = false ){
	
	// Make sure we know where the BMK compiler is
	await updateBinPath( true )
	if ( !binPath ){ return }
	
	// make* type (makeapp, makemods, makelib)
	let args:string[] = [ make ]
	if ( type ){
		args.push( '-t' )
		args.push( type )
	}
	
	// Warn about NG stuff
	if ( bmxNg ){
		
		let funcArgCasting = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'funcArgCasting' )
		if ( funcArgCasting == 'warn' ){ args.push( '-w' ) }
	}
	
	// Build threaded
	args.push( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'threaded' ) ? '-h' : '' )
	
	// Build output
	let output:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'buildOut' )
	if ( output ){
		args.push( '-o' )
		args.push( output )
	}
	
	// Execute after build
	let execute:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'execute' )
	args.push( execute ? '-x' : '' )
	
	// Debug or Release
	if ( forceDebug ){
		
		args.push( '-d' )
	}else{
		
		let version = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'version' )
		if ( version == 'release' ){ args.push( '-r' ) }else{ args.push( '-d' ) }
	}
	
	// Do a quick build
	if ( bmxNg && quick ){
		
		args.push( '-quick' )
	}
	
	// Actual file to build
	let source:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'sourceFile' )
	if ( !source ){ // No source file set, figure one out!
		
		// Is a source file even open?
		let filename:string = currentBmx()
		if ( !filename ){ return }		
		
		// Do we automatically set the workspace source file?
		if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'autoSetSourceFile' )){
			
			// Yep, set the current file as the workspace source file
			await setWorkspaceSourceFile( filename )
			//setWorkspaceSourceFile( filename )
			
			// Update our source
			source = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'sourceFile' )
			//source = filename
		}else{
			
			// Nope, use current file for now
			source = filename
		}
	}
	if ( !source ){ return }
	args.push( source )
	
	//console.log( "NG: " + bmxNg )
	//console.log( args )
	
	// Create a tmp task to execute
	let exec: vscode.ShellExecution = new vscode.ShellExecution( 'bmk', args, { env: { 'PATH': binPath } } )
	let kind: BmxTaskDefinition = { type: 'bmx' }
	let task: vscode.Task = new vscode.Task( kind, vscode.TaskScope.Workspace, 'BlitzMax', 'Internal BlitzMax', exec, '$blitzmax' )
	
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

function exec( command: string, options: process.ExecOptions ): Promise<{ stdout: string; stderr: string }> {
	
	return new Promise<{ stdout: string; stderr: string }>( ( resolve, reject ) => {
		
		process.exec(command, options, ( error, stdout, stderr ) => {
			
			if ( error ) {
				
				reject( { error, stdout, stderr } )
			}
			
			resolve( { stdout, stderr } )
		})
	})
}

async function testNg() {
	
	bmxNg = false
	if ( !binPath ) { return }
	
	try {
		let { stdout, stderr } = await exec( 'bcc', { env: { 'PATH': binPath } } )
		
		if ( stderr && stderr.length > 0 ) {
			
			binPath = ''
			
			vscode.window.showErrorMessage( 'BMK error: ' + stderr )
		}
		
		if ( stdout ) {
			
			if ( stdout.toLowerCase().startsWith( 'blitzmax release version' ) ) {
				
				//console.log( "is Legacy" )
			} else {
				
				//console.log( "is NG" )
				bmxNg = true
			}
		}
	} catch ( err ) {
		
		binPath = ''
		
		let msg:string = err
		if ( err.stderr ) { msg = err.stderr }
		if ( err.stdout ) { msg = err.stdout }
		
		vscode.window.showErrorMessage( 'Error executing BMK: ' + msg )
	}
}

async function updateBinPath( askToSet:boolean ){
	 
	// Fetch the BlitzMax path
	binPath = ''
	bmxPath = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'bmxPath' )
	if (bmxPath) {
		
		// Figure out the bin path
		binPath = path.join( bmxPath, 'bin' )
		await testNg()
		
		return
	}
	
	// Notify that the path is not set and offer to set it
	const opt = await vscode.window.showErrorMessage( 'BlitzMax path not set in extension configuration.', 'Set Path' )
	if (opt) {
		
		const folderOpt: vscode.OpenDialogOptions = {
			canSelectMany: false,
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: 'Select'
		}
		
		vscode.window.showOpenDialog( folderOpt ).then( async fileUri => {
			
			if (fileUri && fileUri[0]) {
				
				await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'bmxPath', fileUri[0].fsPath, true )
				await updateBinPath( false )
				
				if (binPath){
					
					vscode.window.showInformationMessage( 'BlitzMax Path Set' )
				}
			}
		})
	}
	
	return
}
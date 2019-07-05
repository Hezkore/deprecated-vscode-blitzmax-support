'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as process from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import { BmxTaskDefinition } from './taskProvider'

export let bmxPath:string | undefined
export let binPath:string | undefined
export let bmxProblem:boolean
export let bmxNg:boolean

export function startup( context:vscode.ExtensionContext ) {
	
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration( event => {
			
			if ( event.affectsConfiguration( 'blitzmax.bmxPath' ) ){
				
				bmxPath = ''
				binPath = ''
				bmxProblem = false
			}
		})
	)
}

export async function setWorkspaceSourceFile( file:string ){
	
	if (!file){ return }
	
	await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'sourceFile', file, undefined )
	vscode.window.showInformationMessage( file + ' has been set as the workspace source file' )
}

export function getWordAt( document:vscode.TextDocument, position:vscode.Position ):string{
	
	let wordRange = document.getWordRangeAtPosition(position)
	if (!wordRange) { return '' }
	
	let highlight = document.getText(wordRange)
	if (!highlight) { return '' }
	
	return highlight
}

export function currentWord():string{
	
	const editor = vscode.window.activeTextEditor
	if (!editor) { return '' }
	
	let cursorPosition = editor.selection.start
	if (!cursorPosition) { return '' }
	
	let wordRange = editor.document.getWordRangeAtPosition(cursorPosition)
	if (!wordRange) { return '' }
	
	let highlight = editor.document.getText(wordRange)
	if (!highlight) { return '' }
	
	return highlight
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
	
	if (bmxProblem){ return }
	
	// Make sure we know where the BMK compiler is
	await updateBinPath( true )
	if ( !binPath ){ return }
	
	// make* type (makeapp, makemods, makelib)
	make = make.toLowerCase()
	let args:string[] = [ make ]
	
	// App type (makeapp only)
	if (make == 'makeapp' && type){
		args.push( '-t' )
		args.push( type )
	}
	
	if (bmxNg){
		// Architecture
		let arch:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'architecture' )
		if (!arch || arch.toLowerCase() == 'auto'){ arch = os.arch() }
		args.push( '-g' )
		args.push( arch )
		
		// Platform
		let platform:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'platform' )
		if (!platform || platform.toLowerCase() == 'auto'){ 
			switch (os.platform().toLowerCase()) {
				case 'darwin':
					platform = 'macos'
					break
					
				default:
					platform = os.platform().toLowerCase()
					break
			}
		}
		args.push( '-l' )
		args.push( platform )
		
		// Warn about NG stuff
		let funcArgCasting = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'funcArgCasting' )
		if ( funcArgCasting == 'warn' ){ args.push( '-w' ) }
		
		// Do a quick build
		if (quick){ args.push( '-quick' ) }
	}
	
	// Build threaded
	args.push( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'threaded' ) ? '-h' : '' )
	
	// Build output
	let output:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'buildOut' )
	if (output){
		args.push( '-o' )
		args.push( output )
	}
	
	// Execute after build
	let execute:string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'execute' )
	args.push( execute ? '-x' : '' )
	
	// Debug or Release version
	if (forceDebug){
		
		args.push( '-d' )
	}else{
		
		let version = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'version' )
		if ( version == 'release' ){ args.push( '-r' ) }else{ args.push( '-d' ) }
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
	console.log( args )
	
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

export async function exists( file: string ): Promise<boolean> {
	
	return new Promise<boolean>( ( resolve, _reject ) => {
		
		fs.exists( file, ( value ) => {
			
			resolve( value )
		})
	})
}

async function testNg() {
	
	if (bmxProblem){ return }
	
	bmxNg = false
	if ( !binPath ) { return }
	
	try {
		let { stdout, stderr } = await exec( 'bcc', { env: { 'PATH': binPath } } )
		
		if ( stderr && stderr.length > 0 ) {
			
			binPath = ''
			
			bmxProblem = true
			await askSetPath( 'BCC error: ' + stderr )
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
		
		bmxProblem = true
		await askSetPath( 'Error executing BCC: ' + msg )
	}
}

export async function askSetPath( msg:string ){
	
	const opt = await vscode.window.showErrorMessage( msg, 'Set Path' )
	if (opt) {
		
		const folderOpt: vscode.OpenDialogOptions = {
			canSelectMany: false,
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: 'Select'
		}
		
		vscode.window.showOpenDialog( folderOpt ).then( async fileUri => {
			
			if (fileUri && fileUri[0]) {
				
				bmxProblem = false
				
				await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'bmxPath', fileUri[0].fsPath, true )
				await updateBinPath( false )
				
				if (binPath){
					
					vscode.window.showInformationMessage( 'BlitzMax Path Set' )
				}
			}
		})
	}
}


export async function updateBinPath( askToSet:boolean ){
	 
	if (bmxProblem){ return }
	
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
	await askSetPath( 'BlitzMax path not set in extension configuration' )
	
	return
}
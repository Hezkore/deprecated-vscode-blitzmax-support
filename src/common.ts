'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as process from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import { BmxTaskDefinition } from './taskProvider'
import { BlitzMax } from './blitzmax'

export async function readDir( path:string ): Promise<string[]> {
	
    return new Promise(function(resolve, reject) {
        fs.readdir(path, 'utf8', function(err, filenames){
            if (err) 
                reject(err)
            else 
                resolve(filenames)
        })
    })
}

export async function readFile( filename:string ): Promise<string> {
	
    return new Promise(function(resolve, reject) {
        fs.readFile(filename, function(err, data){
            if (err) 
                reject(err)
            else 
                resolve(data.toString())
        })
    })
}

export async function writeFile( filename: string, data: any ): Promise<boolean> {
	
    return new Promise(function(resolve, reject) {
        fs.writeFile(filename, data, function(err){
            if (err) 
                reject(false)
            else 
                resolve(true)
        })
    })
}

export async function readStats( filename:string ): Promise<fs.Stats> {
	
	return new Promise(function(resolve, reject) {
		fs.stat( filename, ( err, stats )=>{
            if (err) 
                reject(err)
            else 
                resolve(stats)
		})
	})
}
export async function setWorkspaceSourceFile( file:string ){
	
	if (!file){ return }
	
	await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'sourceFile', file, undefined )
	vscode.window.showInformationMessage( file + ' has been set as the workspace source file' )
}

export function getWordAt( document:vscode.TextDocument, position:vscode.Position ): string{
	
	let wordRange = document.getWordRangeAtPosition(position)
	if (!wordRange) { return '' }
	
	let highlight = document.getText(wordRange)
	if (!highlight) { return '' }
	
	return highlight
}

export function currentWord(): string{
	
	const editor = vscode.window.activeTextEditor
	if (!editor) return ''
	
	let cursorPosition = editor.selection.start
	if (!cursorPosition) return ''
	
	let wordRange = editor.document.getWordRangeAtPosition( cursorPosition )
	if (!wordRange) return ''
	
	let highlight = editor.document.getText( wordRange )
	if (!highlight) return ''
	
	return highlight
}

export function capitalize( text:string ): string{
	
	let result = text[0].toUpperCase()
	result += text.slice( 1 )
	
	return result
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
	
	if (!BlitzMax.ready) return
	
	// make* type (makeapp, makemods, makelib)
	make = make.toLowerCase()
	let args:string[] = [ make ]
	
	// App type (makeapp only)
	if (make == 'makeapp' && type){
		args.push( '-t' )
		args.push( type )
	}
	
	if (!BlitzMax.legacy){
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
	let exec: vscode.ShellExecution = new vscode.ShellExecution( 'bmk', args, { env: { 'PATH': BlitzMax.binPath } } )
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

export async function exec( command: string, options: process.ExecOptions ): Promise<{ stdout: string; stderr: string }> {
	
	return new Promise<{ stdout: string; stderr: string }>( ( resolve, reject ) => {
		
		process.exec(command, options, ( error, stdout, stderr ) => {
			
			if ( error ) {
				
				return reject( { error, stdout, stderr } )
			}
			
			return resolve( { stdout, stderr } )
		})
	})
}

export async function exists( file: string ): Promise<boolean> {
	
	return new Promise<boolean>( ( resolve, _reject ) => {
		
		fs.exists( file, ( value ) => {
			
			return resolve( value )
		})
	})
}


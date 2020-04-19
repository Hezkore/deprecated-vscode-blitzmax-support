'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as process from 'child_process'
import * as fs from 'fs'
import { currentDefinition, saveAsDefaultTaskDefinition } from './taskProvider'

let outputChannel: vscode.OutputChannel
export function log( text:string = '', onNewLine: boolean = true, show: boolean = false ) {
	
	if (!outputChannel)
		outputChannel = vscode.window.createOutputChannel( 'BlitzMax' )
	
	outputChannel.append( onNewLine ? `\n${text}` : text )
	
	if (show) outputChannel.show( true )
}

export function clearLog() {
	
	if (outputChannel)
		outputChannel.clear()
}

export function makeReturnPretty( ret: string | undefined, nullToInt: boolean = true ): string{
	
	if (!ret){
		if (nullToInt){
			
			return 'Int'
		}else{
			
			return ''
		}
	}
	
	switch (ret.toLowerCase()) {
		case 'byte':
			return 'Byte'
		case 'short':
			return 'Short'
		case 'int':
			return 'Int'
		case 'uint':
			return 'UInt'		
		case 'long':
			return 'Long'							
		case 'ulong':
			return 'ULong'			
		case 'float':
			return 'Float'
		case 'double':
			return 'Double'
		case 'string':
			return 'String'
		case 'size_t':
			return 'Size_T'	
		case 'float64':
			return 'Float64'
		case 'int128':
			return 'Int128'
		case 'float128':
			return 'Float128'
		case 'double128':
			return 'Double128'
	}
	
	return ret
}

export function convertTypeTagShortcut( tag: string ): string{
	
	switch (tag) {
		case '%':
			return 'Int'
		case '#':
			return 'Float'
		case '!':
			return 'Double'
		case '$':
			return 'String'
	}
	
	return tag
}

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
		
		fs.readFile( filename, function( err, data ) {
			if (err)
				reject( err )
			else
				resolve( data.toString() )
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
export function setSourceFile( file: vscode.Uri | undefined ){
	
	if (!file) {	
		vscode.window.showErrorMessage( 'No file to set as source' )
		return
	}
	
	const workPath: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder( file )
	const filePath: string = workPath ? path.relative( workPath.uri.path, file.path ) : file.fsPath
	
	let curDef = currentDefinition()
	
	curDef.source = filePath
	if (curDef.output){
		curDef.output = curDef.output.replace(
			'${fileBasenameNoExtension}',
			path.basename( file.path ).split( '.' )[0]
		)
	}
	
	if (saveAsDefaultTaskDefinition( curDef ))
		vscode.window.showInformationMessage( filePath + ' has been set as the default task source' )
}

export function generateCommandText( command: string, args: any[] ) {
	return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`
}

export function currentWord( position: vscode.Position | undefined = undefined, document: vscode.TextDocument | undefined = undefined, editor: vscode.TextEditor | undefined = undefined ): string{
	
	// Use the current active editor if no editor was specified
	if (!editor) editor = vscode.window.activeTextEditor
	if (!editor) return ''
	
	// Use the cursor position if no position was specified
	if (!position) position = editor.selection.start
	if (!position) return ''
	
	// Use the editor document if no document was specified
	if (!document) document = editor.document
	if (!document) return ''
	
	let wordRange = document.getWordRangeAtPosition( position )
	if (!wordRange) return ''
	
	let word = document.getText( wordRange )
	return word
}

export function currentWordTrigger( position: vscode.Position | undefined = undefined, document: vscode.TextDocument | undefined = undefined, editor: vscode.TextEditor | undefined = undefined ): string{
	
	// Use the current active editor if no editor was specified
	if (!editor) editor = vscode.window.activeTextEditor
	if (!editor) return ''
	
	// Use the cursor position if no position was specified
	if (!position) position = editor.selection.start
	if (!position) return ''
	
	// Use the editor document if no document was specified
	if (!document) document = editor.document
	if (!document) return ''
	
	let wordRange = document.getWordRangeAtPosition( position )
	if (!wordRange) return ''
	
	let word = document.getText( wordRange )
	if (!word) return ''
	
	let wordTrigger: string = ''
	if (wordRange.start.character-1 >= 0) {
		wordTrigger = document.getText(new vscode.Range(
			new vscode.Position( wordRange.start.line, wordRange.start.character-1 ),
			new vscode.Position( wordRange.start.line, wordRange.start.character)
		))
	}
	
	return wordTrigger
}

export function capitalize( text:string | undefined ): string{
	
	if (!text) return ''
	return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function variableSub( text: string | undefined, arch: string, debug: boolean | undefined, platform: string ): string{
	
	if (!text)
		return ''
	text = text.trim()
	if (text.length <= 0)
		return ''
	
	if (platform.toLocaleLowerCase() == 'win32')
		platform = 'windows'
	
	text = text.replace('${arch}', arch)
	text = text.replace('${build}', debug ? 'debug' : 'release')
	text = text.replace('${platform}', platform)
	
	return text
}

export function currentBmx( showError: boolean = true ): vscode.Uri | undefined {
	
	const fileType:string = '.bmx'
	const noFileMsg:string = 'No ' + fileType + ' file open.'
	const notFileMsg:string = 'This is not a ' + fileType + ' file'
	
	const textEditor = vscode.window.activeTextEditor
	if (!textEditor) {
		
		if (showError) vscode.window.showErrorMessage( noFileMsg )
		return
	}
	
	const document = textEditor.document
	if (!document) {
		
		if (showError) vscode.window.showErrorMessage( noFileMsg )
		return
	}
	
	const file = document.uri
	if ( !file.fsPath.toLowerCase().endsWith( fileType ) )  {
		
		if (showError) vscode.window.showErrorMessage( notFileMsg )
		return
	}
	
	return file
}

export function isPartOfWorkspace( uri: vscode.Uri ): boolean {
	
	return vscode.workspace.getWorkspaceFolder( uri ) ? true : false
}

export async function exec( executable: string, args: string[] = [] ): Promise<{ stdout: string; stderr: string }> {
	
	return new Promise<{stdout:string; stderr:string}>( (resolve, reject) => {
		
		
		process.execFile( executable, args, (error, stdout, stderr) => {
			
			if (error)
				return reject({ error, stdout, stderr })
			
			return resolve( { stdout, stderr } )
		})
	})
}

export async function exists( file: string ): Promise<boolean> {
	
	return new Promise<boolean>( ( resolve, _reject ) => {
		
		fs.exists( file, ( value ) => { return resolve( value ) })
	})
}

export async function createDir( path: string ): Promise<boolean> {
	
	return new Promise<boolean>( ( resolve, _reject ) => {
		
		fs.mkdir(path, { recursive: true }, ( err ) => {
			
			return resolve( err == null )
		})
	})
}

export async function removeFile( file: string ): Promise<boolean> {
	
	return new Promise<boolean>( ( resolve, reject ) => {
		
		fs.unlink(file, ( err ) => { return resolve( err == null ) })
	})
}

export function removeDir( path: string ): boolean {
	
	if (fs.existsSync(path)) {
		const files = fs.readdirSync(path)

		if (files.length > 0) {
		files.forEach(function(filename) {
			if (fs.statSync(path + "/" + filename).isDirectory()) {
				removeDir(path + "/" + filename)
			} else
				fs.unlinkSync(path + "/" + filename)
		})
		fs.rmdirSync(path)
	  } else
		fs.rmdirSync(path)
	} else
		return false
	
	return true
}

export function copyFolderSync( from: string, to: string, onlyExt: string | undefined = undefined ): string[] {
	
	let result:string [] = []
	
	if (!fs.existsSync( to ))
		fs.mkdirSync( to )
	
    fs.readdirSync( from ).forEach( element => {
		
		if (fs.lstatSync( path.join( from, element ) ).isFile()){
			if (!onlyExt || path.extname( element ).toLowerCase() == onlyExt){
				fs.copyFileSync( path.join( from, element ), path.join( to, element ) )
				result.push( path.join( to, element ) )
			}
		}else{
			copyFolderSync( path.join( from, element ), path.join( to, element ), onlyExt ).forEach( resultFile => {
				result.push( resultFile )
			})
		}
	})
	
	return result
}

export async function getFirstEmptyLine( code: string ): Promise<vscode.Position> {
	
	return new Promise<vscode.Position>( ( resolve, reject ) => {
		
		let lines: string[] = code.trim().split( '\n' )
		let depth: number = 0
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trimRight()
			if (line.startsWith( "'" )) continue
			const lowerLine: string = line.toLowerCase()
			
			if (lowerLine == 'rem' || lowerLine.startsWith( 'rem ' ))
				depth++
			else if (lowerLine == 'endrem' || lowerLine == 'end rem' )
			{
				if (depth > 0)
					depth--
			}
			else if (depth > 0)
				continue
			else
				return resolve( new vscode.Position( i, 0 ) )
		}
		
		return resolve( new vscode.Position( lines.length, 0 ) )
	})
}
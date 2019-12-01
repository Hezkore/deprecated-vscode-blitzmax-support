'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as process from 'child_process'
import * as fs from 'fs'
import { BmxTaskDefinition } from './taskProvider'

let outputChannel: vscode.OutputChannel
export function log( text:string, append: boolean = true ) {
	
	if (!outputChannel)
		outputChannel = vscode.window.createOutputChannel( 'BlitzMax' )
	
	if (append)
		outputChannel.appendLine( text )
	else
		outputChannel.append( text )
	
	outputChannel.show( true )
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
export function setSourceFile( file: vscode.Uri | undefined ){
	
	if (!file) return
	
	const workPath: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder( file )
	if (!workPath) return
	
	const config = vscode.workspace.getConfiguration( 'tasks' )
	if (!config) return
	
	const tasks: BmxTaskDefinition | undefined = config.get( 'tasks' )
	if (!tasks){
		
		vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultBuildTask' )
		return
	}
	
	let updatedTasks: BmxTaskDefinition[] = []
	let foundDefault: boolean = false
	for (let i = 0; i < tasks.length; i++) {
		const def: BmxTaskDefinition = tasks[i]
		if (!def) continue
		
		if (def.group.isDefault){
			
			const filePath: string = path.relative( workPath.uri.path, file.path )
			def.source = filePath
			if (def.output){
				
				def.output = def.output.replace( '${fileBasenameNoExtension}',
				path.basename( file.path ).split( '.' )[0] )
			}
			foundDefault = true
			vscode.window.showInformationMessage( filePath + ' has been set as the default task source' )
		}
		updatedTasks.push( def )
	}
	
	config.update( 'tasks', updatedTasks )
	
	if (!foundDefault) vscode.window.showErrorMessage( 'No default task configured' )
}

export function getWordAt( document: vscode.TextDocument, position: vscode.Position ): string{
	
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

export function variableSub(text: string, arch: string, debug: boolean | undefined, platform: string): string{
	
	if (platform.toLocaleLowerCase() == 'win32')
		platform = 'windows'
	
	text = text.replace('${arch}', arch)
	text = text.replace('${build}', debug ? 'debug' : 'release')
	text = text.replace('${platform}', platform)
	
	return text
}

export function currentBmx(): vscode.Uri | undefined {
	
	const fileType:string = '.bmx'
	const noFileMsg:string = 'No ' + fileType + ' file open.'
	const notFileMsg:string = 'This is not a ' + fileType + ' file'
	
	const textEditor = vscode.window.activeTextEditor
	if (!textEditor) {
		
		vscode.window.showErrorMessage( noFileMsg )
		return
	}
	
	const document = textEditor.document
	if (!document) {
		
		vscode.window.showErrorMessage( noFileMsg )
		return
	}
	
	const file = document.uri
	if ( !file.fsPath.toLowerCase().endsWith( fileType ) )  {
		
		vscode.window.showErrorMessage( notFileMsg )
		return
	}
	
	return file
}

export async function exec( command: string, options: process.ExecOptions ): Promise<{ stdout: string; stderr: string }> {
	
	return new Promise<{ stdout: string; stderr: string }>( ( resolve, reject ) => {
		
		process.exec(command, options, ( error, stdout, stderr ) => {
			
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
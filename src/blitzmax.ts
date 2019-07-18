'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { scanModules, BmxModule, AnalyzeDoc } from './bmxModules'
import { exec } from './common'
import { promises } from 'dns';

export class BlitzMaxHandler{
	
	_modules: Map<string, BmxModule> = new Map()
	_commands: AnalyzeDoc[] = []
	_autoCompletes: vscode.CompletionItem[] = []
	
	private _ready: boolean = false
	private _path: string = ''
	private _problem: string | undefined
	private _legacy: boolean = false
	private _askedForPath: boolean = false
	
	get path(): string {
		
		return this._path
	}
	get binPath(): string{
		
		return path.join( this.path, 'bin' )
	}
	
	get modPath(): string{
		
		return path.join( this.path, 'mod' )
	}
	get ready(): boolean { return this._ready }
	get problem(): string | undefined { return this._problem }
	set problem( message:string | undefined ) {
		
		vscode.window.showErrorMessage( 'BlitzMax Error:' + message )
		console.log( 'BlitzMax Error:', message )
	}
	get legacy(): boolean { return this._legacy }
	
	async setup( context: vscode.ExtensionContext ){
		
		return new Promise<boolean>( async ( resolve, reject ) => {
			
			console.log( 'Setting up BlitzMax' )
			
			this._askedForPath = false
			this._problem = ''
			this._ready = false
			this._legacy = false
			this._path = ''
			
			await this.findPath()
			if (this.path.length <= 3){
				this.problem = 'No BlitzMax path set'
				return reject()
			}
			
			await this.checkLegacy()
			if (this.problem) return reject() 
			
			await scanModules( context )
			
			this._ready = true
			console.log( 'BlitzMax correctly setup!' )
			resolve()
		})
	}
	
	private async findPath(){
		
		let confPath: string | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'bmxPath' )
		if (!confPath){
			
			if (!this._askedForPath){
				
				this._askedForPath = true
				//this.AskForPath()
			}
			
			return
		}
		
		this._path = confPath
	}
	
	private async askForPath( msg:string = 'BlitzMax path not set in extension configuration' ){
		
		const opt = await vscode.window.showErrorMessage( msg, 'Set Path' )
		if (opt) {
			
			const folderOpt: vscode.OpenDialogOptions = {
				canSelectMany: false,
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: 'Select'
			}
			
			await vscode.window.showOpenDialog( folderOpt ).then( async fileUri => {
				
				if (fileUri && fileUri[0]) {
					
					await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'bmxPath', fileUri[0].fsPath, true )
					this.findPath()
					
					if (this.path){
							
						vscode.window.showInformationMessage( 'BlitzMax Path Set' )
					}
				}
			})
		}
	}
	
	getModule( parent: string, name:string ): BmxModule | undefined {
		
		return this._modules.get( parent + "/" + name )
	}
	
	getCommand( name:string, allowMethod: boolean = false ): AnalyzeDoc[] {
		
		name = name.toLowerCase()
		
		let result: AnalyzeDoc[] = []
		let cmd: AnalyzeDoc
		for(var i=0; i<this._commands.length; i++){
			
			cmd = this._commands[i]
			if (cmd.searchName == name){
				
				if (cmd.regards.type == 'method'){
					if (allowMethod) result.push( cmd )
				}else{ result.push( cmd ) }
			}
		}
		
		/*
		if (result.length <= 0){
			console.log( 'No command matching:', name )
		}
		*/
		
		return result
	}
	
	getCommands( allowMethod: boolean = false): AnalyzeDoc[]{
		
		if (!allowMethod){
			
			let result: AnalyzeDoc[] = []
			
			for(var i=0; i<this._commands.length; i++){
				
				if (this._commands[i].regards.type != 'method'){
					result.push( this._commands[i] )
				}
			}
			
			return result
		}else{ return this._commands }	
	}
	
	getAutoCompletes(): vscode.CompletionItem[]{
		if (this._autoCompletes.length <= 0) this.generateAutoCompletes()
		return this._autoCompletes
	}
	
	generateAutoCompletes() {
		
		console.log( 'Generating auto completes' )
		
		const cmds = this.getCommands( false )
		for(var ci=0; ci<cmds.length; ci++){
			
			// Get the command
			const cmd = cmds[ci]
			if (!cmd) break 
			
			// Get the label
			const label = cmd.regards.name
			if (!label || label.length <= 0) break 
			
			// Generate the kind
			let kind: vscode.CompletionItemKind = vscode.CompletionItemKind.Text
			switch (cmd.regards.type) {
				case 'function':
					kind = vscode.CompletionItemKind.Function
					break
					
				case 'method':
						kind = vscode.CompletionItemKind.Method
						break
					
				case 'type':
						kind = vscode.CompletionItemKind.Class
						break
					
				case 'enum':
						kind = vscode.CompletionItemKind.Enum
						break
					
				case 'keyword':
						kind = vscode.CompletionItemKind.Keyword
						break
					
				case 'local':
				case 'global':
				case 'const':
						kind = vscode.CompletionItemKind.Variable
						break
			}
			
			// Construct item with our information
			const item = new vscode.CompletionItem( label, kind )
			item.documentation = new vscode.MarkdownString()
			.appendCodeblock( cmd.regards.data, 'blitzmax' )
			.appendMarkdown( cmd.info )
			.appendMarkdown( '\r\r*' + cmd.module + '*' )
			
			// Prettify document insert data
			item.insertText = new vscode.SnippetString( cmd.regards.name )
			switch (cmd.regards.type) {
				case 'function':
				case 'method':
					item.insertText.appendText( '( ' )
					
					let args = cmd.regards.args
					if (args){
						for(var i=0; i<args.length; i++){
							
							switch (args[i].returns.toLowerCase()) {
								case 'string':
									item.insertText.appendText( '"' )
									let def = args[i].default
									if (def){
										if (def.startsWith( '"' )) def = def.slice( 1 )
										if (def.endsWith( '"' )) def = def.slice( 0, -1 )
										item.insertText.appendPlaceholder( def )
									}else{
										item.insertText.appendPlaceholder( args[i].name )
									}
									item.insertText.appendText( '"' )
									break
							
								default:
									item.insertText.appendPlaceholder( args[i].name + ':' + args[i].returns )
									break
							}
							
							if (i < args.length - 1) item.insertText.appendText( ', ' )
						}
					}
					
					item.insertText.appendText( ' )' )
					break
			}
			
			// Push the complete item to our array
			this._autoCompletes.push(item)				
		}
	}
	
	private async checkLegacy(){
		
		try {
			let { stdout, stderr } = await exec( 'bcc', { env: { 'PATH': this.binPath } } )
			
			if ( stderr && stderr.length > 0 ) {
				
				this.problem = stderr
				//vscode.window.showErrorMessage( 'BCC error: ' + stderr )
			}
			
			if ( stdout ) {
				
				if ( stdout.toLowerCase().startsWith( 'blitzmax release version' ) ) {
					
					console.log( "is Legacy" )
					this._legacy = true
				}else{
					
					console.log( "is NG" )
					this._legacy = false
				}
			}
		} catch ( err ) {
			
			let msg:string = err
			if ( err.stderr ) { msg = err.stderr }
			if ( err.stdout ) { msg = err.stdout }
			
			this._problem = 'Unable to determin BlitzMax version'
			this.askForPath( 'Make sure your BlitzMax path is correct. (' + msg + ')' )
		}
	}
}
export let BlitzMax: BlitzMaxHandler = new BlitzMaxHandler()
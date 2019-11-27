'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { scanModules, BmxModule, AnalyzeDoc, AnalyzeItem } from './bmxModules'
import { exec, exists, readFile, log, clearLog } from './common'

export class BlitzMaxHandler{
	
	_modules: Map<string, BmxModule> = new Map()
	_commands: AnalyzeDoc[] = []
	_autoCompletes: vscode.CompletionItem[] = []
	
	private _ready: boolean = false
	private _path: string = ''
	private _problem: string | undefined
	private _legacy: boolean = false
	private _version:string = 'Unknown'
	private _bccVersion: string = '0.0'
	private _bmkVersion: string = '0.0'
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
		
		vscode.window.showErrorMessage( 'BlitzMax Error: ' + message )
		console.log( 'BlitzMax Error: ', message )
	}
	get legacy(): boolean { return this._legacy }
	get bccVersion(): string { return this._bccVersion }
	get bmkVersion(): string { return this._bmkVersion }
	get version(): string { return this._version }
	get supportsVarSubOutput(): boolean{
		
		// Minimum NG version is 3.39
		if (this._legacy || BlitzMax.bmkVersion < '3.39' )
			return false
		
		return true
	}
	
	async setup( context: vscode.ExtensionContext ){
		
		clearLog()
		log( 'Initializing BlitzMax' )
		
		return new Promise<boolean>( async ( resolve, reject ) => {
			
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
			log( `BlitzMax ${this.version} Ready!` )
			
			if (!this.supportsVarSubOutput)
				log( '*Notice* task.json output is NOT supported on this version of BlitzMax' )
			
			resolve()
		})
	}
	
	private async findPath(){
		this._path = ''
		
		let confPath: string | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'bmxPath' )
		if (!confPath){
			if (!this._askedForPath){
				this._askedForPath = true
				await this.askForPath()
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
					
					if (this.path)
						vscode.window.showInformationMessage( 'BlitzMax Path Set' )
				}
			})
		}
	}
	
	getModule( parent: string, name:string ): BmxModule | undefined {
		
		if (!this.ready) return undefined
		
		return this._modules.get( parent + "/" + name )
	}
	
	getCommand( name:string, allowMethod: boolean = false ): AnalyzeDoc[] {
		
		if (!this.ready) return []
		
		name = name.toLowerCase()
		
		let result: AnalyzeDoc[] = []
		let cmd: AnalyzeDoc
		for(var i=0; i<this._commands.length; i++){
			
			cmd = this._commands[i]
			if (cmd.searchName == name){
				
				if (cmd.regards.inside){
					if (allowMethod) result.push( cmd )
				}else{ result.push( cmd ) }
			}
		}
		
		return result
	}
	
	getCommands( allowMethod: boolean = false): AnalyzeDoc[]{
		
		if (!this.ready) return []
		
		if (!allowMethod){
			
			let result: AnalyzeDoc[] = []
			
			for(var i=0; i<this._commands.length; i++){
				
				if (!this._commands[i].regards.inside){
					result.push( this._commands[i] )
				}
			}
			
			return result
		}else{ return this._commands }	
	}
	
	getAutoCompletes(): vscode.CompletionItem[]{
		
		if (!this.ready) return []
		
		if (this._autoCompletes.length <= 0) this.generateAutoCompletes()
		return this._autoCompletes
	}
	
	private generateAutoCompletes() {
		
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
			if (cmd.regards.prettyData){
				item.documentation = new vscode.MarkdownString()
				.appendCodeblock( cmd.regards.prettyData, 'blitzmax' )
				.appendMarkdown( cmd.info )
				.appendMarkdown( '\r\r*' + cmd.module + '*' )
			}
			
			// Prettify document insert data
			item.insertText = new vscode.SnippetString( cmd.regards.name )
			switch (cmd.regards.type) {
				case 'function':
				case 'method':
					
					let args = cmd.regards.args
					if (args){
						
						item.insertText.appendText( '( ' )
						
						for(var i=0; i<args.length; i++){
							item.insertText.appendPlaceholder( args[i].name + ':' + args[i].returns )
							if (i < args.length - 1) item.insertText.appendText( ', ' )
						}
						
						item.insertText.appendText( ' )' )
					}else{
						
						item.insertText.appendText( '()' )
					}
					
					break
			}
			
			// Push the complete item to our array
			this._autoCompletes.push(item)				
		}
	}
	
	private async checkLegacy(){
		
		this._bccVersion = '0.0'
		this._bmkVersion = '0.0'
		
		// First we check the bcc version
		try {
			let {stdout, stderr} = await exec('bcc', {env: {'PATH': this.binPath}})
			
			if (stderr && stderr.length > 0)
			{
				this.problem = stderr
				return
			}
			
			if (stdout) {
				let spaceSplit: string[] = stdout.trim().split(' ')
				
				if (stdout.toLowerCase().startsWith('blitzmax release version'))
					this._legacy = true
				else
					this._legacy = false
				
				this._bccVersion = spaceSplit[spaceSplit.length - 1]
				log(`\tBCC Version: ${this._bccVersion}`)
			}
		}catch(err){
			let msg:string = err
			if (err.stderr) msg = err.stderr
			if (err.stdout) msg = err.stdout
			
			this._problem = 'Unable to determine BlitzMax version'
			this.askForPath( 'Make sure your BlitzMax path is correct. (' + msg + ')' )
		}
		
		this._version = `NG v${this._bccVersion}`
		
		// Secondly we check the bmk version
		// Notice that Legacy bmk doesn't even provide a bmk version ¯\_(ツ)_/¯
		if (!this._legacy)
		{
			try {
				let {stdout, stderr} = await exec('bmk -v', {env: {'PATH': this.binPath}})
				
				if (stderr && stderr.length > 0)
				{
					this.problem = stderr
					return
				}
				
				if (stdout) {
					let spaceSplit: string[] = stdout.trim().split(' ')
					
					if (spaceSplit.length > 1)
					{
						this._bmkVersion = spaceSplit[1]
						log(`\tBMK Version: ${this._bmkVersion}`)
					}
					else
					{
						this.problem = 'Unable to determine bmk version'
						return
					}
				}
			}catch(err){
				let msg:string = err
				if (err.stderr) msg = err.stderr
				if (err.stdout) msg = err.stdout
				
				this._problem = 'Unable to determine bmk version'
				this.askForPath( 'Make sure your BlitzMax path is correct. (' + msg + ')' )
			}
		}else
			this._version = `Legacy v${this._bccVersion}`
	}
	
	async hasExample( cmd: AnalyzeDoc ): Promise<string>{
		return new Promise<string>( async ( resolve, reject ) => {
			
			if (!this.ready){
				vscode.window.showErrorMessage( 'BlitzMax not ready!' )
				return reject()
			}
			
			// File length must be greater than 4
			// .bmx is 4 letters by itself!
			if (!cmd || !cmd.regards || !cmd.regards.file || cmd.regards.file.length <= 4) return ''
			
			const exampleFolders = ['doc','examples','docs','example','test','tests']
			
			for (let i = 0; i < exampleFolders.length; i++) {
				const examplePath = path.join( BlitzMax.path,
					path.dirname( cmd.regards.file ),
					exampleFolders[i],
					cmd.searchName + '.bmx'
				)
				if (await exists( examplePath )) return resolve( examplePath )
			}
			
			return resolve( '' )
		})
	}
	
	async getExample( cmd: AnalyzeDoc ): Promise<string>{
		
		return new Promise<string>( async ( resolve, reject ) => {
			
			if (!this.ready){
				vscode.window.showErrorMessage( 'BlitzMax not ready!' )
				return reject()
			}
			
			let text = await readFile( await this.hasExample( cmd ) )
			
			return resolve( text )
		})
	}
	
	async showExample( cmd: AnalyzeDoc, showAbout: boolean ){
		return new Promise<string>( async ( resolve, reject ) => {
			
			if (!this.ready){
				vscode.window.showErrorMessage( 'BlitzMax not ready!' )
				return reject()
			}
			
			let doc: vscode.TextDocument
			
			if (showAbout){
				let text: string = 'rem ' + cmd.regards.name
				text += '\n\ninfo: ' + cmd.info
				if (cmd.aboutStripped ) text += '\n\nabout: ' + cmd.aboutStripped
				text += '\nendrem\n'
				
				if (await this.hasExample( cmd )){
					text += '\n\' example:\n'
					text += await this.getExample( cmd )
				}
				
				doc = await vscode.workspace.openTextDocument( { content: text, language: 'blitzmax' } )
			}else{
				const uri = vscode.Uri.parse( 'file:' + await this.hasExample( cmd ) )
				doc = await vscode.workspace.openTextDocument( uri )
			}
			
			await vscode.window.showTextDocument( doc, { preview: true, viewColumn: vscode.ViewColumn.Active } )
			
			return resolve()
		})
	}
	
	warnNotReady(): boolean{
		if (this.ready) return false
		
		if (this.problem)
			vscode.window.showErrorMessage( 'BlitzMax is not ready yet: ' + this.problem )
		else
			vscode.window.showErrorMessage( "BlitzMax is not ready yet" )
		return true
	}
}
export let BlitzMax: BlitzMaxHandler = new BlitzMaxHandler()
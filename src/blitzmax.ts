'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { scanModules, BmxModule, AnalyzeDoc, AnalyzeItem } from './bmxModules'
import { exec, exists, readFile, log, clearLog, currentBmx } from './common'

export class BlitzMaxHandler{
	
	_modules: Map<string, BmxModule> = new Map()
	_commands: AnalyzeDoc[] = []
	_autoCompletes: vscode.CompletionItem[] = []
	_autoCompleteMethods: vscode.CompletionItem[] = []
	_symbols: vscode.DocumentSymbol[] = []
	
	private _troubleshootString: string = 'More info at: https://marketplace.visualstudio.com/items?itemName=Hezkore.blitzmax#troubleshooting'
	private _ready: boolean = false
	private _readyToBuild: boolean = false
	private _busy: boolean = false
	private _path: string = ''
	private _problem: string | undefined
	private _legacy: boolean = false
	private _version:string = 'Unknown'
	private _bccVersion: string = '0.0'
	private _bmkVersion: string = '0.0'
	private _releaseVersion: string = '0.0.0.0'
	private _askedForPath: boolean = false
	useNotificationProgress: boolean = false
	useCustomProgressName: string | undefined
	
	get path(): string {
		
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 1) {
			this.findPathQuick()
			console.log( 'NOW: ' + this._path )
		}
		
		return this._path
	}
	get binPath(): string{
		
		return path.join( this.path, 'bin' )
	}
	
	get modPath(): string{
		
		return path.join( this.path, 'mod' )
	}
	get modules(): Map<string, BmxModule> { return this._modules }
	get ready(): boolean { return this._ready }
	get readyToBuild(): boolean { return this._readyToBuild }
	get busy(): boolean { return this._busy }
	get problem(): string | undefined { return this._problem }
	set problem( message:string | undefined ) {
		
		vscode.window.showErrorMessage( 'BlitzMax Error: ' + message )
		console.log( 'BlitzMax Error: ', message )
		log( 'Error: ' + message, true, true )
		log( this._troubleshootString )
	}
	get legacy(): boolean { return this._legacy }
	get bccVersion(): string { return this._bccVersion }
	get bmkVersion(): string { return this._bmkVersion }
	get version(): string { return this._version }
	get releaseVersion(): string { return this._releaseVersion }
	get supportsVarSubOutput(): boolean{
		
		// Minimum bmk NG version is 3.39
		if (this._legacy || BlitzMax.bmkVersion < '3.39' )
			return false
		
		return true
	}
	
	public supportsOutputPath( outPath: string | undefined ): boolean {
		
		if (this.supportsVarSubOutput || !outPath || outPath.length <= 0)
			return true
		
		if (outPath.includes( '${' ) && outPath.includes( '}' ))
			return false
		
		if (!fs.existsSync( path.dirname( outPath ) ))
			return false
		else
			console.log( 'Exists: ' + path.dirname( outPath ))
		
		return true
	}
	
	async setup( context: vscode.ExtensionContext ){
		
		if (this.busy) return
		
		this._busy = true
		this._askedForPath = false
		this._problem = ''
		this._ready = false
		this._readyToBuild = false
		this._legacy = false
		this._path = ''
		
		const initText = this.useCustomProgressName ? this.useCustomProgressName : 'Initializing BlitzMax'
		this.useCustomProgressName = undefined
		
		clearLog()
		log( initText )
		
		await vscode.window.withProgress( {
			location: this.useNotificationProgress ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window,
			title:  initText,
			cancellable: false
		}, (progress, token) => { return new Promise<boolean>( async ( resolve, reject ) => {
			
			this.useNotificationProgress = false
			
			await this.findPath()
			if (this.path.length <= 1) {
				this._busy = false
				this.problem = 'No BlitzMax path set'
				return resolve()
			}
			
			await this.checkVersion()
			if (this.problem) {
				this._busy = false
				log( 'Unable to determine BlitzMax version', true, true )
				return resolve()
			}
			
			this._readyToBuild = true
			
			progress.report( {message: 'scanning modules'} )
			
			await scanModules( context )
			
			progress.report( {message: 'ready'} )
			
			this._ready = true
			this._busy = false
			log( `BlitzMax ${this.version} Ready!` )
			
			if (!this.supportsVarSubOutput) {
				log()
				log( '*Notice* task.json output is NOT supported on this version of BlitzMax', true, true )
				log( this._troubleshootString )
			}
			
			return resolve()
			})
		})
	}
	
	async findPath(){
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
	
	private findPathQuick() {
		let confPath: string | undefined = vscode.workspace.getConfiguration( 'blitzmax', currentBmx() ).get( 'bmxPath' )
		if (confPath) this._path = confPath
		this._askedForPath = true
	}
	
	private async askForPath( msg:string = 'BlitzMax path not set in extension configuration' ){
		
		const opt = await vscode.window.showErrorMessage( msg, 'Set Path' )
		if (opt) this.showSelectBlitzMaxPath()
	}
	
	async showSelectBlitzMaxPath() {
		
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
	
	getModule( name: string ): BmxModule | undefined {
		
		if (!this.ready) return undefined
		
		let parent: string = ''
		name = name.toLowerCase()
		
		if (name.includes( '.' )) {
			parent = name.split( '.' )[0] + '.mod'
			name = name.split( '.' )[1] + '.mod'
		}
		
		return this._modules.get( parent + "/" + name )
	}
	
	getAppStubs(): BmxModule[] | undefined {
		
		if (!this.ready) return undefined
		
		let modules: BmxModule[] = []
		
		this._modules.forEach( module => {
			
			if(module.name && module.name.toLocaleLowerCase().endsWith( '.appstub' ))
				modules.push( module )
		})
		
		return modules
	}
	
	searchCommand( name: string, fromType: boolean = false, fromModules: string[] = [] ): AnalyzeDoc | undefined {
		
		if (!this.ready) return
		name = name.toLowerCase()
		
		for (let i = 0; i < this._commands.length; i++) {
			const cmd = this._commands[i]
			
			// Apply module filter
			if (fromModules.length > 0) {
				if (!fromModules.includes( cmd.module )) continue
			}
			
			// Apply type filter
			if (!cmd.regards.inside == fromType) continue
			
			// Is this a match?
			if (cmd.searchName == name) return cmd
		}
		
		return
	}
	
	searchCommands( name: string, fromType: boolean = false, fromModules: string[] = [] ): AnalyzeDoc[] {
		
		if (!this.ready) return []
		name = name.toLowerCase()
		let result: AnalyzeDoc[] = []
		
		for (let i = 0; i < this._commands.length; i++) {
			const cmd = this._commands[i]
			
			// Apply module filter
			if (fromModules.length > 0) {
				if (!fromModules.includes( cmd.module )) continue
			}
			
			// Apply type filter
			if (!cmd.regards.inside == fromType) continue
			
			// Is this a match?
			if (cmd.searchName == name) result.push( cmd )
		}
		
		return result
	}
	
	getAllCommands(): AnalyzeDoc[]{
		
		if (!this.ready) return []
		return this._commands
	}
	
	private _processAutoCompleteSymbol( symbol: vscode.DocumentSymbol, allowMethod: boolean, tree: vscode.DocumentSymbol[] ):  vscode.CompletionItem | undefined {
		
		if (!allowMethod){
			switch (symbol.kind) {
				case vscode.SymbolKind.Method:
				case vscode.SymbolKind.Field:
					return undefined
			}
		}
		
		if (allowMethod){
			switch (symbol.kind) {
				case vscode.SymbolKind.Class:
					return undefined
			}
		}
		
		let kind: vscode.CompletionItemKind = vscode.CompletionItemKind.Text
		let kindName: string = ''
		
		// Ugh how do I convert this automatically?!
		switch (symbol.kind) {
			case vscode.SymbolKind.Class:
				kind = vscode.CompletionItemKind.Class
				kindName = 'Type'
				break
				
			case vscode.SymbolKind.Variable:
				kind = vscode.CompletionItemKind.Variable
				kindName = 'Variable'
				break
			
			case vscode.SymbolKind.Method:
				kind = vscode.CompletionItemKind.Method
				kindName = 'Method'
				break
			
			case vscode.SymbolKind.Function:
				kind = vscode.CompletionItemKind.Function
				kindName = 'Function'
				break
			
			case vscode.SymbolKind.Interface:
				kind = vscode.CompletionItemKind.Interface
				kindName = 'Interface'
				break
			
			case vscode.SymbolKind.Enum:
				kind = vscode.CompletionItemKind.Enum
				kindName = 'Enum'
				break
			
			case vscode.SymbolKind.Struct:
				kind = vscode.CompletionItemKind.Struct
				kindName = 'Struct'
				break
			
			case vscode.SymbolKind.Constant:
				kind = vscode.CompletionItemKind.Constant
				kindName = 'Const'
				break
			
			case vscode.SymbolKind.Field:
				kind = vscode.CompletionItemKind.Field
				kindName = 'Field'
				break
		}
		
		// Construct item with our symbol
		const item = new vscode.CompletionItem( symbol.name, kind )
		item.documentation = new vscode.MarkdownString()
		.appendCodeblock( kindName + ' ' + symbol.name, 'blitzmax' )
		//.appendMarkdown( tree[0].name )
		.appendMarkdown( '\r\r*' + `Line ${symbol.selectionRange.start.line + 1}` + '*' )
		
		// Prettify document insert data
		item.insertText = new vscode.SnippetString( symbol.name )
		switch (item.kind) {
			case vscode.CompletionItemKind.Function:
			case vscode.CompletionItemKind.Method:
				item.insertText.appendText( '(' )
				item.insertText.appendPlaceholder( '' )
				item.insertText.appendText( ')' )
				break
		}
		
		return item
	}
	
	private _processAutoCompleteSymbolChild( parent: vscode.DocumentSymbol[], output: vscode.CompletionItem[], allowMethod: boolean, tree: vscode.DocumentSymbol[] = [] ) {
		
		parent.forEach( child => {
			
			const item = this._processAutoCompleteSymbol( child, allowMethod, tree )
			if (item) output.push( item )
			
			if (child.children)
				this._processAutoCompleteSymbolChild( child.children, output, allowMethod, tree )
		})
	}
	
	getAutoCompleteSymbols( allowMethod: boolean ): vscode.CompletionItem[] {
		
		if (!this.ready) return []
		
		let autoSymbols: vscode.CompletionItem[] = []
		this._processAutoCompleteSymbolChild( this._symbols, autoSymbols, allowMethod )		
		return autoSymbols
	}
	
	
	getAutoCompletes(): vscode.CompletionItem[]{
		
		if (!this.ready) return []
		
		if (this._autoCompletes.length <= 0) this.generateAutoCompletes()
		return this.getAutoCompleteSymbols( false ).concat( this._autoCompletes )
	}
	
	getAutoCompleteMethods(): vscode.CompletionItem[]{
		
		if (!this.ready) return []
		
		// Not a typo! Use _autoCompletes for this as well
		if (this._autoCompletes.length <= 0) this.generateAutoCompletes()
		return this.getAutoCompleteSymbols( true ).concat( this._autoCompleteMethods )
	}
	
	private generateAutoCompletes() {
		
		console.log( 'Generating auto completes' )
		
		const cmds = this.getAllCommands()
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
			
			// Push the complete item to the correct stack
			if (cmd.regards.type == 'method')
				this._autoCompleteMethods.push(item)
			else
				this._autoCompletes.push(item)			
		}
	}
	
	private async checkVersion(){
		
		this._version = 'Unknown'
		this._bccVersion = '0.0'
		this._bmkVersion = '0.0'
		this._releaseVersion = '0.0.0.0'
		
		// First we check the bcc version
		try {
			let {stdout, stderr} = await exec( path.join( this.binPath, 'bcc' ) )
			
			if (stderr && stderr.length > 0)
			{
				this.problem = stderr
				return
			}
			
			if (stdout) {
				let spaceSplit: string[] = stdout.trim().split(' ')
				this._bccVersion = spaceSplit[spaceSplit.length - 1]
				
				if (stdout.toLowerCase().startsWith('blitzmax release version'))
				{
					this._legacy = true
					this._version = `Legacy`
				}else{
					this._legacy = false
					this._version = `NG`
				}
				
				log(`\tBCC Version: ${this._bccVersion}`)
			}
		} catch(err) {
			this._problem = 'Unable to determine BlitzMax version'
			this.askForPath( 'Make sure your BlitzMax path is correct.' )
			return
		}
		
		// Secondly we check the bmk version
		// Notice that Legacy bmk doesn't even provide a bmk version ¯\_(ツ)_/¯
		if (!this._legacy) {
			try {
				let {stdout, stderr} = await exec( path.join( this.binPath, 'bmk' ), ['-v'] )
				
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
					}else{
						this.problem = 'Unable to determine bmk version'
						return
					}
				}
			} catch(err) {
				this._problem = 'Unable to determine bmk version'
				this.askForPath( 'Make sure your BlitzMax path is correct' )
				return
			}
		}
		
		this._releaseVersion = `${this._bccVersion}.${this._bmkVersion}`
		log( '\tBlitzMax Version: ' + this.releaseVersion )
	}
	
	async hasExample( cmd: AnalyzeDoc ): Promise<string>{
		return new Promise<string>( async ( resolve, reject ) => {
			
			if (!this.ready){
				vscode.window.showErrorMessage( 'BlitzMax not ready!' )
				return resolve()
			}
			
			// File length must be greater than 4
			// .bmx is 4 letters by itself!
			if (!cmd || !cmd.regards || !cmd.regards.file || cmd.regards.file.length <= 4)
				return resolve( '' )
			
			// Check if we already have the path
			if (!cmd.examplePath) {
				
				// Find the path
				const exampleFolders = ['doc', 'docs', 'example', 'examples', 'test', 'tests']
				
				// Todo: This needs to be fixed up!
				// NEVER assume that .bmx will be lowercase
				
				for (let i = 0; i < exampleFolders.length; i++) {
					
					const examplePath = path.join( BlitzMax.path,
						path.dirname( cmd.regards.file ),
						exampleFolders[i],
						cmd.searchName + '.bmx'
					)
					
					if (await exists( examplePath )) {
						cmd.examplePath = examplePath
						break
					}
				}
				
			}
			
			return resolve( cmd.examplePath )
		})
	}
	
	async getExample( cmd: AnalyzeDoc ): Promise<string>{
		
		return new Promise<string>( async ( resolve, reject ) => {
			
			if (!this.ready){
				vscode.window.showErrorMessage( 'BlitzMax not ready!' )
				return reject()
			}
			
			return resolve( await readFile( await this.hasExample( cmd ) ) )
		})
	}
	
	/*
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
	*/
	
	warnNotReadyToBuild(): boolean{
		if (this.readyToBuild) return false
		
		if (this.problem)
			vscode.window.showErrorMessage( 'BlitzMax is not ready to build yet: ' + this.problem )
		else
			vscode.window.showErrorMessage( "BlitzMax is not ready to build yet" )
		return true
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
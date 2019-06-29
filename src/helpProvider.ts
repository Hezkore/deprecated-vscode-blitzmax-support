'use strict'

import * as vscode from 'vscode'
import { bmxPath, updateBinPath, exists } from './common'
import * as path from 'path'
import * as fs from 'fs'

export let cacheState:number = 0
export let helpStack:Array<HelpObject> = []

export async function showHelp( word:string ){
	
	if (cacheState <= 0){ await cacheHelp( true ) }
	if (cacheState < 2 || !word){ return }
	
	console.log( 'Searching through ' + helpStack.length + ' help items' )
	
	//vscode.window.showInformationMessage( 'NO HELP FOR: ' + word )
}

export async function cacheHelp( showErrorInfo:boolean = false, force:boolean = false ){
	
	if (cacheState > 0  && force == false){ return }
	cacheState = 1
	
	await updateBinPath( true )
	if (!bmxPath){ 
		
		if (showErrorInfo) {
			vscode.window.showInformationMessage( 'Please set your BlitzMax path first' )
		}
		cacheState = 0
		return
	}
	
	let docsPath = path.join( bmxPath, 'docs', 'html', 'Modules', 'commands.txt' )
	
	if (!await exists( docsPath )){
		
		if (showErrorInfo) {
			vscode.window.showInformationMessage( 'Please rebuild docs first in MaxIDE' )
		}
		cacheState = 0
		return
	}
	
	await fs.readFile( docsPath, 'utf8', (err, data) => {
		
		if(err) {
			console.error( 'Error reading file' , err)
			cacheState = 0
			return
		}
		
		let fill:string = '' 
		let stage = HelpConstructStage.name
		let paramStage = HelpParamStage.name
		let hObj:HelpObject = new HelpObject
		
		for(var i=0; i<data.length; i++){
			const char = data.charAt( i )
			if (!char){ continue }
			
			switch(char) {
				case '\n':
					if (hObj && hObj.name) {
						
						hObj.finish()
						helpStack.push( hObj )
					}
					//console.log( hObj )
					stage = HelpConstructStage.name
					paramStage = HelpParamStage.name
					fill = ''
					hObj = new HelpObject
					//return
					break
					
				case '%':
				case '#':
				case '!':
				case '$':
					let short:string = 'Unknown'
					switch (char) {
						case '%':
							short = 'Int'
							break
						case '#':
							short = 'Float'
							break
						case '!':
							short = 'Double'
							break
						case '$':
							short = 'String'
							break
					}
					
					if (stage == HelpConstructStage.name) {
						hObj.return = short
						fill = ''
					}
					
					if (stage == HelpConstructStage.param) {
						paramStage = HelpParamStage.default
						hObj.param[ hObj.param.length - 1 ].type = short
						fill = ''
					}
					
				case ':':
					if (fill.endsWith( ' ' )){
						
						if (stage !== HelpConstructStage.desc) {
							
							if (stage == HelpConstructStage.name){
								hObj.kind = vscode.CompletionItemKind.Keyword
							}
							
							stage = HelpConstructStage.desc
							fill = ''
						}
					}else{
						
						if (stage == HelpConstructStage.name) {
							stage = HelpConstructStage.return
							fill = ''
						}
						
						if (stage == HelpConstructStage.param) {
							paramStage = HelpParamStage.type
							fill = ''
						}
					}
					break
				
				case ',':
					if (stage == HelpConstructStage.param) {
						paramStage = HelpParamStage.name
						hObj.param.push( new HelpParam )
						fill = ''
					}
					break
					
				case '=':
					if (stage == HelpConstructStage.name||stage == HelpConstructStage.return) {
						hObj.kind = vscode.CompletionItemKind.Variable
						stage = HelpConstructStage.default
						fill = ''
					}
					if (stage == HelpConstructStage.param) {
						paramStage = HelpParamStage.default
						fill = ''
					}
					break
					
				case '|':
					if (stage !== HelpConstructStage.docs) {
						
						if (stage == HelpConstructStage.name||stage == HelpConstructStage.return){
							hObj.kind = vscode.CompletionItemKind.Value
						}
						
						stage = HelpConstructStage.docs
						fill = ''
					}
					break
					
				case '(':
					if (stage < HelpConstructStage.param) {
						hObj.kind = vscode.CompletionItemKind.Method
						stage = HelpConstructStage.param
						paramStage = HelpParamStage.name
						fill = ''
					}
					break
					
				case ')':
					if (stage == HelpConstructStage.param) {
						stage = HelpConstructStage.desc
						fill = ''
					}
					break
					
				default:
					if (fill.length <= 0 && char == ' ') { continue }
					fill += char
					
					switch (stage) {
						case HelpConstructStage.name:
							hObj.name += char
							break
							
						case HelpConstructStage.return:
							hObj.return += char
							break
							
						case HelpConstructStage.default:
							hObj.default += char
							break
							
						case HelpConstructStage.param:
							switch (paramStage) {
								case HelpParamStage.name:
									if (char == ' ') { break }
									if (hObj.param.length <= 0) {
								
										hObj.param.push( new HelpParam )
									}
									hObj.param[ hObj.param.length - 1 ].name += char
									break
									
								case HelpParamStage.type:
									hObj.param[ hObj.param.length - 1 ].type += char
									break
									
								case HelpParamStage.default:
									hObj.param[ hObj.param.length - 1 ].default += char
									break
							}
							break
							
						case HelpConstructStage.desc:
							hObj.desc += char
							break
							
						case HelpConstructStage.docs:
							hObj.docs += char
							break
							
						default:
							break
					}
					break
			}
		}
		
		cacheState = 2
		return
	})
}

enum HelpConstructStage {
	
	name = 0,
	return = 1,
	default = 2,
	param = 3,
	desc = 4,
	docs = 5
}

enum HelpParamStage {
	
	name = 0,
	type = 1,
	default = 2
}

export class HelpObject {
	name:string = ''
	infoName:string = ''
	return:string = ''
	default:string = ''
	param:Array<HelpParam> = []
	desc:string = ''
	docs:string = ''
	insert:string = ''
	module:string = ''
	kind?:vscode.CompletionItemKind
	
	// Method to clean up fields
	finish () {
		
		// Cleanup
		if (this.return.startsWith( ' ' )){ this.return = this.return.slice( 1 ) }
		if (this.return.endsWith( ' ' )){ this.return = this.return.slice( 0 , -1 ) }
		if (this.default.startsWith( ' ' )){ this.default = this.default.slice( 1 ) }
		if (this.default.endsWith( ' ' )){ this.default = this.default.slice( 0 , -1 ) }
		if (this.desc.startsWith( ' ' )){ this.desc = this.desc.slice( 1 ) }
		if (this.desc.endsWith( ' ' )){ this.desc = this.desc.slice( 0 , -1 ) }
		if (this.docs.startsWith( ' ' )){ this.docs = this.docs.slice( 1 ) }
		if (this.docs.endsWith( ' ' )){ this.docs = this.docs.slice( 0 , -1 ) }
		
		// Some kind testing
		if (this.name.toLowerCase().split( ' extends ' ).length > 1){
			this.kind = vscode.CompletionItemKind.Interface
		}
		
		// Setup informative name start
		this.infoName = this.name
		if (this.return){ this.infoName += ':' + this.return }
		
		// Setup auto-complete 'insert' field start
		this.insert = this.name
		
		// Return - More annoying than anything
		//if (this.return){ this.insert += ':' + this.return }
		
		// Params
		if (this.param.length > 0){
			
			this.insert += '( '
			this.infoName += '( '
			
			let insIndex = 1
			for(var i=0; i<this.param.length; i++){
				
				this.param[i].clean()
				if (i>=this.param.length-1){ insIndex = 0 }
				
				this.insert += '${' + insIndex + ':' + this.param[i].name + ':' + this.param[i].type
				this.infoName += this.param[i].name + ':' + this.param[i].type
				
				if (this.param[i].default){
					
					this.insert += ' = ' + this.param[i].default
					this.infoName += ' = ' + this.param[i].default
				}
				
				this.insert += '}'
				
				insIndex ++
				if (i<this.param.length-1){
					
					this.insert += ', '
					this.infoName += ', '
				}
			}
			
			this.insert += ' )'
			this.infoName += ' )'
		}else{
			// Make sure auto complete always inserts () for methods and functions
			if (this.kind == vscode.CompletionItemKind.Method){
				this.insert += '()'
				this.infoName += '()'
			}
		}
		
		// Make sure auto complete always inserts = for variables
		if (this.kind == vscode.CompletionItemKind.Variable){
			
			if (this.default){
				
				this.infoName += ' = ' + this.default
				this.insert += ' = ${0:' + this.default + '}'
			}else{
				
				this.insert += ' = ${0}'
			}
		}
		
		// Module (from docs path)
		if (this.docs.length > 1){
			
			let modSearch = this.docs.split( '/' )
			if (modSearch.length > 1){
				for(var i=0; i<modSearch.length; i++){
					
					if (modSearch[i].toLowerCase() == 'modules'||modSearch[i].toLowerCase() == 'mod'){
						this.module = modSearch[i+1]
						this.module += ' / ' + modSearch[i+2]
						
						//console.log( this.module )
						break
					}
				}
			}else{
				console.log( this.name + ' belongs to no module? - ' + this.docs )
			}
		}else{
			console.log( this.name + ' has no docs? - ' + this.docs )
		}
		
		// Debug
		/*if (this.name.startsWith( "CAIRO_SURFACE_TYPE_WIN32_PRINTING" )) {
			console.log( this )
		}*/
	}
}

class HelpParam {
	name:string = ''
	type:string = ''
	default:string = ''
	
	clean() {
		if (this.name.startsWith( ' ' )){ this.name = this.name.slice( 1 ) }
		if (this.name.endsWith( ' ' )){ this.name = this.name.slice( 0 , -1 ) }
		if (this.type.startsWith( ' ' )){ this.type = this.type.slice( 1 ) }
		if (this.type.endsWith( ' ' )){ this.type = this.type.slice( 0 , -1 ) }
		if (!this.type){ this.type = 'Int' }
		if (this.default.startsWith( ' ' )){ this.default = this.default.slice( 1 ) }
		if (this.default.endsWith( ' ' )){ this.default = this.default.slice( 0 , -1 ) }
    }
}
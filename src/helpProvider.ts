'use strict'

import * as vscode from 'vscode'
import { bmxPath, updateBinPath, exists } from './common'
import * as path from 'path'
import * as fs from 'fs'

let cacheState:number = 0
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
						
						stage = HelpConstructStage.desc
						fill = ''
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
					if (stage == HelpConstructStage.param) {
						paramStage = HelpParamStage.default
						fill = ''
					}
					break
					
				case '|':
					if (stage !== HelpConstructStage.docs) {
						stage = HelpConstructStage.docs
						fill = ''
					}
					break
					
				case '(':
					if (stage < HelpConstructStage.param) {
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
	param = 2,
	desc = 3,
	docs = 4
}

enum HelpParamStage {
	
	name = 0,
	type = 1,
	default = 2
}

export class HelpObject {
	name:string = ''
	prettyName:string = ''
	return:string = ''
	param:Array<HelpParam> = []
	desc:string = ''
	docs:string = ''
	insert:string = ''
	module:string = ''
	
	finish () {		
		this.insert = this.name
		if (this.return){ this.insert += ':' + this.return }
		if (this.param.length > 0){
			this.insert += '( '
			let insIndex = 1
			for(var i=0; i<this.param.length; i++){
				this.param[i].clean()
				if (i>=this.param.length-1){ insIndex = 0 }
				this.insert += '${' + insIndex + ':' + this.param[i].name + ':' + this.param[i].type + '}'
				insIndex ++
				//if (this.param[i].default !== ''){ this.insert += ' = ' + this.param[i].default }
				if (i<this.param.length-1){ this.insert += ', ' }
			}
			this.insert += ' )'
		}
		
		if (this.docs.length > 1){
			
			let modSearch = this.docs.split( '/' )
			if (modSearch.length > 1){
				for(var i=0; i<modSearch.length; i++){
					
					if (modSearch[i].toLowerCase() == 'modules'){
						this.module = modSearch[i+1]
						
						if (modSearch[i+1].toLowerCase() !== modSearch[i+2].toLowerCase()){
							this.module += '/' + modSearch[i+2]
						}
						
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
		
	}
}

class HelpParam {
	name:string = ''
	type:string = ''
	default:string = ''
	
	clean() {
		if (this.type.startsWith( ' ' )){ this.type = this.type.slice( 1 ) }
		if (this.type.endsWith( ' ' )){ this.type = this.type.slice( 0 , -1 ) }
		if (!this.type){ this.type = 'Int' }
    }
}
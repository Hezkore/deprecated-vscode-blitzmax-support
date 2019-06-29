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

export async function cacheHelp( showErrorInfo:boolean ){
	
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
						
						for(var i2=0; i2<hObj.param.length; i2++){
							hObj.param[i2].clean()
						}
						helpStack.push( hObj )
					}
					//console.log( hObj )
					stage = HelpConstructStage.name
					fill = ''
					hObj = new HelpObject
					//return
					break
					
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
	return:string = ''
	param:Array<HelpParam> = []
	desc:string = ''
	docs:string = ''
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
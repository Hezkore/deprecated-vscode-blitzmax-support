'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { readFile, readDir, readStats, writeFile, exists } from './common'
import { BlitzMax } from './blitzmax'

export interface BmxModule{
	name?: string,
	parent: string,
	folderName: string,
	file: string,
	lastModified: number,
	commands?: AnalyzeDoc[]
}

let modules: Map<string, BmxModule> = new Map()
export let commands: Map<string, AnalyzeDoc> = new Map()

export async function scanModules( context: vscode.ExtensionContext, forceUpdate:boolean = false ) {
	
	if (BlitzMax.problem) return
	
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Scanning BlitzMax modules",
		cancellable: false
	}, (progress, token) => { return new Promise(async function(resolve, reject) {
			
			modules.clear()
			commands.clear()
			
			let changedModules: number = 0
			
			// Load existing modules
			let modJsonPath: string = path.join( context.extensionPath, 'modules.json' )
			if (await exists( modJsonPath )){
				modules = modulesFromJson( await readFile( modJsonPath ) )
			}else{
				//console.log( 'No cached modules' )
			}
			
			// Create an array of existing modules
			let modArray: string[] = []
			if (modules && modules.size > 0){
				modArray = Array.from( modules.keys() )
			}
			
			// Make sure modules are up to date
			const parentDir = await readDir( BlitzMax.modPath )
			for(var i=0; i<parentDir.length; i++){
				
				await progress.report({ increment: 100.0 / parentDir.length })
				
				// Skip unknown stuff
				if (!parentDir[i].toLowerCase().endsWith( '.mod' )) continue
				
				// Scan parent subfolders
				const modDir = await readDir( path.join( BlitzMax.modPath, parentDir[i] ) )
				for(var i2=0; i2<modDir.length; i2++){
					
					const keyName = parentDir[i] + "/" + modDir[i2]
					const fileName = modDir[i2].split( '.mod' )[0] + '.bmx'
					
					// Skip unknown stuff
					if (!keyName.toLowerCase().endsWith( '.mod' )) continue
					
					// Attempt to grab existing mod
					let mod = modules.get( keyName )
					
					// Check out these stats!
					const stats = await readStats( path.join( BlitzMax.modPath, parentDir[i], modDir[i2] ) )
					const bmxStats = await readStats( path.join( BlitzMax.modPath, parentDir[i], modDir[i2], fileName ) )
					let newestTime = stats.mtimeMs
					if (bmxStats.mtimeMs > newestTime) newestTime = bmxStats.mtimeMs
					
					// Remove it from our array
					if (modArray && modArray.length > 0){
						for(var i3=0; i3<modArray.length; i3++){
							
							if (modArray[i3] == keyName){
								
								modArray.splice(i3, 1)
								break
							}
						}
					}
					
					// Does this module need to be updated?
					if (forceUpdate || !mod || newestTime != mod.lastModified){
						
						modules.set( keyName, {
							parent: parentDir[i],
							folderName: modDir[i2],
							file: path.join( parentDir[i], modDir[i2], fileName ),
							lastModified: newestTime
						})
						
						mod = modules.get( keyName )
						if (!mod){
							vscode.window.showErrorMessage( "Unable to update module!" )
							return reject()
						}
						
						// Make sure module entry point exists..
						if (await exists( path.join( BlitzMax.modPath, mod.file ) )){
							
							await progress.report( {message: keyName } )
							
							await updateModule( mod )
							changedModules++
						}else{
							
							//console.log( "NO ENTRY POINT FOR: " + mod.file )
						}
					}
					
					// Turn docs into commands
					if (mod && mod.commands && mod.commands.length){
						for(var i3=0; i3<mod.commands.length; i3++){
							
							if (mod.commands[i3].searchName.length > 0){
								commands.set( mod.commands[i3].searchName, mod.commands[i3] )
							}
						}
					}
				}
			}
			
			// Look for any modules left in our array
			if (modArray && modArray.length > 0){
				for(var i3=0; i3<modArray.length; i3++){
					
					console.log( 'Module', modArray[i3], 'was removed' )
					
					modules.delete( modArray[i3] )
					changedModules++
				}
			}
			
			// Save updated modules
			console.log( 'Module changes:', changedModules )
			if (changedModules > 0) saveModules( modJsonPath )
			console.log( 'Commands:', commands.size )
			return resolve()
		})
	})
}

async function saveModules( path: string ){
	
	console.log( 'Saving modules' )
	await writeFile( path, modulesToJson( modules ) )
}

async function pause(timeout:number){
	
	return new Promise((fulfill) => {
		
	  setTimeout(fulfill, timeout)
	})
}

async function updateModule( mod: BmxModule ){
	
	//console.log( 'Updating:', mod.parent + "/" + mod.folderName )
	
	return new Promise(async function(resolve, reject) {
		
		//console.log( "UPDATING: " + mod.parent + "/" + mod.folderName )
		
		// Load the module source file
		const data = await readFile( path.join( BlitzMax.modPath, mod.file ) )
		
		// Send the module source to our analyzer
		let result = await analyzeBmx( { data: data, file: path.join( 'mod', mod.file ), module: true, imports: true } )
		
		// Read the analyzer result and apply to our module
		if (result.moduleName){ mod.name = result.moduleName.data }
		if (result.bbdoc){
			mod.commands = result.bbdoc
		}
		
		//console.log( "done" )
		return resolve()
	})
}

export interface AnalyzeOptions{
	data:string,
	file:string,
	module?:boolean,
	imports?:boolean
}
export interface AnalyzeResult{
	moduleName?: AnalyzeItem,
	import?: AnalyzeItem[],
	include?: AnalyzeItem[]
	bbdoc?: AnalyzeDoc[]
}
export interface AnalyzeItem{
	data: string,
	line: number,
	args?: AnalyzeItemArgs[],
	file: string,
	name?: string,
	returns?: string,
	type?: string
}
export interface AnalyzeItemArgs{
	name: string,
	returns: string,
	default?: string
}
export interface AnalyzeDoc{
	info: string,
	line: number,
	about?: string,
	returns?: string,
	regards?: AnalyzeItem,
	searchName: string
}
enum AnalyzeBlock{
	nothing,
	rem,
	bbdocAbout,
}
enum ItemProcessPart{
	type,
	name,
	returns,
	arg,
	argReturn,
	argDefault
}

async function processAnalyzeItem( item: AnalyzeItem ): Promise<AnalyzeItem>{
	
	return new Promise( async function( resolve, reject ) {
		
		let letter: string
		let nextSymbol: string
		let part: ItemProcessPart = ItemProcessPart.type
		let insideString: boolean = false
		let insideArgs: number = 0
		let argCount: number = -1
		
		for(var i=0; i<item.data.length; i++){
			
			letter = item.data[i]
			if (letter == undefined) continue
			if (letter == '"'){
				insideString != insideString
			}
			if (!insideString && letter == "'"){
				continue
			}
			if (!insideString && letter == '('){
				insideArgs++
			}
			if (!insideString && letter == ')'){
				insideArgs--
				if (insideArgs <= 0){
					break
				}else{
					if (part != ItemProcessPart.argReturn){
						continue
					}
				}
			}
			
			nextSymbol = ''
			for(var i2=i+1; i2<item.data.length; i2++){
				
				if (item.data[i2] != ' '){
					
					nextSymbol = item.data[i2]
					break
				}
			}
			
			switch (part) {
				case ItemProcessPart.type:
					
					if (insideString){ break }
					if (item.type == undefined){item.type = ''}
					if (letter != ' '){
						item.type += letter
					}else{
						part = ItemProcessPart.name
					}
					break
					
				case ItemProcessPart.name:
					
					if (insideString){ break }
					if (item.name == undefined){item.name = ''}
					
					if (letter != ' '){
						
						if (letter == ':'){
							part = ItemProcessPart.returns
							break
						}
						
						if (letter == '('){
							part = ItemProcessPart.arg
							argCount++
							break
						}
						
						item.name += letter
					}else{
						
						if (nextSymbol == ':'){
							part = ItemProcessPart.returns
							break
						}
						
						if (nextSymbol == '('){
							part = ItemProcessPart.arg
							argCount++
							break
						}
					}
					
					/*
					if (letter != ' ' && letter != ':' && letter != '('){
						item.name += letter
					}else if(letter == ':') {
						part = ItemProcessPart.returns
					}else{
						part = ItemProcessPart.arg
						argCount++
					}
					*/
					break
					
				case ItemProcessPart.returns:
					
					if (insideString){ break }
					if (item.returns == undefined){item.returns = ''}
					if (letter != '('){
						item.returns += letter
					}else{
						item.returns = item.returns.trim()
						part = ItemProcessPart.arg
						argCount++
					}
					break
					
				case ItemProcessPart.arg:
					
					if (insideString){ break }
					if (letter == ' '){ break }
					if (letter == '('){ break }
					if (letter != ',' && letter != ':' && letter != '='){
						
						if (item.args == undefined){item.args = []}
						
						if (item.args[argCount] == undefined){
							item.args[argCount] = {
								name: letter,
								returns: ''
							}
						}else{
							item.args[argCount].name += letter
						}
						
					}else if(letter == ',') {
						part = ItemProcessPart.arg
						argCount++
					}else if(letter == ':') {
						part = ItemProcessPart.argReturn
					}else{
						part = ItemProcessPart.argDefault
					}
					break
					
				case ItemProcessPart.argReturn:
					
					if (insideString) break
					if (item.args == undefined) item.args = []
					if (item.args[argCount] == undefined) {
						
						console.log( item.file + " line: " + item.line + " data: " + item.data )
					}
					if (letter != ',' && letter != '='){
						
						item.args[argCount].returns += letter
					}else if(letter == ',') {
						
						item.args[argCount].returns = item.args[argCount].returns.trim()
						
						part = ItemProcessPart.arg
						argCount++
					}else{
						
						item.args[argCount].returns = item.args[argCount].returns.trim()
						
						part = ItemProcessPart.argDefault
					}
					break
					
				case ItemProcessPart.argDefault:
					
					if (!insideString && letter == ' '){ break }
					if (insideString || !insideString && letter != ','){
						
						if (item.args == undefined){item.args = []}
						if (item.args[argCount].default == undefined){
							item.args[argCount].default = ''
						}
						
						item.args[argCount].default += letter
					}else{
						part = ItemProcessPart.arg
						argCount++
					}
					break
			}
		}
		
		return resolve( item )
	})
}

async function analyzeBmx( options: AnalyzeOptions ): Promise<AnalyzeResult>{
	
	return new Promise( async function( resolve, reject ) {
		
		let lines = options.data.split( "\n" )
		
		if (lines.length <= 0) return resolve()
		
		let line: string = ''
		let sliceLine: string = ''
		let nextLine: string = ''
		let lineLower: string = ''
		let result: AnalyzeResult = {}
		let insideHistory: AnalyzeBlock[] = []
		let inside: AnalyzeBlock | undefined = AnalyzeBlock.nothing
		let regardsParent: AnalyzeDoc | undefined
		
		for(var i=0; i<lines.length; i++){
			
			// Current line
			if (lines[i].length <= 0) continue
			if (lines[i].startsWith( `'` )) continue
			line = lines[i].trim()
			if (line.length <= 0) continue
			lineLower = line.toLowerCase()
			sliceLine = line
			
			// Next line
			if (i+1 < lines.length){
				nextLine = lines[i+1].trim()
				if (nextLine.length > 0) nextLine = nextLine.toLowerCase()
			}else{ nextLine = '' }
			
			// Find what the BBDoc item regards (next line)
			if (regardsParent && inside < AnalyzeBlock.rem && !line.startsWith( '?' )){
				
				regardsParent.regards = await processAnalyzeItem({
					line: i,
					file: options.file,
					data: line
				})
				
				if (regardsParent.regards.name){
					regardsParent.searchName = regardsParent.regards.name.toLowerCase()
				}
				
				// Push our now complete tmp bbdock into our array
				if (!result.bbdoc){ result.bbdoc = [] }
				if (regardsParent.regards.name){
					result.bbdoc.push( regardsParent )
				}
				
				regardsParent = undefined
			}
			
			switch (inside) {
				case AnalyzeBlock.nothing:
				case undefined:
					
					// Read line data		
					if (lineLower.startsWith( 'import ' )){
						
						if (!result.import){ result.import = [] }
						result.import.push({
							line: i,
							file: options.file,
							data: line.slice( 'import '.length )
						})
						break
					}
					
					if (lineLower.startsWith( 'include ' )){
						
						if (!result.include){ result.include = [] }
						result.include.push({
							line: i,
							file: options.file,
							data: line.slice( 'include '.length )
						})
						break
					}
					
					if (lineLower == 'rem' || lineLower.startsWith( 'rem ' )){
						
						if (inside){ insideHistory.push( inside ) }
						inside = AnalyzeBlock.rem
						break
					}
					
					// Module related information
					if (options.module){
						if (lineLower.startsWith( 'module ' )){
							
							result.moduleName ={
								line: i,
								file: options.file,
								data: line.slice( 'module '.length )
							}
							break
						}
					}
					
					break
				
				case AnalyzeBlock.rem:
					
					if (lineLower.replace( ' ', '' ) == 'endrem'){
						
						inside = insideHistory.pop()
						break
					}
					
					if (lineLower.startsWith( 'bbdoc:' )){
						
						// Create a tmp new bbdoc
						regardsParent = {
							line: i,
							info: line.slice( 'bbdoc:'.length ).trim(),
							searchName: ''
						}
						
						break
					}
					
					if (lineLower.startsWith( 'returns:' )){
						
						if (!regardsParent){ break }
						
						sliceLine = line.slice( 'returns:'.length ).trim()
						if (result.bbdoc){
							
							if (sliceLine.length > 0){
								regardsParent.returns = sliceLine
							}else{
								regardsParent.returns = ''
							}	
						}
						
						break
					}
					
					if (lineLower.startsWith( 'about:' )){
						
						if (!regardsParent) break
						
						sliceLine = line.slice( 'about:'.length ).trim()
						if (result.bbdoc){
							
							if (sliceLine.length > 0){
								regardsParent.about = sliceLine
							}else{
								regardsParent.about = ''
							}	
						}
						
						// Is this a multi-lined about block?
						if (nextLine.replace( ' ', '' ) == 'endrem'){
							
							
						}else{
							
							if (inside) insideHistory.push( inside )
							inside = AnalyzeBlock.bbdocAbout
						}
						
						break
					}
					
					break
				
				case AnalyzeBlock.bbdocAbout:
					
					if (!regardsParent){
						inside = insideHistory.pop()
						break
					}
					if (regardsParent.about) regardsParent.about += '\n'
					regardsParent.about += line
					
					if (nextLine.replace( ' ', '' ) == 'endrem'){
						
						// Clear out empty abouts
						if (regardsParent.about == ''){
							
							regardsParent = undefined
						}
						
						inside = insideHistory.pop()
					}
					
					break
			}
			
			if (inside == undefined) inside = AnalyzeBlock.nothing
			
			// DEBUG
			if (!regardsParent) {
			
				//console.log( inside + ': ' +  line )
			}else{
				
				//console.log( "REGARDS: " + inside + ': ' +  line )
			}
		}
		
		if (result && result.import){
			for(var i=0; i<result.import.length; i++){
				
				let imp = result.import[i]
				if (!imp) continue
				
				let importFile = imp.data.slice( 1, -1 )
				if (importFile.length <= 1) continue
				
				let split = importFile.split( '.' )
				if (split.length < 1) continue
				if (!split[1]) continue
				if (split[1].length < 1) continue
				
				// Is this even a .bmx file?
				if (split[1].toLowerCase() != 'bmx') continue
				
				let importPath = path.join( path.dirname( imp.file ), importFile )
				
				// Load the import source file
				let data = await readFile( path.join( BlitzMax.path, importPath ) )			
				
				// Send the module source to our analyzer
				let importResult = await analyzeBmx( { data: data, file: importPath, module: options.module, imports: true } )
				
				if (importResult.bbdoc){
					
					if (!result.bbdoc){
						
						result.bbdoc = []
					}
					
					for(var i2=0; i2<importResult.bbdoc.length; i2++){
						
						if (importResult.bbdoc){
							result.bbdoc.push( importResult.bbdoc[i2] )
						}
					}
				}
				
			}
		}
		
		// DEBUG
		if (result.moduleName && result.moduleName.data.startsWith( 'mky.' )){
			
			//console.log( result )
		}
		
		return resolve( result )
	})
}

function modulesToJson(map: Map<string, BmxModule>): string {
	
	return JSON.stringify( Array.from( map.entries() ) )
}

function modulesFromJson(jsonStr: string): Map<string, BmxModule> {
	
	return new Map( JSON.parse( jsonStr ) )
}
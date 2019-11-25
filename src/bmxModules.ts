'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { readFile, readDir, readStats, writeFile, exists, capitalize, convertTypeTagShortcut, makeReturnPretty } from './common'
import { BlitzMax } from './blitzmax'
import { log } from './common'

let BmxModuleVersion: String = '1.0'

export interface BmxModule{
	name?: string,
	parent: string,
	folderName: string,
	file: string,
	lastModified: number,
	commands?: AnalyzeDoc[]
}

//let modules: Map<string, BmxModule> = new Map()
//export let commands: Map<string, AnalyzeDoc> = new Map()

export async function scanModules( context: vscode.ExtensionContext, forceUpdate:boolean = false ) {
	
	if (BlitzMax.problem) return
	
	log( `Scanning modules` )
	
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Scanning BlitzMax modules",
		cancellable: false
	}, (progress, token) => { return new Promise(async function(resolve, reject) {
			
			BlitzMax._modules.clear()
			BlitzMax._commands = []
			BlitzMax._autoCompletes = []
			
			let changedModules: number = 0
			
			// Load existing modules
			let modJsonPath: string = path.join( context.extensionPath, 'modules-' + BmxModuleVersion + '.json' )
			if (await exists( modJsonPath ))
				BlitzMax._modules = modulesFromJson( await readFile( modJsonPath ) )
			//else
				//console.log( 'No cached modules' )
			
			// Create an array of existing modules
			let modArray: string[] = []
			if (BlitzMax._modules && BlitzMax._modules.size > 0){
				modArray = Array.from( BlitzMax._modules.keys() )
			}
			
			// Make sure modules are up to date
			const parentDir = await readDir( BlitzMax.modPath )
			for(var i=0; i<parentDir.length; i++){
				
				progress.report({ increment: 100.0 / parentDir.length })
				
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
					let mod = BlitzMax._modules.get( keyName )
					
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
						
						BlitzMax._modules.set( keyName, {
							parent: parentDir[i],
							folderName: modDir[i2],
							file: path.join( parentDir[i], modDir[i2], fileName ),
							lastModified: newestTime
						})
						
						mod = BlitzMax._modules.get( keyName )
						if (!mod){
							vscode.window.showErrorMessage( "Unable to update module!" )
							return reject()
						}
						
						// Make sure module entry point exists..
						if (await exists( path.join( BlitzMax.modPath, mod.file ) )){
							
							progress.report( {message: keyName } )
							
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
								BlitzMax._commands.push( mod.commands[i3] )
							}
						}
					}
				}
			}
			
			// Look for any modules left in our array
			if (modArray && modArray.length > 0){
				for(var i3=0; i3<modArray.length; i3++){
					
					log( `${modArray[i3]} no longer exists` )
					//console.log( 'Module', modArray[i3], 'was removed' )
					
					BlitzMax._modules.delete( modArray[i3] )
					changedModules++
				}
			}
			
			// Save updated modules
			log( `${changedModules} modules were updated` )
			//console.log( 'Module changes:', changedModules )
			if (changedModules > 0) saveModules( modJsonPath )
			console.log( 'Commands:', BlitzMax._commands.length )
			return resolve()
		})
	})
}

async function saveModules( path: string ){
	
	console.log( 'Saving modules' )
	await writeFile( path, modulesToJson( BlitzMax._modules ) )
}

async function pause(timeout:number){
	
	return new Promise((fulfill) => {
		
	  setTimeout(fulfill, timeout)
	})
}

async function updateModule( mod: BmxModule ){
	
	log( `Generating docs for ${mod.parent}/${mod.folderName}`, false )
	
	return new Promise(async function(resolve, reject) {
		
		//console.log( "UPDATING: " + mod.parent + "/" + mod.folderName )
		log( `.`, false )
		
		// Load the module source file
		const data = await readFile( path.join( BlitzMax.modPath, mod.file ) )
		
		log( `.`, false )
		
		// Send the module source to our analyzer
		let result = await analyzeBmx( { data: data, file: path.join( 'mod', mod.file ), module: true, imports: true } )
		
		log( `.`, false )
		
		// Read the analyzer result and apply to our module
		if (result.moduleName){ mod.name = result.moduleName.data }
		if (result.bbdoc){
			mod.commands = result.bbdoc
		}
		
		log( "done" )
		return resolve()
	})
}

export interface AnalyzeOptions{
	data: string,
	file: string,
	module?: boolean,
	forceModuleName?: AnalyzeItem,
	imports?: boolean,
	skipFiles?: string[]
}
export interface AnalyzeResult{
	moduleName?: AnalyzeItem,
	import?: AnalyzeItem[],
	include?: AnalyzeItem[]
	bbdoc?: AnalyzeDoc[]
}
export interface AnalyzeItem{
	data: string,
	prettyData?: string,
	line: number,
	args?: AnalyzeItemArgs[],
	file: string,
	name?: string,
	returns?: string,
	type?: string,
	inside?: AnalyzeItem
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
	aboutStripped?: string,
	returns?: string,
	regards: AnalyzeItem,
	searchName: string,
	module: string
}
enum AnalyzeBlock{
	nothing,
	rem,
	bbdoc
}
enum ItemProcessPart{
	type,
	name,
	returns,
	arg,
	argReturn,
	argDefault
}

function cleanAboutInfo( item: AnalyzeDoc ): Promise<AnalyzeDoc>{
	return new Promise( async function( resolve ) {		
		if (!item.about) return resolve( item )
		
		let result: string = ''
		let finishWith: string = ''
		let skipChars = ['@','#','{','}']
		let endChars = [' ',',','.']
		let buildLink: boolean = false
		let linkWord: string = ''
		
		for (let i = 0; i < item.about.length; i++){
			const letter = item.about[i]
			
			if (letter == '\n'){
				
				buildLink = false
				linkWord = ''
			}
			if (finishWith.length <= 0){
				switch (letter) {
					case '@':
						result += '*'
						finishWith = '*'
						break
						
					case '#':
						buildLink = true
						result += `[`
						finishWith = `]`
						break
				}
			}else{
				if (endChars.includes( letter )){
					result += finishWith
					finishWith = ''
					
					if (buildLink){
						let linkCmd = vscode.Uri.parse(
							`command:blitzmax.findHelp?${encodeURIComponent(JSON.stringify(linkWord))}`
						)
						result += `(${linkCmd})`
						linkWord = ''
						buildLink = false
					}
				}
			}
			
			if (!skipChars.includes( letter )){
				if (!item.aboutStripped) item.aboutStripped = ''
				item.aboutStripped += letter
				result += letter
				if (buildLink) linkWord += letter
			}
		}
		
		if (result.length > 0) item.about = result
		
		return resolve( item )
	})
}

async function cleanAnalyzeItem( item: AnalyzeItem ): Promise<AnalyzeItem>{
	return new Promise( async function( resolve ) {
		
		let letter: string
		let nextSymbol: string
		let part: ItemProcessPart = ItemProcessPart.type
		let insideString: boolean = false
		let insideArgs: number = 0
		let argCount: number = -1
		let done: boolean = false
		
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
					
					if (insideString) break
					if (item.type == undefined){item.type = ''}
					if (letter != ' '){
						item.type += letter.toLowerCase()
					}else{
						part = ItemProcessPart.name
					}
					break
					
				case ItemProcessPart.name:
					
					if (insideString) break
					if (item.name == undefined){item.name = ''}
					
					if (letter != ' '){
						
						if (letter == '%' ||
						letter == '#' ||
						letter == '!' ||
						letter == '$'){
							
							item.returns = convertTypeTagShortcut( letter )
							part = ItemProcessPart.returns
							break
						}
						
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
						
						switch (item.type) {
							case 'type':
							case 'interface':
							case 'struct':
								
								done = true
								break
						}
						
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
					if (letter != ',' &&
						letter != ':' &&
						letter != '=' &&
						letter != '%' &&
						letter != '#' &&
						letter != '!' &&
						letter != '$'){
						
						if (item.args == undefined){item.args = []}
						
						if (item.args[argCount] == undefined){
							item.args[argCount] = {
								name: letter,
								returns: ''
							}
						}else{
							item.args[argCount].name += letter
						}
						
					}else if(letter == ','){
						part = ItemProcessPart.arg
						argCount++
					}else if(letter == ':'){
						part = ItemProcessPart.argReturn
					}else if(letter == '='){
						part = ItemProcessPart.argDefault
					}else if(letter == '%'){
						if (item.args) item.args[argCount].returns = 'Int'
					}else if(letter == '#'){
						if (item.args) item.args[argCount].returns = 'Float'
					}else if(letter == '!'){
						if (item.args) item.args[argCount].returns = 'Double'
					}else if(letter == '$'){
						if (item.args) item.args[argCount].returns = 'String'
					}else{
						console.log( 'Unkown part!' )
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
						
						part = ItemProcessPart.arg
						argCount++
					}else{
						
						part = ItemProcessPart.argDefault
					}
					
					// Final cleanup and convert type tag shortcuts
					if (item.args[argCount] && part != ItemProcessPart.argReturn){
						item.args[argCount].returns = item.args[argCount].returns.trim()
						
						item.args[argCount].returns = convertTypeTagShortcut( item.args[argCount].returns )
						/*
						switch (item.args[argCount].returns) {
							case '%':
								item.args[argCount].returns = 'Int'
								break
									
							case '#':
								item.args[argCount].returns = 'Float'
								break
									
							case '!':
								item.args[argCount].returns = 'Double'
								break
									
							case '$':
								item.args[argCount].returns = 'String'
								break
						}
						*/
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
			
			if (done) break
		}
		
		// Prettify return & arg returns
		item.returns =  makeReturnPretty( item.returns, false )
		if (item.args && item.args.length > 0){
			for(var i=0; i<item.args.length; i++){
				
				if (item.args[i].returns.length <= 0){
					
					item.args[i].returns = 'Int'
					continue
				}
				
				item.args[i].returns = makeReturnPretty( item.args[i].returns )
			}
		}
		
		// Make a pretty data string that we show the user
		switch (item.type) {
			case 'function':
			case 'method':
				item.prettyData = capitalize( item.type ) + ' '
				item.prettyData += item.name
				if (item.returns) item.prettyData += ':' + item.returns
				if (item.args){
					item.prettyData += '( '
					for(var i=0; i<item.args.length; i++){
						
						item.prettyData += item.args[i].name + ':'
						item.prettyData += item.args[i].returns
						if (item.args[i].default){
							item.prettyData += ' = ' + item.args[i].default
						}
						if (i < item.args.length - 1){
							item.prettyData += ', '
						}
					}
					item.prettyData += ' )'
				}else{ item.prettyData += '()' }
				
				break
				
			case 'keyword:':
				if (item.name){
					item.name = item.name.slice( 1, -1 )
					item.prettyData = 'Keyword ' + item.name
				}
				break
				
			default:
				if (item.name && item.type){
					item.prettyData = capitalize(item.type) + ' ' + item.name
				}
				break
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
		let bbdocTag: string = ''
		let insideCommand: AnalyzeItem[] = []
		let insideKeywords = ['type','enum','interface','struct']
		let insideKeywordsEnds = ['endtype','endenum','endinterface','endstruct']
		
		if (options.forceModuleName){
			
			result.moduleName = options.forceModuleName
		}
		
		for(var i=0; i<lines.length; i++){
			
			// Current line
			if (lines[i].length <= 0) continue
			if (lines[i].startsWith( `'` )) continue
			
			line = lines[i].trim()
			
			if (line.length <= 0) continue
			if (line.startsWith( `'` )) continue
			
			lineLower = line.toLowerCase()
			sliceLine = line
			
			// Next line
			nextLine = ''
			for(var i2=i+1; i2<lines.length; i2++){
				
				if (lines[i2].trim().length > 0){
					
					nextLine = lines[i2].trim().toLowerCase()
					break
				}
			}
			
			// Find what the BBDoc item regards (next line)
			if (regardsParent && inside < AnalyzeBlock.rem && !line.startsWith( '?' )){
				
				regardsParent.regards = await cleanAnalyzeItem({
					line: i,
					file: options.file,
					data: line,
					inside: regardsParent.regards.inside
				})
				
				if (regardsParent.regards.name){
					regardsParent.searchName = regardsParent.regards.name.toLowerCase()
				}
				regardsParent = await cleanAboutInfo( regardsParent )
				
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
							data: line.slice( 'import '.length ),
							inside: insideCommand[insideCommand.length - 1]
						})
						break
					}
					
					if (lineLower.startsWith( 'include ' )){
						
						if (!result.include){ result.include = [] }
						result.include.push({
							line: i,
							file: options.file,
							data: line.slice( 'include '.length ),
							inside: insideCommand[insideCommand.length - 1]
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
								data: line.slice( 'module '.length ),
								inside: insideCommand[insideCommand.length - 1]
							}
							break
						}
					}
					
					// Blocks
					for (let ki = 0; ki < insideKeywords.length; ki++) {
						const key = insideKeywords[ki]
						
						if (lineLower.startsWith(key + ' ')){
							
							insideCommand.push({
								line: i,
								file: options.file,
								data: line
							})
							break
						}
					}
					for (let ki = 0; ki < insideKeywordsEnds.length; ki++) {
						const key = insideKeywordsEnds[ki]
						
						if (lineLower.replace( ' ', '' ).startsWith(key)){
							
							insideCommand.pop()
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
						
						// Create a new bbdoc and set it as our parent
						let moduleName: string = options.file
						if (result.moduleName) moduleName = result.moduleName.data
						
						if (!result.bbdoc){ result.bbdoc = [] }
						result.bbdoc.push({
							line: i,
							info: line.slice( 'bbdoc:'.length ).trim(),
							searchName: '',
							module: moduleName,
							regards: { file: '',
							line: 0,
							data: '',
							inside: insideCommand[insideCommand.length - 1]
						 	}
						})
						regardsParent = result.bbdoc[ result.bbdoc.length - 1 ]
						
						if (nextLine.replace( ' ', '' ) != 'endrem'){
							bbdocTag = 'bbdoc'
							
							if (inside) insideHistory.push( inside )
							inside = AnalyzeBlock.bbdoc
						}
						
						break
					}
					break
					
				case AnalyzeBlock.bbdoc:
					
					// Do we have a parent?
					if (!regardsParent){
						console.log( 'No bbdoc parent!' )
						inside = insideHistory.pop()
						break
					}
					
					// Are we entering a new tag?
					if (lineLower.length > 0){
						const split = line.trim().split( ':' )
						const enteringTag = split[0].toLowerCase()
						if (split.length > 1 && split[0].length < 8){
							
							switch (enteringTag) {
								case 'bbdoc':
								case 'about':
								case 'keyword':
								case 'returns':									
									bbdocTag = enteringTag
									sliceLine = split[1]
									break
									
								default:
									if (bbdocTag != 'about'){
										console.log( 'Unknown bbdoc tag:',
										line.slice( 0, -line.length + split[0].length + 1 ).trim(),
										'(' + options.file + ':' + regardsParent.line + ')'
										)
									}
									break
							}
						}else{ sliceLine = line }
					}
					
					// What part are we adding to?
					switch (bbdocTag) {
						case 'bbdoc':
							regardsParent.info += sliceLine
							break
							
						case 'about':
							if (regardsParent.about == undefined){
								regardsParent.about = ''
							}else if(regardsParent.about.length > 0){
								regardsParent.about += '\n'
							}
							regardsParent.about += sliceLine
							break
							
						case 'returns':
							if (regardsParent.returns == undefined){
								regardsParent.returns = ''
							}else if(regardsParent.returns.length > 0){
								regardsParent.returns += '\n'
							}
							regardsParent.returns += sliceLine
							break
							
						case 'keyword':
							regardsParent.regards = {
								line: i,
								file: options.file,
								data: line,
								name: '',
								type: ''
							}
							
							regardsParent.searchName = 	sliceLine.trim().slice( 1, -1 ).toLowerCase()
							regardsParent.regards = await cleanAnalyzeItem( regardsParent.regards )
							regardsParent = await cleanAboutInfo( regardsParent )
							
							break
					
						default:
							break
					}
					
					// Is the next line the end?
					if (nextLine.replace( ' ', '' ) == 'endrem'){
						
						// Clear out empty stuff
						if (regardsParent.about){
							regardsParent.about = regardsParent.about.trim()
							if (regardsParent.about == '') regardsParent.about = undefined
						}
						
						bbdocTag = ''
						
						inside = insideHistory.pop()
						
						//console.log( regardsParent )
						
						// If we know what this is regarding
						// we don't need to continue looking
						if (regardsParent.regards.file.length > 0) regardsParent = undefined
					}
					
					break
			}
			
			if (inside == undefined) inside = AnalyzeBlock.nothing
		}
		
		// Scan imports and includes as well
		if (result){
			
			let filesToImport: string[] = []
			
			// imports
			if (result.import){
				
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
					
					// Do we skip this import?
					if (options.skipFiles && options.skipFiles.includes( importPath ) || !options.skipFiles){
						
						filesToImport.push( importPath )
						if (!options.skipFiles) options.skipFiles = []
						options.skipFiles.push( importPath )
						//console.log( importPath )
					}else{
						
						//console.log( 'Skipping import: ' + importPath )
					}
				}
			}
			
			// includes
			if (result.include){
				
				for(var i=0; i<result.include.length; i++){
					
					let inc = result.include[i]
					if (!inc) continue
					
					let includeFile = inc.data.slice( 1, -1 )
					if (includeFile.length <= 1) continue
					
					let split = includeFile.split( '.' )
					if (split.length < 1) continue
					if (!split[1]) continue
					if (split[1].length < 1) continue
					
					// Is this even a .bmx file?
					if (split[1].toLowerCase() != 'bmx') continue
					
					let includePath = path.join( path.dirname( inc.file ), includeFile )
					
					// Do we skip this include?
					if (options.skipFiles && options.skipFiles.includes( includePath ) || !options.skipFiles){
						
						filesToImport.push( includePath )
						if (!options.skipFiles) options.skipFiles = []
						options.skipFiles.push( includePath )
						//console.log( importPath )
					}else{
						
						//console.log( 'Skipping import: ' + importPath )
					}
				}
			}
			
			for (let i = 0; i < filesToImport.length; i++) {
				let importFile: string = filesToImport[i]
				
				// Load the import source file
				let data = await readFile( path.join( BlitzMax.path, importFile ) )			
				
				// Send the module source to our analyzer
				let importResult = await analyzeBmx({
					data: data,
					file: importFile,
					forceModuleName: result.moduleName,
					module: options.module,
					imports: true,
					skipFiles: options.skipFiles
				})
				
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
		
		return resolve( result )
	})
}

function modulesToJson(map: Map<string, BmxModule>): string {
	
	return JSON.stringify( Array.from( map.entries() ) )
}

function modulesFromJson(jsonStr: string): Map<string, BmxModule> {
	
	return new Map( JSON.parse( jsonStr ) )
}
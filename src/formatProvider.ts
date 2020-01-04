'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxFormatProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits( document: vscode.TextDocument): vscode.TextEdit[] | undefined {
		
		let edits:vscode.TextEdit[] = []
		let inRemBlock:boolean = false
		let wordSeparators:string[] = [' ', '[', '(', ':', ')', ']', ';', '"',
		'=', '-', '+', '~', '/', '*']
		let includeWordSeparators:string[] = []
		
		for (let lineNr = 0; lineNr < document.lineCount; lineNr++) {
			const line:vscode.TextLine = document.lineAt(lineNr)
			let word:string = ''
			let wordStart:number = 0
			let previousWordRange:vscode.Range | undefined
			let previousWord:string | undefined
			let wordCount:number = 0
			let inString:boolean = false
			let stringLength:number = 0
			let wordSplitter:string | undefined
			
			// Check for rem blocks
			if (inRemBlock){
				
				if (line.text.trim().toLowerCase().replace( ' ', '' ).startsWith( 'endrem' ))
					inRemBlock = false
				
				continue
			}else{
				
				if (line.text.trim().toLowerCase() == 'rem')
				{
					inRemBlock = true
					continue
				}
			}
			
			// Process words
			for (let chrNr = line.firstNonWhitespaceCharacterIndex; chrNr < line.text.length; chrNr++) {
				const chr:string = line.text[chrNr]
				if (chr == '\t' || chr == '\r' || chr == '\n') continue
				if (word == "'"){ // Skip comments
					word = ''
					break
				}
				if (chr == '"') // Check for strings
					inString = !inString
					
				// Continue looking for string end
				if (inString){
					stringLength++
					if (stringLength > 0) continue
				}
				
				let isEndOfWord:boolean = wordSeparators.includes( chr )
				
				if (!isEndOfWord){
					if (word.length <= 0) wordStart = chrNr
					word += chr
					isEndOfWord = includeWordSeparators.includes( chr )
				}
				
				if (word && isEndOfWord) {
					
					let wordRange = new vscode.Range(
						new vscode.Position(line.lineNumber, wordStart),
						new vscode.Position(line.lineNumber, chrNr)
					)
					
					this.formatWord( word, previousWord, wordRange, previousWordRange, wordSplitter )
					?.forEach(edit => edits.push( edit ))
					
					wordSplitter = chr
					previousWord = word.toLowerCase()
					previousWordRange = new vscode.Range( wordRange.start, wordRange.end )
					word = ''
					wordCount++
				}
				
				// Threat ; as a new line!
				if (chr == ';'){
					word = ''
					wordStart = 0
					previousWordRange = undefined
					previousWord = undefined
					wordCount = 0
					inString = false
					stringLength = 0
					wordSplitter = undefined
				}
			}
			
			if (word){
				
				let wordRange = new vscode.Range(
					new vscode.Position(line.lineNumber, wordStart),
					new vscode.Position(line.lineNumber, line.range.end.character)
				)
				
				this.formatWord( word, previousWord, wordRange, previousWordRange, wordSplitter )
				?.forEach(edit => edits.push( edit ))
			}
		}
		
		console.log(`${edits.length} fixes`)
		return edits
	}
	
	formatWord( word:string, previousWord:string | undefined, range:vscode.Range, previousRange:vscode.Range | undefined, splitter:string | undefined ) : vscode.TextEdit[] | undefined {
		
		console.log( "Format Word: " + word )
		console.log( "Splitter: '" + splitter + "'" )
		//console.log( "Range: line " + (range.start.line+1) + " char " + (range.start.character+1) + "-" + (range.end.character+1) )
		
		let newWord:string = ''
		
		// Translate type tag shortcuts
		if (splitter && splitter == ':'){
			switch (word) {
				case '%': return [vscode.TextEdit.replace( range, 'Int')]
				case '#': return [vscode.TextEdit.replace( range, 'Float')]
				case '!': return [vscode.TextEdit.replace( range, 'Double')]
				case '$': return [vscode.TextEdit.replace( range, 'String')]
			}
		}
		
		// Join some words together, like Else If and End Function
		if (previousWord && previousRange){
			const elseJoins:string[] = [ 'if' ]
			const endJoins:string[] = [
				'if', 'function', 'method', 'interface', 'struct', 'enum', 'type', 'try', 'select'
			]
			
			const wordLowercase:string = word.toLowerCase()
			
			if (previousWord == 'else'){
				if (elseJoins.includes( wordLowercase ))
					newWord = word
			}
			
			if (previousWord == 'end'){
				if (endJoins.includes( wordLowercase ))
					newWord = word
			}
			
			if (newWord){
				return [
					vscode.TextEdit.delete( new vscode.Range(
						new vscode.Position( range.end.line, previousRange.end.character ),
						new vscode.Position( range.end.line, range.start.character )
					)),
					vscode.TextEdit.replace( range,
						newWord.charAt(0).toUpperCase() + newWord.slice(1).toLowerCase()
					)
				]
			}
		}
		
		// Enforce correct names!
		if (previousWord && previousRange){
			switch (previousWord) {
				case 'const':
					newWord = word.toUpperCase()
					break
				
				case 'global':
					newWord = word.charAt(0).toUpperCase() + word.slice(1)
					break
				
				case 'field':
				case 'local':
					newWord = word.charAt(0).toLowerCase() + word.slice(1)
					break
			}
			
			if (newWord)
				return [vscode.TextEdit.replace( range, newWord )]
		}
		
		// Figure out types
		let onlyTypes:string[] = []
		
		switch (splitter) {
			case ':':
				onlyTypes.push('interface')
				onlyTypes.push('keyword')
				onlyTypes.push('struct')
				onlyTypes.push('type')
				onlyTypes.push('enum')
				break
			
			case ' ':
				if (previousWord == 'new'){
					onlyTypes.push('interface')
					onlyTypes.push('struct')
					onlyTypes.push('type')
				}
				break
		}
	
		// Look for a command straight from BlitzMax
		let cmds = BlitzMax.getCommand( word )
		if (!cmds || cmds.length <= 0) return undefined
		
		// Find a command
		for(var i=0; i<cmds.length; i++){
			
			const cmd = cmds[i]
			if (!cmd || !cmd.info || !cmd.regards.name) continue
			
			if (onlyTypes.length > 0 && (!cmd.regards.type || !onlyTypes.includes( cmd.regards.type )))
				continue
			
			newWord = cmd.regards.name
			if (newWord == word) continue
			
			return [vscode.TextEdit.replace( range, newWord )]
		}
		
		return undefined
	}
}
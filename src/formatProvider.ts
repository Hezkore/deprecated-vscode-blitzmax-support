'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxFormatProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits( document: vscode.TextDocument): vscode.TextEdit[] | undefined {
		
		let edits:vscode.TextEdit[] = []
		let inRemBlock:boolean = false
		let firstWord:string = ''
		
		for (let i = 0; i < document.lineCount; i++) {
			const line:vscode.TextLine = document.lineAt(i)
			const lowerTrimmedText:string = line.text.trimLeft().toLowerCase()
			
			if (firstWord){
				if (!line.isEmptyOrWhitespace){
					let tabs:string = ''
					for (let t = 0; t < line.firstNonWhitespaceCharacterIndex; t++)
						tabs += '\t'
					
					switch (firstWord.trimLeft().toLowerCase()) {
						case 'function':
						case 'method':
						case 'type':
						case 'while':
						case 'for':
						case 'if':
						case 'else if':
						case 'elseif':
						case 'else':
							console.log( '"' + firstWord + '" - "' + lowerTrimmedText +  '"')
							edits.push(
								vscode.TextEdit.insert(
								new vscode.Position(line.lineNumber, 0),
								`${tabs}\n` )
							)
							break
					}
				}
				firstWord = ''
			}
			
			if (line.isEmptyOrWhitespace) continue
			
			if (inRemBlock){
				if (lowerTrimmedText == 'endrem' ||
				lowerTrimmedText == 'end rem' ||
				lowerTrimmedText.startsWith('endrem ') ||
				lowerTrimmedText.startsWith('end rem '))
					inRemBlock = false
				continue
			}else{
				if (lowerTrimmedText == 'rem' ||
				lowerTrimmedText.startsWith('rem ')){
					inRemBlock = true
					continue
				}
			}
			
			let depth:number = 0
			let inString:boolean = false
			let inComment:boolean = false
			let word:string = ''
			let wordStart:number = 0
			let fix:vscode.TextEdit | undefined
			
			for (let i2 = 0; i2 < line.text.length; i2++) {
				if (inComment) break
				const chr:string = line.text[i2]
				if (chr == '\t') continue
				
				let nextChr:string = ''
				if (i2 < line.text.length)
					nextChr = line.text[i2+1]
				
				if (!word) wordStart = i2
				
				switch (chr) {					
					case '"':
						fix = this.format( word, new vscode.Range(
							new vscode.Position(line.lineNumber, wordStart),
							new vscode.Position(line.lineNumber, i2)
						))
						if (fix) edits.push( fix )
						if (!firstWord) firstWord = word
						word = ''
						inString = !inString
						break
				}
				
				if (!inString){
					switch (chr) {
						case "'":
							fix = this.format( word, new vscode.Range(
								new vscode.Position(line.lineNumber, wordStart),
								new vscode.Position(line.lineNumber, i2)
							))
							if (fix) edits.push( fix )
							if (!firstWord) firstWord = word
							word = ''
							inComment = true
							if (nextChr != ' ')
								edits.push(
									vscode.TextEdit.insert(
									new vscode.Position(line.lineNumber, wordStart + 1),
									' ' )
								)
							continue
						
						case '(':
							if (nextChr != ' ' && nextChr != ')')
							edits.push(
								vscode.TextEdit.insert(
								new vscode.Position(line.lineNumber, i2 + 1),
								' ' )
							)
							
						case '[':
							fix = this.format( word, new vscode.Range(
								new vscode.Position(line.lineNumber, wordStart),
								new vscode.Position(line.lineNumber, i2)
							))
							if (fix) edits.push( fix )
							if (!firstWord) firstWord = word
							word = ''
							depth++
							continue
							
						case ')':
						case ']':
							depth--
							break
					}
					
					if (depth){
						
						switch (nextChr) {
							case ')':
								if (chr != ' ' && chr != '(')
								edits.push(
									vscode.TextEdit.insert(
									new vscode.Position(line.lineNumber, i2 + 1),
									' ' )
								)
								break
						}
					}else{
						
						switch (chr) {
							case ' ':
								if (word.toLowerCase() == 'end') {
									word += chr
									break
								}
								fix = this.format( word, new vscode.Range(
									new vscode.Position(line.lineNumber, wordStart),
									new vscode.Position(line.lineNumber, i2)
								))
								if (fix) edits.push( fix )
								if (!firstWord) firstWord = word
								word = ''
								break
							
							default:
								word += chr
								if (i2 == line.text.length - 1)
								{
									fix = this.format( word, new vscode.Range(
										new vscode.Position(line.lineNumber, wordStart),
										new vscode.Position(line.lineNumber, i2+1)
									))
									if (fix) edits.push( fix )
									if (!firstWord) firstWord = word
								}
								break
						}
					}
				}
			}
		}
		
		console.log(`${edits.length} fixes`)
		return edits
	}
	
	format( word:string, range:vscode.Range ) : vscode.TextEdit | undefined {
		
		if (!word) return undefined
		
		let correction:string = ''
		
		let cmds = BlitzMax.getCommand(word.replace(' ', ''))
		if (!cmds || cmds.length <= 0) return undefined
		
		// Find a command
		for(var i=0; i<cmds.length; i++){
			
			const cmd = cmds[i]
			if (!cmd || !cmd.info || !cmd.regards.name) continue
			
			correction = cmd.regards.name
			if (correction == word) continue
			
			return vscode.TextEdit.replace( range, correction )
		}
		
		return undefined
	}
}
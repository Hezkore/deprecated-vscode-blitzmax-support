'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxOnTypeFormatProvider implements vscode.OnTypeFormattingEditProvider {
	provideOnTypeFormattingEdits( document: vscode.TextDocument, position: vscode.Position, ch: string, options: vscode.FormattingOptions, token: vscode.CancellationToken ): vscode.TextEdit[] | undefined {
		
		const line = document.lineAt(position.line)
		if (line.isEmptyOrWhitespace) return undefined
		
		// Test if we're inside a rem block
		let inRemBlock:boolean = false
		for (let lineNr = 0; lineNr <= position.line; lineNr++) {
			const curLineText = document.lineAt(lineNr).text.trim().toLowerCase()
			
			if (inRemBlock) {
				
				if (lineNr >= position.line) return undefined
			
				if (curLineText.replace( ' ', '' ).startsWith( 'endrem' ))
					inRemBlock = false
				
				continue
			} else {
				
				if (curLineText == 'rem' || curLineText.startsWith( 'rem ' ))
				{
					inRemBlock = true
					continue
				}
			}
		}
		
		// Initial test to see if we're inside a string
		let inString:boolean = false
		for (let chrNr = line.firstNonWhitespaceCharacterIndex; chrNr < position.character; chrNr++) {
			const chr = line.text[chrNr]
			
			if (chr == '"') inString = !inString
			if (!inString && chr == "'") return undefined
		}
		
		if (inString && ch != '"') return undefined
		
		return formatDocument( document, new vscode.Range( new vscode.Position( position.line, 0 ), new vscode.Position( position.line, position.character ) ) )
	}
}

export class BmxRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {
	provideDocumentRangeFormattingEdits( document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken ): vscode.TextEdit[] | undefined {
		
		return formatDocument( document, range )
	}
}

export class BmxFormatProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits( document: vscode.TextDocument): vscode.TextEdit[] | undefined {
		
		return formatDocument( document )
	}

}

function formatDocument( document: vscode.TextDocument, range: vscode.Range | undefined = undefined ): vscode.TextEdit[] {
	
	let edits:vscode.TextEdit[] = []
	let inRemBlock:boolean = false
	let wordSeparators:string[] = [
		' ', '[', '(', ':', ')', ']', ';', '"',
		'=', '-', '+', '~', '/', '*'
	]
	let includeWordSeparators:string[] = []
	let spaceEfter:string[] = ['{', '}', ';', '=', '<', '>', '&']
	let spaceBefore:string[] = ['{', '}', '=', '<', '>', '&']
	let noSpaceBefore:string[] = ['[', ':', ',', '.']
	let noSpacesBeforeExceptions:string[] = ['return']
	//let noSpaceAfter:string[] = [':', '.']
	let typeTagShortcuts:string[] = [
		'%', 'Int',
		'#', 'Float',
		'!', 'Double',
		'$', 'String'
	]
	
	if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'format.comfortableFunctionNames' )){
		spaceBefore.push( '(' )
	} else {
		noSpaceBefore.push( '(' )
	}
	
	if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'format.comfortableFunctionBrackets' )) {
		spaceEfter.push( '(' )
		spaceBefore.push( ')' )
	}
	
	if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'format.comfortableFunctionParameters' ))
		spaceEfter.push( ',' )
	
	for (let lineNr = range ? range.start.line : 0; range ? lineNr <= range.end.line : lineNr < document.lineCount; lineNr++) {
		const line: vscode.TextLine = document.lineAt(lineNr)
		const lineTextTrimmedLowerCase = line.text.trim().toLowerCase()
		let word: string = ''
		let wordStart:number = 0
		let previousWordRange:vscode.Range | undefined
		let previousWord:string | undefined
		let wordLineCount:number = 0
		let inString:boolean = false
		let stringLength:number = 0
		let wordSplitter:string | undefined
		let nextChr:string | undefined
		let previousChr:string | undefined
		let chr:string  | undefined
		let chrSpaceCount:number = 0
		let previousChrBeforeSpaces:string | undefined
		
		// Check for rem blocks
		if (inRemBlock){
			
			if (lineTextTrimmedLowerCase.replace( ' ', '' ).startsWith( 'endrem' ))
				inRemBlock = false
			
			continue
		}else{
			
			if (lineTextTrimmedLowerCase == 'rem' || lineTextTrimmedLowerCase.startsWith('rem '))
			{
				inRemBlock = true
				continue
			}
		}
		
		// Process words
		for (let chrNr = line.firstNonWhitespaceCharacterIndex; chrNr < line.text.length; chrNr++) {
			previousChr = chr
			if (chr != ' ') previousChrBeforeSpaces = chr
			chr = line.text[chrNr]
			if (chr == '\t' || chr == '\r' || chr == '\n') continue
			if (word == "'"){ // Skip comments
				word = ''
				break
			}
			if (chr == '"') // Check for strings
			{
				inString = !inString
				stringLength = 0
			}
			if (previousChr == ' ') // Count spaces
				chrSpaceCount++
			else
				chrSpaceCount = 0
			
			// Continue looking for string end
			if (inString){
				stringLength++
				if (stringLength > 1) continue
			}
			
			if (chrNr < line.text.length)
				nextChr = line.text[chrNr + 1]
			else
				nextChr = undefined
			
			if (chr && !inString && previousChr == ' ' && previousChrBeforeSpaces && previousWord && !noSpacesBeforeExceptions.includes( previousWord.toLowerCase() )){
				// Remove spaces before some letters
				if (noSpaceBefore.includes( chr.toLowerCase() ) &&
				!spaceEfter.includes( previousChrBeforeSpaces.toLowerCase() )){
					edits.push( vscode.TextEdit.delete( new vscode.Range(
						new vscode.Position( line.range.start.line, chrNr - chrSpaceCount ),
						new vscode.Position( line.range.end.line, chrNr )
					) ) )
				}
			}
			
			if (chr && !inString){
				// Add spaces after some letters
				if (spaceEfter.includes( chr.toLowerCase() ) &&
				(nextChr && nextChr != ' ' && !spaceBefore.includes( nextChr.toLowerCase() )))
					edits.push( vscode.TextEdit.insert( new vscode.Position(
						line.range.start.line, chrNr + 1
					), ' ' ) )
				
				// Add spaces before some letters
				if (nextChr && chr != ' ' && spaceBefore.includes( nextChr.toLowerCase() ) &&
				!spaceEfter.includes( chr.toLowerCase() ))
					edits.push( vscode.TextEdit.insert( new vscode.Position(
						line.range.start.line, chrNr + 1
					), ' ' ) )
			}
			
			// Is this character a word separator?
			let isEndOfWord:boolean = wordSeparators.includes( chr )
			
			if (!isEndOfWord && !inString){
				if (word.length <= 0) wordStart = chrNr
				
				// Check if it's a type tag shortcut
				if (word) {
					for (let tagNr = 0; tagNr < typeTagShortcuts.length/2; tagNr++) {
						const tag = typeTagShortcuts[tagNr*2]
						if (chr == tag) {
							edits.push( vscode.TextEdit.replace( new vscode.Range( new vscode.Position(
								line.range.start.line, chrNr ),
							new vscode.Position(
								line.range.start.line, chrNr + 1 )
							), ':' + typeTagShortcuts[tagNr*2+1] ) )	
						}
					}
				}
				word += chr
				isEndOfWord = includeWordSeparators.includes( chr )
			}
			
			// Ye it was
			if (word && isEndOfWord) {
				
				let wordRange = new vscode.Range(
					new vscode.Position(line.lineNumber, wordStart),
					new vscode.Position(line.lineNumber, chrNr)
				)
				
				// Format words
				formatWord( word, previousWord, wordRange, previousWordRange, wordSplitter )
				?.forEach(edit => edits.push( edit ))
				
				// New lines
				needsNewLine( word, line, wordLineCount, lineNr, document )
				?.forEach(edit => edits.push( edit ))
				
				wordSplitter = chr
				previousWord = word.toLowerCase()
				previousWordRange = new vscode.Range( wordRange.start, wordRange.end )
				word = ''
				wordLineCount++
			}
			
			// Threat ; as a new line!
			if (chr == ';'){
				word = ''
				wordStart = 0
				previousWordRange = undefined
				previousWord = undefined
				//wordLineCount = 0 < Not this, technically same line
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
			
			// Format words
			formatWord( word, previousWord, wordRange, previousWordRange, wordSplitter )
			?.forEach(edit => edits.push( edit ))
			
			// New lines
			needsNewLine( word, line, wordLineCount, lineNr, document )
			?.forEach(edit => edits.push( edit ))
		}
	}
	
	console.log(`${edits.length} fixes`)
	return edits
}

function needsNewLine( word:string, line:vscode.TextLine, wordLineCount:number, lineNr:number, document:vscode.TextDocument ): vscode.TextEdit[] | undefined {
	
	if (wordLineCount == 0 && lineNr + 1 < document.lineCount){
		
		let emptyLineBefore:string[] = [
			'case', 'function', 'method',
			'type', 'interface', 'struct', 'enum'
		]
		let emptyLineAfter:string[] = [
			'function', 'method',
			'type', 'interface', 'struct', 'enum',
			//'if', 'else', 'elseif', 'else if'
		]
		
		let fixes: vscode.TextEdit[] = []
		
		if (emptyLineAfter.includes( word.toLowerCase() )){
			const nextLine:vscode.TextLine = document.lineAt( lineNr + 1 )
			
			if (!nextLine.isEmptyOrWhitespace){
				
				let tabs:string = ''
				for (let tabIndex = 0; tabIndex <= line.firstNonWhitespaceCharacterIndex; tabIndex++) {
					tabs += '\t'
				}
				
				fixes.push(
					vscode.TextEdit.insert( nextLine.range.start, `${tabs}\n` )
				)
			}
		}
		
		if (emptyLineBefore.includes( word.toLowerCase() )){
			
			if (!document.lineAt( lineNr - 1 ).isEmptyOrWhitespace){
				
				let tabs:string = ''
				for (let tabIndex = 0; tabIndex <= line.firstNonWhitespaceCharacterIndex; tabIndex++) {
					tabs += '\t'
				}
				
				fixes.push(
					vscode.TextEdit.insert( line.range.start, `${tabs}\n` )
				)
			}
		}
		
		return fixes
	}
	
	return undefined
}

function formatWord( word:string, previousWord:string | undefined, range:vscode.Range, previousRange:vscode.Range | undefined, splitter:string | undefined ): vscode.TextEdit[] | undefined {
	
	//console.log( "Format Word: " + word )
	//console.log( "Splitter: '" + splitter + "'" )
	//console.log( "Range: line " + (range.start.line+1) + " char " + (range.start.character+1) + "-" + (range.end.character+1) )
	
	let newWord:string = ''
	
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
	/*
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
		
		if (newWord && newWord != word)
			return [vscode.TextEdit.replace( range, newWord )]
	}
	*/
	
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
	let cmds = BlitzMax.searchCommands( word )
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
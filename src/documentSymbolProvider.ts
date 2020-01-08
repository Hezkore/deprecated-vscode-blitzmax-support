'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols( document: vscode.TextDocument, token: vscode.CancellationToken ): vscode.DocumentSymbol[] {
		
		let symbols: vscode.DocumentSymbol[] = []
		let containers:vscode.DocumentSymbol[] = []
		let inRemBlock:boolean = false
		
		for (var lineNr = 0; lineNr < document.lineCount; lineNr++) {
			const line:vscode.TextLine = document.lineAt( lineNr )
			
			// Extend container range
			containers.forEach( container => {
				
				container.range = new vscode.Range(
					container.selectionRange.start,
					line.range.end
				)
			})
			
			if (line.isEmptyOrWhitespace || line.text.length < 4) continue
			if (line.text.startsWith( "'" )) continue
			
			// Get a clean line to compare against
			const lineCleanText:string = line.text
			.slice( line.firstNonWhitespaceCharacterIndex )
			.replace( '\t', '' )
			//.trimRight()
			//.toLowerCase()
			
			const words:string[] = lineCleanText.split( ' ' )
			if (words.length < 0) continue
			
			if (words.length > 1 && words[1].startsWith( "'" )) continue
			
			let firstWord:string = words[0].toLowerCase()
			if (firstWord == 'end' && words.length > 1){
				
				let foundWord:string | undefined
				words.forEach( scanWord => {
					
					if (scanWord.trim().length > 2)
						foundWord = scanWord.trim()
				})
				
				if (foundWord)
					firstWord += foundWord.toLowerCase()
			}
			
			if (inRemBlock){
				
				if (firstWord == 'endrem')
					inRemBlock = !inRemBlock
				
				continue
			}else{
				
				console.log(firstWord)
				if (firstWord == 'rem')
				{
					inRemBlock = !inRemBlock
					continue
				}
			}
			
			let wasSymbolKind:vscode.SymbolKind | undefined = undefined
			let wasContainer:boolean = false
			let splitters:string[] = [ '(', ' ', ':', "'", '%', '#', '!', '$' ]
			let detail:string = ''
			
			// Define symbols
			switch (firstWord) {
				case 'function':
					wasSymbolKind = vscode.SymbolKind.Function
					wasContainer = true
					break
				
				case 'method':
					wasSymbolKind = vscode.SymbolKind.Method
					wasContainer = true
					break
				
				case 'interface':
					wasSymbolKind = vscode.SymbolKind.Interface
					wasContainer = true
					break
				
				case 'enum':
					wasSymbolKind = vscode.SymbolKind.Enum
					wasContainer = true
					break
				
				case 'type':
					wasSymbolKind = vscode.SymbolKind.Class
					wasContainer = true
					break
				
				case 'const':
					wasSymbolKind = vscode.SymbolKind.Constant
					break
				
				case 'global':
				case 'local':
					wasSymbolKind = vscode.SymbolKind.Variable
					break
				
				case 'field':
					wasSymbolKind = vscode.SymbolKind.Field
					break
				
				case 'endtype':
				case 'endenum':
				case 'endstruct':
				case 'endinteface':
				case 'endfunction':
				case 'endmethod':
					containers.pop()
					break
			}
			
			if (wasSymbolKind){
				
				// Apply name splitters
				let name:string = words[1]
				splitters.forEach( splitter => {
					
					if (name.includes( splitter ))
						name = name.split( splitter )[0]
				})
				
				if (name.length > 0){
					// Create the symbol
					const symbol = new vscode.DocumentSymbol(
						name,
						detail,
						wasSymbolKind,
						line.range, line.range
					)
					
					// Where do we push the symbol?
					if (containers.length > 0)
						containers[containers.length - 1].children.push( symbol )
					else
						symbols.push( symbol )
					
					// Store this symbol as a container
					if (wasContainer)
						containers.push( symbol )
				}
			}
		}
		
		return symbols
    }
}
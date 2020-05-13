'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc, BmxModule } from './bmxModules'
import { currentWord, currentWordTrigger, generateCommandText } from './common'
import { formatBBDocText, FormatType, FormatResult } from './bbdocFormat'

let currentModule: BmxModule | undefined

export class BmxHoverProvider implements vscode.HoverProvider {
	async provideHover( document: vscode.TextDocument, position: vscode.Position ): Promise<any> {
		
		// What word are we looking for?
		let word  = currentWord( position, document )
		if (!word) return undefined
		word = word.toLowerCase()
		
		// Try to figure out the "trigger"
		let wordTrigger: string = currentWordTrigger( position, document )
		
		// Are we looking for things inside a type?
		const fromType: boolean = wordTrigger == '.' ? true : false
		
		// Filter to only search some modules
		let fromModules: string[] = []
		
		// Find the word in our command list
		const cmd = BlitzMax.searchCommand( word, fromType, fromModules )
		if (cmd) return await generateHoverContent( cmd )
		
        return undefined
      }
}

async function generateHoverContent( cmd: AnalyzeDoc ): Promise<vscode.Hover> {
	
	const contents = new vscode.MarkdownString()
			
	let dataLine = cmd.regards.prettyData
	if (!dataLine) dataLine = cmd.regards.data
	
	contents.appendCodeblock( dataLine, 'blitzmax' )
	contents.appendMarkdown( formatBBDocText(cmd.info, formatForHover) )
	//if (cmd.about) contents.appendMarkdown( '\n\n' + cmd.about )
	
	let exampleLink = generateCommandText( 'blitzmax.findHelp',
	[cmd.searchName,cmd.regards.inside,[cmd.module]] )
	
	if (await BlitzMax.hasExample( cmd ))
		contents.appendMarkdown( '\n\n[More Info & Example](' + exampleLink + ')')
	else
		contents.appendMarkdown( '\n\n[More Info](' + exampleLink + ')')
	
	let moduleLink = vscode.Uri.parse(
		`command:blitzmax.openModule?${encodeURIComponent(JSON.stringify([
			cmd.module,
			cmd.regards.line
		]))}`
	)
	contents.appendMarkdown( '\n\n[' + cmd.module + '](' + moduleLink + ')')
	
	contents.isTrusted = true
	
	currentModule = BlitzMax.getModule( cmd.module )
	
	return new vscode.Hover( contents )
}

export function formatForHover( result: FormatResult ): string {
	
	switch (result.Type) {
		case FormatType.Reference:
			// Is this just straight up a module?
			const mod = BlitzMax.getModule( result.Words[0] )
			if (mod)
				return `[${result.Words[0]}](${generateCommandText( 'blitzmax.moduleHelp', [mod.name] )})`
			
			// Otherwise we do a global search
			return `[${result.Words[0]}](${generateCommandText( 'blitzmax.findHelp', [result.Words[0], currentModule?.name] )})`
			
		case FormatType.Highlight:
			return `**${result.Words[0]}**`
			
		case FormatType.Header1:
			return `#${result.Words[0]}`
			
		case FormatType.Header2:
			return `##${result.Words[0]}`
			
		case FormatType.Header3:
			return `###${result.Words[0]}`
			
		case FormatType.Header4:
			return `####${result.Words[0]}`
			
		case FormatType.Header5:
			return `#####${result.Words[0]}`
			
		case FormatType.Header6:
			return `######${result.Words[0]}`
			
		case FormatType.Italic:
			return `*${result.Words[0]}*`
			
		case FormatType.CodeMultiLine:
			return '```blitzmax\n' + result.Words[0] + '```'
		
		case FormatType.Code:
			return '`' + result.Words[0] + '`'
		
		case FormatType.Html:
			return `[${result.HtmlTag}](${result.HtmlData})`
		
		case FormatType.Table:
			return result.Words[0]
	}
	
	return result.Words[0]
}
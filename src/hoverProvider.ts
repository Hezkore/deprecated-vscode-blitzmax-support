'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'
import { AnalyzeDoc } from './bmxModules'
import { currentWord, currentWordTrigger, generateCommandText } from './common'

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
	contents.appendMarkdown( cmd.info )
	if (cmd.about) contents.appendMarkdown( '\n\n' + cmd.about )
	
	let exampleLink = generateCommandText( 'blitzmax.findHelp',
	[cmd.searchName,cmd.regards.inside,[cmd.module]] )
	
	if (await BlitzMax.hasExample( cmd ))
		contents.appendMarkdown( '\n\n[Example](' + exampleLink + ')')
	else
		contents.appendMarkdown( '\n\n[Help](' + exampleLink + ')')
	
	let moduleLink = vscode.Uri.parse(
		`command:blitzmax.openModule?${encodeURIComponent(JSON.stringify([
			cmd.module,
			cmd.regards.line
		]))}`
	)
	contents.appendMarkdown( '\n\n[' + cmd.module + '](' + moduleLink + ')')
	
	contents.isTrusted = true
	
	return new vscode.Hover( contents )
}
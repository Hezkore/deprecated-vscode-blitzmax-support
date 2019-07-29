'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxHoverProvider implements vscode.HoverProvider {
	async provideHover( document: vscode.TextDocument, position: vscode.Position ): Promise<any> {
		
		let wordRange = document.getWordRangeAtPosition( position )
		if (!wordRange) return
		
		let word  = document.getText( wordRange )
		if (!word) return
		
		let cmds = BlitzMax.getCommand( word )
		if (!cmds || cmds.length <= 0) return
		
		// Find a command
		for(var i=0; i<cmds.length; i++){
			
			const cmd = cmds[i]
			if (!cmd || !cmd.info) continue
			
			const contents = new vscode.MarkdownString()
			
			let dataLine = cmd.regards.prettyData
			if (!dataLine) dataLine = cmd.regards.data
			
			contents.appendCodeblock( dataLine, 'blitzmax' )
			contents.appendMarkdown( cmd.info )
			if (cmd.about){
				contents.appendMarkdown( '\n\n' + cmd.about )
			}
			if (await BlitzMax.hasExample( cmd )){
				
				let exampleLink = vscode.Uri.parse(
					`command:blitzmax.findHelp?${encodeURIComponent(JSON.stringify(cmd.searchName + '&false'))}`
				)
				contents.appendMarkdown( '\n\n[Example](' + exampleLink + ')')
			}
			contents.appendMarkdown( '\n\n*' + cmd.module + '*')
			
			contents.isTrusted = true
			
			return new vscode.Hover( contents )
		}
		
        return null
      }
}
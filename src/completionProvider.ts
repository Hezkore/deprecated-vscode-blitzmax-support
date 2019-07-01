'use strict'

import * as vscode from 'vscode'
import { cacheHelp, helpStack, HelpObject, cacheState } from './helpProvider'

export class BmxCompletionProvider implements vscode.CompletionItemProvider {
	
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
		
		cacheHelp()
		if (cacheState < 2){ return }
		
		let comp:Array<vscode.CompletionItem> = []
		let item:HelpObject
		
		for(var i=0; i<helpStack.length; i++){
			
			item = helpStack[i]
			
			comp.push( new vscode.CompletionItem( item.name, item.kind ) )
			comp[ comp.length - 1 ].insertText = new vscode.SnippetString( item.insert )
			comp[ comp.length - 1 ].documentation = new vscode.MarkdownString()
			.appendCodeblock( item.infoName, 'blitzmax' )
			.appendMarkdown( item.desc )
			.appendMarkdown( '\r\r*' + item.module + '*' )
		}
		
		return comp
	}
}
'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
		
		if (!BlitzMax.ready) return null
		
		if (context.triggerCharacter == '.')
			return BlitzMax.getAutoCompleteMethods()
		else
			return BlitzMax.getAutoCompletes()
	}
}
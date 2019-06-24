'use strict'

import * as vscode from 'vscode'

export class BmxFormatProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits( document: vscode.TextDocument): vscode.TextEdit[] | undefined {

		const firstLine = document.lineAt(0)
		
		if ( firstLine.text !== '//BlitzMax is awesome' ) {
			
			return [ vscode.TextEdit.insert( firstLine.range.start, '//BlitzMax is awesome\n' ) ]
		}
	}
}
import * as vscode from 'vscode'

export class BmxActionProvider implements vscode.CodeActionProvider {
	
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	]
	
	public provideCodeActions( document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken ): vscode.CodeAction[] | undefined {
		
		if (!vscode.window.activeTextEditor)
			return
		
		// Check diagnostics error messages
		let fixes: vscode.CodeAction[] = []
		context.diagnostics.forEach( element => {
			
			if (range.start.line == element.range.start.line &&
				range.end.line == element.range.end.line) {
					
				// Fix some common errors
				switch (element.message.toLowerCase()) {
					case 'no strict mode set':
						var makeStrict = new vscode.CodeAction( 'Insert Strict', vscode.CodeActionKind.QuickFix )
						makeStrict.edit = new vscode.WorkspaceEdit()
						makeStrict.edit.insert( document.uri, element.range.start, 'Strict\n' )
						makeStrict.diagnostics = [element]
						fixes.push( makeStrict )
						
						var makeSuperStrict = new vscode.CodeAction( 'Insert SuperStrict', vscode.CodeActionKind.QuickFix )
						makeSuperStrict.edit = new vscode.WorkspaceEdit()
						makeSuperStrict.edit.insert( document.uri, element.range.start, 'SuperStrict\n' )
						makeSuperStrict.diagnostics = [element]
						fixes.push( makeSuperStrict )
						break
					
					case 'use as framework':
						var fix = new vscode.CodeAction( 'Make Framework', vscode.CodeActionKind.QuickFix )
						fix.edit = new vscode.WorkspaceEdit()
						fix.edit.replace( document.uri, new vscode.Range(range.start, range.start.translate(0, 6)), 'Framework' )
						fix.diagnostics = [element]
						fixes.push( fix )
						break
					
					default:
						break
				}
			}
		})
		
		return fixes
	}
}
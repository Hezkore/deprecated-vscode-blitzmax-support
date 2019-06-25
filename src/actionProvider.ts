'use strict'

import * as vscode from 'vscode'

export class BmxActionProvider implements vscode.CodeActionProvider {
	
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];
	
	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] | undefined {
		if (!this.isAtStartOfSmiley(document, range)) {
			return;
		}
		
		const replaceWithSmileyCatFix = this.createFix(document, range, '😺');
		
		const replaceWithSmileyFix = this.createFix(document, range, '😀');
		// Marking a single fix as `preferred` means that users can apply it with a
		// single keyboard shortcut using the `Auto Fix` command.
		replaceWithSmileyFix.isPreferred = true;
		
		const replaceWithSmileyHankyFix = this.createFix(document, range, '💩');
		
		return [
			replaceWithSmileyCatFix,
			replaceWithSmileyFix,
			replaceWithSmileyHankyFix
		];
	}
	
	private isAtStartOfSmiley(document: vscode.TextDocument, range: vscode.Range) {
		const start = range.start;
		const line = document.lineAt(start.line);
		return line.text[start.character] === ':' && line.text[start.character + 1] === ')';
	}
	
	private createFix(document: vscode.TextDocument, range: vscode.Range, emoji: string): vscode.CodeAction {
		const fix = new vscode.CodeAction(`Convert to ${emoji}`, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();
		fix.edit.replace(document.uri, new vscode.Range(range.start, range.start.translate(0, 2)), emoji);
		return fix;
	}
}
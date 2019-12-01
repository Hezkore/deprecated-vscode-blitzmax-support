import * as vscode from 'vscode'
import { quickAnalyze } from './quickAnalyze'
import { getFirstEmptyLine } from './common'

export const collection = vscode.languages.createDiagnosticCollection()

export async function refreshDiagnostics( doc: vscode.TextDocument ) {
	let diags: vscode.Diagnostic[] = []
	
	let result = await quickAnalyze( doc.getText() )
	if (!result.strict) {
		
		let firstLine: vscode.Position = await getFirstEmptyLine( doc.getText() )
		
		diags.push({
			code: '',
			message: 'No strict mode set',
			range: new vscode.Range(firstLine, firstLine.translate( 0, 0 )),
			severity: vscode.DiagnosticSeverity.Hint,
			source: '',
			relatedInformation: [
				new vscode.DiagnosticRelatedInformation(
					new vscode.Location( doc.uri,
						new vscode.Position(0, 0)),
						'Use Strict or SuperStrict to make your code "safer"')
			]
		})
	}
	
	if (result.firstImportLine >= 0 && result.framework.length < 1) {
		
		diags.push({
			code: '',
			message: 'Use as Framework',
			range: new vscode.Range(new vscode.Position( result.firstImportLine, 0 ),
				new vscode.Position( result.firstImportLine, 0 )),
			severity: vscode.DiagnosticSeverity.Hint,
			source: '',
			relatedInformation: [
				new vscode.DiagnosticRelatedInformation(
					new vscode.Location( doc.uri,
						new vscode.Position(0, 0)),
						"It's a good idea to use a Framework to cut down on filesize and compile time")
			]
		})
	}
	
	collection.set( doc.uri, diags )
}

export function register( context: vscode.ExtensionContext ) {
	
	if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId == 'blitzmax')
		refreshDiagnostics( vscode.window.activeTextEditor.document )
	
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor( editor => {
			if (editor && editor.document.languageId == 'blitzmax')
				refreshDiagnostics( editor.document )
		})
	)
	
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument( e => {
				if (e.document.languageId == 'blitzmax')
					refreshDiagnostics( e.document )
		})
	)
	
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument( doc => collection.delete( doc.uri ) )
	)
}
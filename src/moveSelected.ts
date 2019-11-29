import * as vscode from 'vscode'
import { quickAnalyze } from './quickAnalyze'
import { BlitzMax } from './blitzmax'

export async function moveSelectedText( context: vscode.ExtensionContext ) {
	
	var editor = vscode.window.activeTextEditor
	if (!editor)
	{
		vscode.window.showErrorMessage( 'No text editor active' )
		return
	}
	var selection = editor.selection
	var selectedText = editor.document.getText(selection)
	if (selectedText.length <= 0)
	{
		vscode.window.showErrorMessage( 'No text selected' )
		return
	}
	
	//var analyzeResult = await quickAnalyze( selectedText )
	var analyzeFileResult = await quickAnalyze( editor.document.getText() )
	
	if (!analyzeFileResult.strict && !BlitzMax.legacy)
		selectedText = `Strict\n\n${selectedText}`
	else if (analyzeFileResult.strict)
		selectedText = `${analyzeFileResult.strictType}\n\n${selectedText}`
		
	let doc: vscode.TextDocument = await vscode.workspace.openTextDocument(
		{ content: selectedText, language: editor.document.languageId } )
	
	vscode.window.showTextDocument( doc )
	
	editor.edit(builder => { builder.replace( selection, '' ) })
}
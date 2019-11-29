import * as vscode from 'vscode'
import { quickAnalyze } from './quickAnalyze'

export async function moveSelectedText( context: vscode.ExtensionContext ) {
	
	var editor = vscode.window.activeTextEditor
	if (!editor)
	{
		vscode.window.showErrorMessage( "No text editor active" )
		return
	}
	var selection = editor.selection
	var selectedText = editor.document.getText(selection)
	if (selectedText.length <= 0)
	{
		vscode.window.showErrorMessage( "No text selected" )
		return
	}
	
	var analyzeResult = await quickAnalyze( selectedText )
	
	if (!analyzeResult.strict)
		selectedText = 'SuperStrict\n\n' + selectedText
	
	let doc: vscode.TextDocument = await vscode.workspace.openTextDocument(
		{ content: selectedText, language: editor.document.languageId } )
	
	vscode.window.showTextDocument( doc )
	
	editor.edit(builder => { builder.replace( selection, '' ) })
}
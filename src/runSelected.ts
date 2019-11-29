import { writeFile, exists, createDir, removeDir, removeFile } from './common'
import { makeTask, BmxTaskDefinition } from './taskProvider'
import { quickAnalyze } from './quickAnalyze'
import * as vscode from 'vscode'
import * as path from 'path'
import { BlitzMax } from './blitzmax'

export async function runSelectedText( context: vscode.ExtensionContext ) {
	
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
	
	// Generate template
	var analyzeSelectedResult = await quickAnalyze( selectedText )
	var analyzeFileResult = await quickAnalyze( editor.document.getText() )
	
	let template: string = ''
	if (!analyzeFileResult.strict && !BlitzMax.legacy)
		template += 'Strict\n'
	else if (analyzeFileResult.strict)
		template += `${analyzeFileResult.strictType}\n`
	
	if (analyzeFileResult.framework.length > 3 && analyzeSelectedResult.framework != analyzeFileResult.framework)
		template += `Framework ${analyzeFileResult.framework}\n`
	
	analyzeFileResult.imports.forEach(name => {
		if (!analyzeSelectedResult.imports.includes( name ))
			template += `Import ${name}\n`
	})
	let code: string = template + selectedText
	
	let tmpPath: string | undefined = context.storagePath
	if (!tmpPath)
	{
		vscode.window.showErrorMessage( 'Storage path does not exist' )
		return
	}
	
	tmpPath = path.join( tmpPath, 'tmp' )
	
	if (!await createDir( tmpPath ))
	{
		vscode.window.showErrorMessage( 'Unable to create temporary folder' )
		return
	}
	
	let fileName: string = Math.random().toString(36).replace('0.', '')
	let tmpSourceFilePath: string = path.join( path.dirname( editor.document.uri.fsPath ), fileName + '.bmx' )
	let tmpOutFilePath: string = path.join( tmpPath, fileName )
	
	console.log( code )
	await writeFile( tmpSourceFilePath, code )
	
	if (!await exists( tmpSourceFilePath ) )
	{
		vscode.window.showErrorMessage( 'Unable to create temporary code file' )
		return
	}
	
	const def: BmxTaskDefinition = { type: 'bmx', make: 'makeapp', app: 'console',
		arch: 'auto', platform: 'auto', threaded: true, source: tmpSourceFilePath,
		output: tmpOutFilePath, debug: true, execute: true, quick: true, verbose: false }
	
	const task = makeTask( def, 'Build Selected Text' )
	if (!task)
	{
		vscode.window.showErrorMessage( 'Unable to create temporary task' )
		return
	}
	
	task.problemMatchers = []
	
	vscode.tasks.onDidEndTask(( async (e) =>
	{	
		if (e.execution.task == task && tmpPath)
		{
			if (!await removeDir( tmpPath ))
				vscode.window.showErrorMessage( 'Unable to clean temporary output folder' )
			if (!await removeFile( tmpSourceFilePath ))
				vscode.window.showErrorMessage( 'Unable to clean temporary files' )
		}
	}))
	
	await vscode.tasks.executeTask( task )
}
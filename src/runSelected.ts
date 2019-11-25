import { writeFile, exists, createDir, removeDir } from './common'
import { makeTask, BmxTaskDefinition } from './taskProvider'
import * as vscode from 'vscode'
import * as path from 'path'

export async function runSelectedText( context: vscode.ExtensionContext ) {
	
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
	
	let template:string = "Strict"
	let templateItems:string[] | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'runSelectedTextTemplate' )
	if (templateItems)
	{
		if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'runSelectedTextSuperStrict' ))
			template = "SuperStrict"
		
		templateItems.forEach(s => {
			template += "\n" + s
		})
		template += "\n"
	}
	let code:string = template + selectedText
	
	let tmpPath: string | undefined = context.storagePath
	if (!tmpPath)
	{
		vscode.window.showErrorMessage( "Storage path does not exist" )
		return
	}
	
	tmpPath = path.join( tmpPath, "tmp" )
	
	if (await createDir( tmpPath ) == false)
	{
		vscode.window.showErrorMessage( "Unable to create temporary folder" )
		return
	}
	
	let tmpFilePath: string = path.join( tmpPath, Math.random().toString(36).replace('0.', '')  + ".bmx" )
	
	await writeFile( tmpFilePath, code )
	
	if (!await exists( tmpFilePath ) )
	{
		vscode.window.showErrorMessage( "Unable to create temporary code file" )
		return
	}
	
	const def: BmxTaskDefinition = { type: 'bmx', make: 'makeapp', app: 'console',
	arch: 'auto', platform: 'auto', threaded: true, source: `${tmpFilePath}`,
	debug: true, execute: true, quick: true, verbose: false }
	
	const task = makeTask( def, 'Build Selected Text' )
	if (!task)
	{
		vscode.window.showErrorMessage( "Unable to create temporary task" )
		return
	}
	
	vscode.tasks.onDidEndTask(( async (e) => {
		
		if (e.execution.task == task && tmpPath && !await removeDir(tmpPath))
			vscode.window.showErrorMessage( "Unable to clean temporary folder" )
	}))
	
	await vscode.tasks.executeTask( task )
}
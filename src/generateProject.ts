import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

export function generateProject( context: vscode.ExtensionContext ) {
	
	if (!vscode.workspace.workspaceFolders)
	{
		vscode.window.showErrorMessage( 'No Workspace open' )
		return
	}
	
	vscode.workspace.workspaceFolders.forEach( workspace => {
		
		vscode.window.showQuickPick( ['Application', 'Module'] ).then( selection => {
			if (!selection)
				return
			
			let sourceFile: vscode.TextEditor
			switch (selection.toLowerCase()) {
				case 'application':
					let srcPath = path.join( workspace.uri.fsPath, 'src' )
					let mainPath = path.join( srcPath, 'main.bmx' )
					if (!fs.existsSync( srcPath ))
					{
						fs.mkdirSync( srcPath )
						fs.writeFileSync( mainPath, '' )
						
						vscode.window.showTextDocument( vscode.Uri.parse( mainPath ) ).then( _ => {
							if (!vscode.window.activeTextEditor)
								return
							
							sourceFile = vscode.window.activeTextEditor
							vscode.commands.executeCommand( 'editor.action.showSnippets' ).then( _ => {
								
								vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultTestTask' ).then( _ => {
									
									vscode.commands.executeCommand( 'blitzmax.setSourceFile', sourceFile.document.uri )
								})
							})
						})
					}
					break
				
				case 'module':
					const modPath = path.join( workspace.uri.fsPath, `${workspace.name}.bmx` )
					if (!fs.existsSync( modPath ))
					{
						fs.writeFileSync( modPath, '' )
						
						vscode.window.showTextDocument( vscode.Uri.parse( modPath ) ).then( _ => {
							if (!vscode.window.activeTextEditor)
								return
							
							sourceFile = vscode.window.activeTextEditor
							vscode.commands.executeCommand( 'editor.action.showSnippets' ).then( _ => {
								
								vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultTestTask' ).then( _ => {
									
									vscode.commands.executeCommand( 'blitzmax.setSourceFile', sourceFile.document.uri )
								} )
							})
						})
					}
					break
				
				default:
					vscode.window.showInformationMessage( 'Not done yet - ' + selection )
					break
			}
		})
	})
}
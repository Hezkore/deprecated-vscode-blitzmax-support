import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

export function generateProject( context: vscode.ExtensionContext ) {
	
	if (!vscode.workspace.workspaceFolders)
	{
		vscode.window.showErrorMessage( 'You need open a workspace/folder before using this command' )
		return
	}
	
	vscode.workspace.workspaceFolders.forEach( workspace => {
		
		if (workspace.name.toLowerCase().endsWith( '.mod' )){
			
			const modPath = path.join( workspace.uri.fsPath, `${workspace.name.slice( 0, -4 )}.bmx` )
			if (!fs.existsSync( modPath ))
			{
				fs.writeFileSync( modPath, '' )
				
				vscode.window.showTextDocument( vscode.Uri.file( modPath ) ).then( _ => {
					if (!vscode.window.activeTextEditor)
					{
						vscode.window.showErrorMessage( 'Unable to open module entry point' )
						return
					}
					
					vscode.commands.executeCommand( 'editor.action.showSnippets' ).then( _ => {
						
						vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultTestTask' )
					})
				})
			}
		}else{
			
			let srcPath = path.join( workspace.uri.fsPath, 'src' )
			let mainPath = path.join( srcPath, 'main.bmx' )
			if (!fs.existsSync( srcPath ))
			{
				fs.mkdirSync( srcPath )
				fs.writeFileSync( mainPath, '' )
				
				vscode.window.showTextDocument( vscode.Uri.file( mainPath ) ).then( _ => {
					if (!vscode.window.activeTextEditor)
					{
						vscode.window.showErrorMessage( 'Unable to open project entry point' )
						return
					}
					
					vscode.commands.executeCommand( 'editor.action.showSnippets' ).then( _ => {
						
						vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultTestTask' )
					})
				})
			}
		}
	})
}
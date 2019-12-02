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
		
		vscode.window.showQuickPick( ['Application', 'MaxGUI', 'Module'] ).then( selection => {
			if (!selection)
				return
			
			switch (selection.toLowerCase()) {
				case 'application':
					const srcPath = path.join( workspace.uri.fsPath, 'src' )
					if (!fs.existsSync( srcPath ))
					{
						fs.mkdirSync( srcPath )
						fs.writeFileSync( path.join( srcPath, 'main.bmx' ), 'sjhoop' )
					}
					
					break
			
				default:
					vscode.window.showInformationMessage( 'Not done yet - ' + selection )
					break
			}
		})
	})
}
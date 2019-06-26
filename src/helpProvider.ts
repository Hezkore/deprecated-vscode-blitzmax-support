'use strict'

import * as vscode from 'vscode'

export async function showHelp( word:string ){
	
	vscode.window.showInformationMessage( "NO HELP FOR: " + word )
}
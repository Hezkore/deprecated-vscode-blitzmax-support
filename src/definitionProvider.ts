'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { BlitzMax } from './blitzmax'
import { currentWord } from './common'

export class BmxDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
		
		if (!BlitzMax.ready) return null

        const word = currentWord().toLowerCase()
		if (!word) return null
		
		const cmds = BlitzMax.getCommand( word )
		if (!cmds || cmds.length <= 0) return null
		
		const defs: vscode.Location[] = []
		for(var i=0; i<cmds.length; i++){
			
			if (!cmds[i] || !cmds[i].regards.file) break
			
			defs.push(
				new vscode.Location(
					vscode.Uri.parse( 'bmx-external:' + path.join( BlitzMax.path, cmds[i].regards.file ) ),
					new vscode.Position( cmds[i].regards.line, 0 )
				)
			)
		}
		
		return defs
	}
}
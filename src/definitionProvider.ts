'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { BlitzMax } from './blitzmax'
import { currentWord } from './common'
import { AnalyzeDoc, commands } from './bmxModules'

export class BmxDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
		
		if (!BlitzMax.ready) return null
		

        const word = currentWord().toLowerCase()
		if (!word) return null
		
		const item:AnalyzeDoc | undefined = commands.get( word )
		if (!item || !item.regards) return null
		
        return new vscode.Location( vscode.Uri.parse( 'bmx-external:' + path.join( BlitzMax.path, item.regards.file ) ), new vscode.Position( item.regards.line, 0 ) )
	}
}
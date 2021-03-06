'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { BlitzMax } from './blitzmax'
import { currentWord, currentWordTrigger } from './common'

export class BmxDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition( document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken ): vscode.ProviderResult<vscode.Definition> {
		
		if (!BlitzMax.ready) return null
		
		// What word are we looking for?
		let word  = currentWord( position, document )
		if (!word) return undefined
		word = word.toLowerCase()
		
		// Try to figure out the "trigger"
		let wordTrigger: string = currentWordTrigger( position, document )
		
		// Are we looking for things inside a type?
		const fromType: boolean = wordTrigger == '.' ? true : false
		
		// Filter to only search some modules
		let fromModules: string[] = []
		
		// Find the word in our command list
		const cmds = BlitzMax.searchCommands( word, fromType, fromModules )
		
		if (!cmds || cmds.length <= 0) return null
		
		const defs: vscode.Location[] = []
		for(var i=0; i<cmds.length; i++){
			
			if (!cmds[i] || !cmds[i].regards.file) continue
			
			defs.push(
				new vscode.Location(
					vscode.Uri.parse( 'file:' + path.join( BlitzMax.path, cmds[i].regards.file ) ),
					new vscode.Position( cmds[i].regards.line, 0 )
				)
			)
		}
		
		return defs
	}
}
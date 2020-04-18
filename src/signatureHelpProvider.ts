'use strict'

import * as vscode from 'vscode'
import { BlitzMax } from './blitzmax'

export class BmxSignatureHelpProvider implements vscode.SignatureHelpProvider {
    provideSignatureHelp( document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext): vscode.ProviderResult<vscode.SignatureHelp> {
		
		let call = this.findStart( document, position )
		if (!call) return null
		
		const funcRange = this.previousTokenPosition(document, call.openParen)
		const fileContents = document.getText()
		const funcName = fileContents.slice(document.offsetAt(funcRange.start), document.offsetAt(funcRange.end))
		const paramIndex = call.commas.length
		
		const cmds = BlitzMax.searchCommands( funcName )
		if (!cmds || cmds.length <= 0) return null
		
		const sigStack = new vscode.SignatureHelp()
		let sigCmd: vscode.SignatureInformation
		let sigParam: vscode.ParameterInformation
		let cmdPreview: string
		let paramPreview: string
		
		for(var ci=0; ci<cmds.length; ci++){
			
			const cmd = cmds[ci]
			const args = cmd.regards.args
			if (!args) continue
			if (args.length - 1 < paramIndex) continue
			
			if (cmd.regards.name){
				cmdPreview = cmd.regards.name
			}else{ cmdPreview = funcName }
			
			cmdPreview += '( '
			
			sigCmd = new vscode.SignatureInformation( cmdPreview )
			sigCmd.documentation = cmd.info
			
			for(var ai=0; ai<args.length; ai++){
				
				const arg = args[ai]
				if (!arg) continue
				
				paramPreview = arg.name + ':' + arg.returns
				cmdPreview += paramPreview
				if (arg.default) cmdPreview += ' = ' + arg.default
				if (ai < args.length - 1) cmdPreview += ', '
				
				sigParam = new vscode.ParameterInformation( paramPreview )
				
				sigCmd.parameters.push( sigParam )
			}
			
			cmdPreview += ' )'
			sigCmd.label = cmdPreview
			sigStack.signatures.push( sigCmd )
		}
		
		sigStack.activeSignature = 0
		sigStack.activeParameter = paramIndex
		
		return sigStack
	}
	
	private previousTokenPosition( document: vscode.TextDocument, position: vscode.Position ): any {
		
		while (position.character > 0) {
			
			let word = document.getWordRangeAtPosition( position )
			if (word) return word
			position = position.translate( 0, -1 )
		}
		
		return null
	}
	
	private findStart( document: vscode.TextDocument, position: vscode.Position ): any {
		
		let currentLine = document.lineAt( position.line ).text.substring( 0, position.character )
		let parenBalance = 0
		let commas: vscode.Position[] = []
		
		for (let char = position.character; char >= 0; char--){
			switch (currentLine[char]) {
				case '(':
					parenBalance--
					if (parenBalance < 0) {
						return {
							openParen: new vscode.Position(position.line, char),
							commas: commas
						}
					}
					break
					
				case ')':
					parenBalance++
					break
					
				case ',':
					if (parenBalance === 0) {
						commas.push(new vscode.Position(position.line, char))
					}
			}
		}
		
		return null
	}
}
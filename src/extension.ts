'use strict'

import * as vscode from 'vscode'
import { setWorkspaceSourceFile, currentBmx, bmxBuild } from './common'
import { BmxTaskProvider } from './taskProvider'
import { BmxFormatProvider } from './formatProvider'

export function activate( context: vscode.ExtensionContext): void {
	
	// Format provider
	//context.subscriptions.push(
	//	vscode.languages.registerDocumentFormattingEditProvider('blitzmax', new BmxFormatProvider )
	//)
	
	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider( 'bmx', new BmxTaskProvider)
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildConsole', () => {
			
			bmxBuild( 'makeapp', 'console' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildGui', () => {
			
			bmxBuild( 'makeapp', 'gui' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildMods', () => {
			
			bmxBuild( 'makemods' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.buildLib', () => {
			
			bmxBuild( 'makelib' )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFile', () => {
			
			setWorkspaceSourceFile( currentBmx() )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.setSourceFileMenu', context => {
			
			setWorkspaceSourceFile( context.fsPath )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.quickBuild', () => {
			
			bmxBuild( 'makeapp', 'console', true, true )
		})
	)
	
	context.subscriptions.push(
		vscode.commands.registerCommand( 'blitzmax.build', () => {
			
			vscode.commands.executeCommand( 'workbench.action.tasks.build' )
		})
	)
}

export function deactivate(): void {
}
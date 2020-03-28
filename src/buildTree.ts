import * as vscode from 'vscode'
import * as path from 'path'
import { currentBmx, isPartOfWorkspace } from './common'
import { currentDefinition } from './taskProvider'

export class BmxBuildTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | null> = new vscode.EventEmitter<vscode.TreeItem | null>()
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> = this._onDidChangeTreeData.event
	
	private isForWorkspace: boolean = false
	
	constructor( private context: vscode.ExtensionContext ) {
		
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged())
		vscode.workspace.onDidSaveTextDocument(e => this.onDocumentSaved())
		this.onActiveEditorChanged()
	}
	
	private onActiveEditorChanged(): void {
		this.refresh()
	}
	
	private onDocumentSaved(): void {
		this.refresh()
	}
	
	refresh() {
		this._onDidChangeTreeData.fire()
	}
	
	createChildItem( label: string, tooltip: string, state: string | undefined, command: string = 'blitzmax.toggleBuildOption', cmdArgs: string[] = [] ): vscode.TreeItem {
		
		let item = new vscode.TreeItem( label, vscode.TreeItemCollapsibleState.None )
		item.description = state ? state : 'Undefined'
		item.tooltip = tooltip
		item.command = {
			command: command,
			title: '',
			arguments: cmdArgs.length > 0 ? cmdArgs : [label.toLowerCase(), this.isForWorkspace]
		}
		
		return item
	}
	
	getChildren( element?: vscode.TreeItem ): Thenable<vscode.TreeItem[]> {
		
		if (element) {
			
			let def = currentDefinition()
			let items: vscode.TreeItem[] = []
			
			items.push( this.createChildItem( 'App', 'Specifies the application type (makeapp only)', def.app ) )
			items.push( this.createChildItem( 'Debug', 'Build as Debug', def.debug ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'Quick', 'Quick build\nDoes not scan modules for changes\nMay result in quicker build times on some systems\nThe default behaviour is to scan and build all requirements for the application, including modules', def.quick ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'Source', 'Main source file', def.source ) )
			items.push( this.createChildItem( 'Output', 'pecifies the output file (makeapp only)\nBy default, the output file is placed into the same directory as the root source file', def.output ) )
			items.push( this.createChildItem( 'Make', 'What to build as', def.make ) )
			items.push( this.createChildItem( 'Arch', 'Compiles to the specified architecture', def.arch ) )
			items.push( this.createChildItem( 'Platform', 'Cross-compiles to the specific target platform', def.platform ) )
			items.push( this.createChildItem( 'Threaded', 'Builds multithreaded version', def.threaded ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'GDB', 'Generates line mappings suitable for GDB debugging', def.gdb ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'Execute', 'Execute built application', def.execute ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'Verbose', 'Verbose (noisy) build', def.verbose ? 'true' : 'false' ) )
			items.push( this.createChildItem( 'Appstub', 'Builds an app using a custom appstub (The default is brl.appstub)\nThis can be useful when you want more control over low-level application state and the debugger', def.appstub ) )
			
			return Promise.resolve( items )
		} else {
			
			let rootName: string = 'Unknown'
			
			const sourceFile = currentBmx( false )
			if (sourceFile) {

				const workspaceFolder = vscode.workspace.getWorkspaceFolder( sourceFile )
				rootName = workspaceFolder ?
					'Workspace: ' + workspaceFolder.name.toUpperCase()
					:
					'File: ' + path.basename( sourceFile.fsPath )
				this.isForWorkspace = workspaceFolder ? true : false
			} else {
				
				if (vscode.workspace && vscode.workspace.getWorkspaceFolder.length > 0){
					rootName = 'Workspace: ' + vscode.workspace.name?.toUpperCase()
					this.isForWorkspace = true
				} else {
					this.isForWorkspace = false
					return Promise.resolve( [] )
				}
			}
			
			return Promise.resolve( [
				new vscode.TreeItem( rootName, vscode.TreeItemCollapsibleState.Expanded )
			] )
		}
	}
	
	getTreeItem( element: vscode.TreeItem ): vscode.TreeItem {
		return element
	}
}
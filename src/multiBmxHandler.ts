import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMax } from './blitzmax'

interface multiBmxPath {
	name: string
	path: string
}

export class MultiBmxTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | null> = new vscode.EventEmitter<vscode.TreeItem | null>()
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> = this._onDidChangeTreeData.event
	
	async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		
		if (!element) {
			
			let root:vscode.TreeItem[] = []
			const paths: multiBmxPath[] | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
			
			if (paths) {
				let index = 0
				paths.forEach( pathItem => {
					root.push( this.createChildItem( pathItem, index.toString() ) )
					index++
				})
			}
			
			return root
		}
		
		return []
	}
	
	createChildItem( pathItem: multiBmxPath, index: string ): vscode.TreeItem {
		
		let item = new vscode.TreeItem( pathItem.name, vscode.TreeItemCollapsibleState.None )
		item.tooltip = pathItem.path
		item.id = index
		item.command = {
			command: 'blitzmax.setPath',
			title: 'Change BlitzMax Path',
			arguments: [pathItem.path, `Switching to ${pathItem.name}`]
		}
		
		if (BlitzMax.path == pathItem.path)
			item.description = 'in use'
		
		return item
	}
	
	getTreeItem( element: vscode.TreeItem ): vscode.TreeItem {
		return element
	}
	
	refresh() {
		this._onDidChangeTreeData.fire()
	}
}

export class MultiBmxExplorer {
	
	constructor( context: vscode.ExtensionContext ) {
		const treeDataProvider = new MultiBmxTreeProvider()
		vscode.window.registerTreeDataProvider( 'blitzmax-multi', treeDataProvider)
		vscode.commands.registerCommand( 'blitzmax.refreshMultiBmx', () => treeDataProvider.refresh() )
		
		vscode.workspace.onDidChangeConfiguration( event => {
			if (event.affectsConfiguration( 'blitzmax.multiBmxPath' ))
				vscode.commands.executeCommand( 'blitzmax.refreshMultiBmx' )
		})
	}
}

export async function renameMultiPath( item: vscode.TreeItem ) {
	
	const selectedName = await vscode.window.showInputBox( {value: path.basename( item.label ? item.label : '' ), placeHolder: 'My BlitzMax Installation'} )
	if (selectedName) {
		
		const paths: multiBmxPath[] | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
		if (!paths) return
		
		let newPaths: multiBmxPath[] = []
		
		let index = 0
		paths.forEach( pathItem => {
			if (index.toString() == item.id) pathItem.name = selectedName
			newPaths.push( pathItem )
			index++
		})
		
		await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'multiBmxPath', newPaths, true )
	}
}

export async function removeMultiPath( item: vscode.TreeItem ) {
	
	const paths: multiBmxPath[] | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
	if (!paths) return
	
	let newPaths: multiBmxPath[] = []
	
	let index = 0
	paths.forEach( pathItem => {
		if (index.toString() != item.id)
			newPaths.push( pathItem )
		index++
	})
	
	await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'multiBmxPath', newPaths, true )
}

export async function switchMultiPath( item: vscode.TreeItem ) {
	
	if (item.command && item.command.arguments)
		vscode.commands.executeCommand( item.command.command, item.command.arguments[0], item.command.arguments[1] )
}

export async function addNewMultiPath() {
	
	const folderOpt: vscode.OpenDialogOptions = {
		canSelectMany: false,
		canSelectFolders: true,
		canSelectFiles: false,
		openLabel: 'Select'
	}
	
	// Show a dialog for selecting the BlitzMax folder
	await vscode.window.showOpenDialog( folderOpt ).then( async fileUri => {
		
		if (fileUri && fileUri[0]) {
			
			const selectedName = await vscode.window.showInputBox( {value: path.basename( fileUri[0].fsPath ) ,placeHolder: 'My BlitzMax Installation'} )
			if (selectedName) {
					
				let paths: multiBmxPath[] | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
				if (!paths) paths = []
				paths.push( { name: selectedName, path: fileUri[0].fsPath} )
				await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'multiBmxPath', paths, true )
			}
		}
	})
}
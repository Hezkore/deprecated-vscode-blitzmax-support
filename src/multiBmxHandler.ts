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

async function getMultiPath( name: string | undefined = undefined, path: string | undefined = undefined ): Promise<multiBmxPath | undefined> {
	
	return new Promise<multiBmxPath | undefined>( ( resolve, _reject ) => {
		
		if (!name && !path) return resolve()
		if (name) name = name.toLowerCase()
		
		const paths: multiBmxPath[] | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
		if (!paths) return resolve()
		
		paths.forEach( pathItem => {
			
			if (name){
				if (name == pathItem.name.toLowerCase()) return resolve( pathItem )
			}
			
			if (path){
				if (path == pathItem.path) return resolve( pathItem )
			}
		})
		
		return resolve()
	})
}

export async function renameMultiPath( item: vscode.TreeItem ) {
	
	const selectedName = await vscode.window.showInputBox( {value: path.basename( item.label ? item.label : '' ), placeHolder: 'My BlitzMax Installation'} )
	if (selectedName && selectedName.toLowerCase() != item.label?.toLowerCase()) {
		
		if (await getMultiPath( selectedName )) {
			vscode.window.showErrorMessage( 'This version name already exists' )
			renameMultiPath( item )
			return
		}
		
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
			
			// Check if this version already exists
			const existingPath = await getMultiPath( undefined, fileUri[0].fsPath )
			if (existingPath) {
				vscode.window.showErrorMessage( 'The version ' + existingPath.name + ' already uses this path' )
				return
			}
			
			let selectedName = await vscode.window.showInputBox( {value: path.basename( fileUri[0].fsPath ), placeHolder: 'My BlitzMax Installation'} )
			if (selectedName) {
				
				// Check if this name already exists
				if (await getMultiPath( selectedName )) {
					let index: number = 2
					const origName: string = selectedName
					while (await getMultiPath( selectedName )) {
						selectedName = origName + index.toString()
						index++
					}
					vscode.window.showErrorMessage( 'This version name already exists.\nRenaming to ' + selectedName )
				}
					
				let paths: multiBmxPath[] | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'multiBmxPath' )
				if (!paths) paths = []
				
				// Make sure to add current version
				if (paths.length <= 0) {
					if (fileUri[0].fsPath != BlitzMax.path) {
						
						await vscode.window.showInformationMessage( "Automatically add the BlitzMax version you're currently using?", 'Yes', 'No').then( selection => {
							
							if (paths && selectedName && selection?.toLowerCase() == 'yes') {
								// Find a fitting default name
								let curVerName: string = path.basename( BlitzMax.path )
								if (curVerName.toLowerCase() == selectedName.toLowerCase())
									curVerName = 'Default ' + curVerName
								
								paths.push( { name: curVerName, path: BlitzMax.path} )
							}
						})
					}
				}
				
				paths.push( { name: selectedName, path: fileUri[0].fsPath} )
				await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'multiBmxPath', paths, true )
			}
		}
	})
}
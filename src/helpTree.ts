import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMax } from './blitzmax'
import { BmxModule, AnalyzeDoc } from './bmxModules'
import { showModuleDocumentation } from './documentationHandler'

enum HelpType{
	Unknown,
	BmxDir,
	File,
	ModulesRoot,
	Module,
	Documentation,
	Introduction
}

interface Entry {
	name: string
	path: string
	desc?: string
	type: HelpType
	module?: BmxModule
	command?: AnalyzeDoc
}

export class BmxHelpTreeProvider implements vscode.TreeDataProvider<Entry> {
	
	private readonly acceptedFolderNames = [
		'samples','sample',
		'examples','example',
		'tests','test',
		'docs','doc'
	]
	
	private _onDidChangeTreeData: vscode.EventEmitter<Entry | null> = new vscode.EventEmitter<Entry | null>()
	readonly onDidChangeTreeData: vscode.Event<Entry | null> = this._onDidChangeTreeData.event
	private _allItems: vscode.TreeItem[] = []
	
	async getChildren( element?: Entry ): Promise<Entry[]> {
		
		if (!element) return this.createRoot()
		
		switch (element.type) {
			case HelpType.BmxDir: return this.createBmxDir( element )
			case HelpType.ModulesRoot: return this.createModulesRoot( element )
			case HelpType.Module: return this.createModule( element )
		}
		
		return []
	}
	
	createRoot(): Entry[] {
		
		let root: Entry[] = []
		
		root.push( {
			path: path.join( BlitzMax.path, 'samples' ),
			type: HelpType.BmxDir,
			name: 'Samples'
		} )
		
		root.push( {
			path: path.join( BlitzMax.path, 'mod' ),
			type: HelpType.ModulesRoot,
			name: 'Modules'
		} )
		
		return root
	}
	
	createModule( element: Entry ): Entry[] {
		
		if (!element.module || !element.module.commands) return []
		
		let root: Entry[] = []
		
		// First we add the introduction to the module
		for (let i = 0; i < element.module.commands.length; i++) {
			const cmd: AnalyzeDoc = element.module.commands[i]
			
			if (cmd.regards.name == element.module.name) {
				
				root.push( {
					path: element.path,
					type: HelpType.Introduction,
					name: 'Introduction',
					command: cmd,
					desc: cmd.regards.type
				} )
				
				break
			}
		}
		
		// Then we add the examples
		const subFolders = fs.readdirSync( element.path )
		subFolders.forEach( folder => {
			
			if (this.acceptedFolderNames.includes( folder.toLowerCase() )) {
				
				root.push( {
					path: path.join( element.path, folder ),
					type: HelpType.BmxDir,
					name: folder.toLowerCase()
				})
			}
		})
		
		// Then we add all the commands
		element.module.commands.forEach( cmd => {
			
			if (element.module && cmd.regards.name != element.module.name ) {
				
				let desc = ''
				
				// Make things pretty!
				if (cmd.regards.returns) desc += cmd.regards.returns
				if (cmd.regards.type == 'function' || cmd.regards.type == 'method') desc += '('
				if (cmd.regards.args){
					cmd.regards.args.forEach( arg => {
						desc += ` ${arg.name}`
						if (arg.returns) desc += `:${arg.returns}`
						desc += ','
					})
					desc = desc.slice( 0, -1 )
				}
				if (cmd.regards.type == 'function' || cmd.regards.type == 'method') desc += ' )'
				
				root.push( {
					path: path.join( BlitzMax.modPath, element.module.file ),
					type: HelpType.Documentation,
					name: cmd.regards.name ? cmd.regards.name : 'Undefined',
					command: cmd,
					desc: desc.length > 0 ? desc : cmd.regards.type
				})
			}
		})
		
		
		
		return root
	}
	
	createModulesRoot( element: Entry ): Entry[] {
		
		let root: Entry[] = []
		
		BlitzMax.modules.forEach( mod => {
			
			if (mod.commands && mod.commands.length > 0) {
				root.push( {
					path: path.join( element.path, mod.parent, mod.folderName ),
					type: HelpType.Module,
					name: mod.name ? mod.name : 'Undefined',
					module: mod
				} )
			}
		})
		
		return root
	}
	
	createBmxDir( element: Entry ): Entry[] {
		
		let children = this._readDirectory( vscode.Uri.parse( element.path ) )		
		
		let root: Entry[] = []
		
		children.forEach( child => {
			
			if (child[1].isDirectory()) {
				
				root.push( {
					path: path.join( element.path, child[0] ),
					type: HelpType.BmxDir,
					name: child[0]
				} )
			} else {
				
				root.push( {
					path: path.join( element.path, child[0] ),
					type: HelpType.File,
					name: child[0]
				} )
			}
		})
		
		return root
	}
	
	getTreeItem( element: Entry ): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.name, (element.type === HelpType.File || element.type === HelpType.Documentation || element.type === HelpType.Introduction) ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed)
		treeItem.description = element.desc
		treeItem.tooltip = element.path
		treeItem.resourceUri = vscode.Uri.parse( element.path )
		
		if (element.type === HelpType.File) {
			treeItem.command = { command: 'blitzmax.helpExplorerOpenFile', title: "Open File", arguments: [element.path], }
			treeItem.contextValue = 'file'
		}
		
		if (element.type === HelpType.Documentation) {
			treeItem.command = { command: 'blitzmax.helpExplorerOpenDocumentation', title: "Open Documentation", arguments: [element.command], }
			treeItem.contextValue = 'documentation'
		}
		
		if (element.type === HelpType.Introduction) {
			treeItem.command = { command: 'blitzmax.moduleHelp', title: "Module Introduction", arguments: [element.module?.name], }
			treeItem.contextValue = 'introduction'
		}
		
		this._allItems.push( treeItem )
		
		return treeItem
	}
	
	markTreeItem( module: string, command: string ) {
		
		//console.log( 'Please mark tree module ' + module + ' and command ' + command )
	}
	
	refresh() {
		this._allItems = []
		this._onDidChangeTreeData.fire()
	}
	
	_readDirectory( uri: vscode.Uri ): [string, fs.Stats][] {
		
		if (!fs.existsSync( uri.fsPath )) return []
		
		const children = fs.readdirSync( uri.fsPath )
		
		const result: [string, fs.Stats][] = []
		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			const stat = fs.statSync( path.join( uri.fsPath, child ) )
			
			if (stat.isFile()) {
				//if (path.extname( child ).toLowerCase() != '.bmx') continue
				const extName = path.extname( child ).toLowerCase()
				if (!extName) continue
				if (extName == '.exe') continue
				if (extName == '.bak') continue
			} else {
				if (child.startsWith( '.' )) continue
				const subFolder = fs.readdirSync( path.join( uri.fsPath, child ) )
				if (subFolder.length <= 0) continue
			}
			
			result.push( [child, stat] )
		}
		
		return result
	}
}

export class BmxHelpExplorer {
	
	constructor( context: vscode.ExtensionContext ) {
		const treeDataProvider = new BmxHelpTreeProvider()
		vscode.window.registerTreeDataProvider( 'blitzmax-help', treeDataProvider)
		vscode.commands.registerCommand( 'blitzmax.helpExplorerOpenFile', (resource) => this.openResource(resource))
		vscode.commands.registerCommand( 'blitzmax.helpExplorerOpenDocumentation', (resource) => this.openDocumentation(resource))
		vscode.commands.registerCommand( 'blitzmax.helpExplorerSelect', (module, command) => treeDataProvider.markTreeItem(module, command))
		vscode.commands.registerCommand( 'blitzmax.refreshHelp', () => treeDataProvider.refresh() )
	}
	
	private openDocumentation( command: AnalyzeDoc ): void {
		showModuleDocumentation( command.module, command.regards.name ? command.regards.name : command.searchName )
	}
	
	private openResource( resource: string ): void {
		vscode.window.showTextDocument( vscode.Uri.file( resource ) )
	}
}
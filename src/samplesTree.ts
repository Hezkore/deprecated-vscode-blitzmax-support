import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMax } from './blitzmax'
import { readStats, exists } from './common'

interface Entry {
	uri: vscode.Uri
	type: vscode.FileType
	name: string
	isModules?: boolean
	allowSub?: boolean
	wantsModuleSamples?: boolean
	desc?: string
}

export class BmxSamplesTreeProvider implements vscode.TreeDataProvider<Entry> {
	
	private readonly acceptedFolderNames = [
		'samples','sample',
		'examples','example',
		'tests','test',
		'docs','doc'
	]
	
	private _onDidChangeTreeData: vscode.EventEmitter<Entry | null> = new vscode.EventEmitter<Entry | null>()
	readonly onDidChangeTreeData: vscode.Event<Entry | null> = this._onDidChangeTreeData.event
	
	readDirectory( uri: vscode.Uri, subFolders: boolean = true ): [string, fs.Stats][] | Thenable<[string, fs.Stats][]> {
		
		if (!fs.existsSync( uri.fsPath )) return Promise.resolve( [] )
		
		const children = fs.readdirSync( uri.fsPath )
		
		const result: [string, fs.Stats][] = []
		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			const stat = fs.statSync( path.join( uri.fsPath, child ) )
			
			if (stat.isFile()) {
				if (path.extname( child ).toLowerCase() != '.bmx') continue
			} else {
				if (!subFolders || child.startsWith( '.' )) continue
			}
			
			result.push( [child, stat] )
		}
		
		return Promise.resolve( result )
	}
	
	async getChildren(element?: Entry): Promise<Entry[]> {
		
		if (!element){
			
			let root:Entry[] = []
			
			root.push( {
				uri: vscode.Uri.parse( path.join( BlitzMax.path, 'samples' ) ),
				type: vscode.FileType.Directory,
				name: 'Samples'
			} )
			
			root.push( {
				uri: vscode.Uri.parse( BlitzMax.modPath ),
				type: vscode.FileType.Directory,
				name: 'Modules',
				isModules: true
			} )
			
			return root
		}
		
		if (element.wantsModuleSamples) return await this.getModuleSamples( element )
		if (element.isModules) return await this.getModules( element )
		
		let children = await this.readDirectory( element.uri, element.allowSub )		
		children.sort((a, b) => {
			if (a[1] === b[1]) {
				return a[0].localeCompare(b[0])
			}
			return a[1].isFile() ? -1 : 1
		})
		
		return children.map(( [name, type] ) => ({
			uri: vscode.Uri.file( path.join( element ? element.uri.fsPath : '', name ) ),
			type: type.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File ,
			name, element,
			desc: element.desc
		}))
	}
	
	async getModuleSamples(element: Entry): Promise<Entry[]> {
		
		let root:Entry[] = []
		const rootDir = path.join( BlitzMax.modPath, path.relative( BlitzMax.modPath, element.uri.fsPath ) )
		
		const modDir = await this.readDirectory( vscode.Uri.parse( rootDir ) )
		for(var i=0; i<modDir.length; i++){
			
			const sampleName = modDir[i][0]
			const stats = await readStats( path.join( rootDir, sampleName ) )
			
			if (stats.isDirectory() && this.acceptedFolderNames.includes( sampleName.toLowerCase() )){
				
				// Make sure there are actual source files!
				const bmxDir = await this.readDirectory( vscode.Uri.parse( path.join( rootDir, sampleName ) ) )
				let hasSource: boolean = false
				for(var i2=0; i2<bmxDir.length; i2++){
					const bmxName = bmxDir[i2][0]
					
					if (path.extname( bmxName ).toLowerCase() == '.bmx'){
						
						hasSource = true
						break
					}
				}
				
				if (hasSource){
					root.push( {
						uri: vscode.Uri.parse( path.join( rootDir, sampleName ) ),
						type: vscode.FileType.Directory,
						name: sampleName,
						allowSub: false
					} )
				}
			}
		}
		
		return root
	}
	
	async getModules(element: Entry): Promise<Entry[]> {
		
		let root:Entry[] = []
		
		// Get the main parent module folders
		const parentDir = await this.readDirectory( vscode.Uri.parse( BlitzMax.modPath ) )
		for(var i=0; i<parentDir.length; i++){
			
			const parentName = parentDir[i][0]
			
			// Skip unknown stuff
			if (!parentName.toLowerCase().endsWith( '.mod' )) continue
			
			// Scan parent subfolders
			const modDir = await this.readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName ) ) )
			for(var i2=0; i2<modDir.length; i2++){
				
				const modName = modDir[i2][0]
				
				// Skip unknown stuff
				if (!modName.toLowerCase().endsWith( '.mod' )) continue
				
				// Scan for a samples folder
				const sampleDir = await this.readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName, modName ) ) )
				for(var i3=0; i3<sampleDir.length; i3++){
					
					const sampleName = sampleDir[i3][0]
					
					if (this.acceptedFolderNames.includes( sampleName.toLowerCase() )){
						
						// Make sure there are actual source files!
						const bmxDir = await this.readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName, modName, sampleName ) ) )
						let hasSource: boolean = false
						for(var i4=0; i4<bmxDir.length; i4++){
							const bmxName = bmxDir[i4][0]
							
							if (path.extname( bmxName ).toLowerCase() == '.bmx'){
								
								hasSource = true
								break
							}
						}
						
						if (hasSource){
							root.push( {
								uri: vscode.Uri.parse( path.join( BlitzMax.modPath, parentName, modName ) ),
								type: vscode.FileType.Directory,
								name: modName,
								allowSub: false,
								wantsModuleSamples: true,
								desc: parentName
							} )
							
							break
						}
					}
				}
			}
		}
		
		return root.sort((a, b) => {
			return a.name.localeCompare(b.name)
		})
	}
	
	getTreeItem(element: Entry): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.name, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
		treeItem.description = element.desc
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'blitzmax.samplesExplorerOpenFile', title: "Open File", arguments: [element.uri], }
			treeItem.contextValue = 'file'
		}
		return treeItem
	}
	
	refresh() {
		this._onDidChangeTreeData.fire()
	}
}

export class BmxSamplesExplorer {
	
	constructor( context: vscode.ExtensionContext ) {
		const treeDataProvider = new BmxSamplesTreeProvider()
		vscode.window.registerTreeDataProvider( 'blitzmax-samples', treeDataProvider)
		vscode.commands.registerCommand( 'blitzmax.samplesExplorerOpenFile', (resource) => this.openResource(resource))
		vscode.commands.registerCommand( 'blitzmax.refreshSamples', () => treeDataProvider.refresh() )
	}
	
	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument( resource )
	}
}
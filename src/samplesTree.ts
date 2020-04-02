import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMax } from './blitzmax'
import { readStats } from './common'

const acceptedFolderNames = [
	'samples','sample',
	'examples','example',
	'tests','test',
	'docs','doc'
]

namespace _ {
	

	
	function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
		if (error) {
			reject(massageError(error))
		} else {
			resolve(result)
		}
	}
	
	function massageError(error: Error & { code?: string }): Error {
		if (error.code === 'ENOENT') {
			return vscode.FileSystemError.FileNotFound()
		}
		
		if (error.code === 'EISDIR') {
			return vscode.FileSystemError.FileIsADirectory()
		}
		
		if (error.code === 'EEXIST') {
			return vscode.FileSystemError.FileExists()
		}
		
		if (error.code === 'EPERM' || error.code === 'EACCESS') {
			return vscode.FileSystemError.NoPermissions()
		}
		
		return error
	}
	
	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error('Operation cancelled')
		}
	}

	export function normalizeNFC(items: string): string
	export function normalizeNFC(items: string[]): string[]
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== 'darwin') {
			return items
		}

		if (Array.isArray(items)) {
			return items.map(item => item.normalize('NFC'))
		}

		return items.normalize('NFC')
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)))
		})
	}

	export function stat(path: string): Promise<fs.Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat))
		})
	}

	export function readfile(path: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer))
		})
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.exists(path, exists => handleResult(resolve, reject, null, exists))
		})
	}
}

export class FileStat implements vscode.FileStat {
	
	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile()
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory()
	}

	get isSymbolicLink(): boolean | undefined {
		return this.fsStat.isSymbolicLink()
	}

	get size(): number {
		return this.fsStat.size
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime()
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime()
	}
}

interface Entry {
	uri: vscode.Uri
	type: vscode.FileType
	name: string
	isModules?: boolean
	allowSub?: boolean
	wantsModuleSamples?: boolean
	desc?: string
}

export class BmxSamplesTreeProvider implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider {
	
	private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>
	
	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
	}
	
	get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeFile.event
	}
	
	watch(uri: vscode.Uri, options: { recursive: boolean, excludes: string[] }): vscode.Disposable {
		const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
			const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()))
			
			// TODO support excludes (using minimatch library?)
			
			this._onDidChangeFile.fire([{
				type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
				uri: uri.with({ path: filepath })
			} as vscode.FileChangeEvent])
		})
		
		return { dispose: () => watcher.close() }
	}
	
	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return this._stat(uri.fsPath)
	}
	
	async _stat(path: string): Promise<vscode.FileStat> {
		return new FileStat(await _.stat(path))
	}
	
	readDirectory(uri: vscode.Uri, subFolders: boolean = true): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri, subFolders)
	}
	
	async _readDirectory(uri: vscode.Uri, subFolders: boolean = true): Promise<[string, vscode.FileType][]> {
		const children = await _.readdir(uri.fsPath)
		
		const result: [string, vscode.FileType][] = []
		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			const stat = await this._stat( path.join( uri.fsPath, child ) )
			
			if (stat.type == vscode.FileType.File) {
				if (path.extname( child ).toLowerCase() != '.bmx') continue
			} else {
				if (!subFolders) continue
				if (child.startsWith( '.' )) continue
			}
			
			result.push( [child, stat.type] )
		}
		
		return Promise.resolve( result )
	}
	
	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		return undefined
	}
	
	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		return _.readfile(uri.fsPath)
	}
	
	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void> {
		return this._writeFile(uri, content, options)
	}
	
	async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		return undefined
	}
	
	delete(uri: vscode.Uri, options: { recursive: boolean }): void | Thenable<void> {
		return undefined
	}
	
	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void | Thenable<void> {
		return undefined
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
			return a[1] === vscode.FileType.Directory ? -1 : 1
		})
		
		return children.map(( [name, type] ) => ({
			uri: vscode.Uri.file( path.join( element ? element.uri.fsPath : '', name ) ),
			type,
			name, element,
			desc: element.desc
		}))
	}
	
	async getModuleSamples(element: Entry): Promise<Entry[]> {
		
		let root:Entry[] = []
		const rootDir = path.join( BlitzMax.modPath, path.relative( BlitzMax.modPath, element.uri.fsPath ) )
		
		const modDir = await this._readDirectory( vscode.Uri.parse( rootDir ) )
		for(var i=0; i<modDir.length; i++){
			
			const sampleName = modDir[i][0]
			const stats = await readStats( path.join( rootDir, sampleName ) )
			
			if (stats.isDirectory() && acceptedFolderNames.includes( sampleName.toLowerCase() )){
				
				// Make sure there are actual source files!
				const bmxDir = await this._readDirectory( vscode.Uri.parse( path.join( rootDir, sampleName ) ) )
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
		const parentDir = await this._readDirectory( vscode.Uri.parse( BlitzMax.modPath ) )
		for(var i=0; i<parentDir.length; i++){
			
			const parentName = parentDir[i][0]
			
			// Skip unknown stuff
			if (!parentName.toLowerCase().endsWith( '.mod' )) continue
			
			// Scan parent subfolders
			const modDir = await this._readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName ) ) )
			for(var i2=0; i2<modDir.length; i2++){
				
				const modName = modDir[i2][0]
				
				// Skip unknown stuff
				if (!modName.toLowerCase().endsWith( '.mod' )) continue
				
				// Scan for a samples folder
				const sampleDir = await this._readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName, modName ) ) )
				for(var i3=0; i3<sampleDir.length; i3++){
					
					const sampleName = sampleDir[i3][0]
					//const stats = await readStats( path.join( BlitzMax.modPath, parentName, modName, sampleName ) )
					
					if (acceptedFolderNames.includes( sampleName.toLowerCase() )){
						
						// Make sure there are actual source files!
						const bmxDir = await this._readDirectory( vscode.Uri.parse( path.join( BlitzMax.modPath, parentName, modName, sampleName ) ) )
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
			treeItem.command = { command: 'bmxSamplesExplorer.openFile', title: "Open File", arguments: [element.uri], }
			treeItem.contextValue = 'file'
		}
		return treeItem
	}
}

export class BmxSamplesExplorer {
	
	constructor( context: vscode.ExtensionContext ) {
		const treeDataProvider = new BmxSamplesTreeProvider()
		vscode.window.registerTreeDataProvider( 'blitzmax-samples', treeDataProvider)
		vscode.commands.registerCommand('bmxSamplesExplorer.openFile', (resource) => this.openResource(resource))
	}
	
	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource)
	}
}
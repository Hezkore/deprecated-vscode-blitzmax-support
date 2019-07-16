'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { scanModules } from './bmxModules'
import { exec } from './common'

export class BlitzMaxHandler{
	
	private _ready: boolean = false
	private _path: string = ''
	private _problem: string | undefined
	private _legacy: boolean = false
	private _askedForPath: boolean = false
	
	get path(): string {
		
		return this._path
	}
	get binPath(): string{
		
		return path.join( this.path, 'bin' )
	}
	
	get modPath(): string{
		
		return path.join( this.path, 'mod' )
	}
	get ready(): boolean { return this._ready }
	get problem(): string | undefined { return this._problem }
	set problem( message:string | undefined ) {
		
		vscode.window.showErrorMessage( 'BlitzMax Error:' + message )
		console.log( 'BlitzMax Error:', message )
	}
	get legacy(): boolean { return this._legacy }
	
	async setup( context: vscode.ExtensionContext ){
		
		return new Promise<boolean>( async ( resolve, reject ) => {
			
			console.log( 'Setting up BlitzMax' )
			
			this._askedForPath = false
			this._problem = ''
			this._ready = false
			this._legacy = false
			this._path = ''
			
			await this.findPath()
			if (this.path.length <= 3){
				this.problem = 'No BlitzMax path set'
				return reject()
			}
			
			await this.checkLegacy()
			if (this.problem) return reject() 
			
			await scanModules( context )
			
			this._ready = true
			console.log( 'BlitzMax correctly setup!' )
			resolve()
		})
	}
	
	private async findPath(){
		
		let confPath: string | undefined = await vscode.workspace.getConfiguration( 'blitzmax' ).get( 'bmxPath' )
		if (!confPath){
			
			if (!this._askedForPath){
				
				this._askedForPath = true
				//this.AskForPath()
			}
			
			return
		}
		
		this._path = confPath
	}
	
	private async askForPath( msg:string = 'BlitzMax path not set in extension configuration' ){
		
		const opt = await vscode.window.showErrorMessage( msg, 'Set Path' )
		if (opt) {
			
			const folderOpt: vscode.OpenDialogOptions = {
				canSelectMany: false,
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: 'Select'
			}
			
			await vscode.window.showOpenDialog( folderOpt ).then( async fileUri => {
				
				if (fileUri && fileUri[0]) {
					
					await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'bmxPath', fileUri[0].fsPath, true )
					this.findPath()
					
					if (this.path){
							
						vscode.window.showInformationMessage( 'BlitzMax Path Set' )
					}
				}
			})
		}
	}
	
	private async checkLegacy(){
		
		try {
			let { stdout, stderr } = await exec( 'bcc', { env: { 'PATH': this.binPath } } )
			
			if ( stderr && stderr.length > 0 ) {
				
				this.problem = stderr
				//vscode.window.showErrorMessage( 'BCC error: ' + stderr )
			}
			
			if ( stdout ) {
				
				if ( stdout.toLowerCase().startsWith( 'blitzmax release version' ) ) {
					
					console.log( "is Legacy" )
					this._legacy = true
				} else {
					
					console.log( "is NG" )
					this._legacy = false
				}
			}
		} catch ( err ) {
			
			let msg:string = err
			if ( err.stderr ) { msg = err.stderr }
			if ( err.stdout ) { msg = err.stdout }
			
			this._problem = 'Unable to determin BlitzMax version'
			this.askForPath( 'Make sure your BlitzMax path is correct. (' + msg + ')' )
		}
	}
}
export let BlitzMax: BlitzMaxHandler = new BlitzMaxHandler()
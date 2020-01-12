import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMax } from './blitzmax'
import { readDir, exists, copyFolderSync } from './common'

export async function askToGenerateProject( context: vscode.ExtensionContext ) {
	
	return new Promise<boolean>( async ( resolve, _reject ) => {
		
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage( 'You need open a workspace/folder before generating a project' )
			return
		}
		
		let templatesPath: string = path.join( context.asAbsolutePath( '' ), 'projectTemplates' )
		let templatesRaw: string[] = await readDir( templatesPath )
		let defaultTasksFile: string = path.join( templatesPath, 'tasks.json' )
		let templates: string[] = []
		let pickedTemplate: string | undefined
		let pickedTemplateName: string
		let pickedTasksFile: string
		
		templatesRaw.forEach( template => {
			if (fs.lstatSync( path.join( templatesPath, template ) ).isDirectory())
				templates.push( template.replace( /_/g, ' ' ) )
		})
		
		await vscode.window.showQuickPick( templates, {
			canPickMany: false,
		}).then( async selection => {
			if (selection){
				pickedTemplateName = selection
				pickedTemplate = path.join( templatesPath, `${selection.replace( / /g, '_')}` )
				if (!await exists( pickedTemplate )){
					pickedTemplate = undefined
					return
				}
				
				pickedTasksFile = path.join( pickedTemplate, 'tasks.json' )
				if (!await exists( pickedTasksFile )){
					pickedTasksFile = defaultTasksFile
				}
			}else pickedTemplate = undefined
		})
		
		if (pickedTemplate){
			vscode.workspace.workspaceFolders.forEach( async workspace => {
				
				if (pickedTemplate) // It's stupid that I even need to specify this!
					await generateProject( workspace, pickedTemplate, pickedTasksFile, templatesPath ).then( entry => {
						if (entry) vscode.window.showTextDocument( entry )
					})
				
				generateReadMe( workspace, pickedTemplateName )
			})
		}
		
		return resolve()
	})
}

async function generateProject( workspace: vscode.WorkspaceFolder, template: string, tasks: string, basePath: string ): Promise<vscode.Uri | undefined> {
	
	return new Promise<vscode.Uri | undefined>( async ( resolve, reject ) => {
		
		// Overwrite existing workspace?
		if ( fs.readdirSync( workspace.uri.fsPath ).length > 0 ) {
			let wantsToOverwrite: boolean = false
			await vscode.window.showWarningMessage( `Overwrite workspace "${workspace.name}"?`, 'Overwrite', 'Abort').then( selection => {
				wantsToOverwrite = (selection == 'Overwrite')
			})
			if (!wantsToOverwrite) return
		}
		
		let templateFiles:string[] = copyFolderSync( template, workspace.uri.fsPath, '.bmx' )
		
		// Find entry point
		let entryPoint:string = ''
		templateFiles.forEach( file => {
			if (path.basename( file ).toLowerCase() == 'main.bmx')
				entryPoint = file
		})
		
		// Update variables
		templateFiles.forEach( file => {
			fs.writeFileSync( file, fs.readFileSync( file ).toString()
			.replace( '$WORKSPACE_NAME', workspace.name.split( '.' )[0] )
			.replace( '$CURRENT_YEAR', new Date().getFullYear().toString() ) )
		})
		
		// Create special entry point for module
		if (entryPoint.length > 4 && workspace.uri.fsPath.toLowerCase().endsWith( '.mod' )) {
			let newEntryPoint = path.join( path.dirname( entryPoint ), workspace.name.slice( 0, -4 ) + '.bmx' )
			fs.renameSync( entryPoint, newEntryPoint )
			entryPoint = newEntryPoint
		} else {
			// Copy over application stuff
			let dest = path.dirname( entryPoint )
			let destName = path.basename( entryPoint ).slice( 0, -4 )
			
			fs.copyFileSync( path.join( basePath, 'icon.ico' ), path.join( dest, destName + '.ico' ) )
			fs.copyFileSync( path.join( basePath, 'settings' ), path.join( dest, destName + '.settings' ) )
			fs.copyFileSync( path.join( basePath, 'gitignore' ), path.join( workspace.uri.fsPath, '.gitignore' ) )
			//fs.copyFileSync( path.join( basePath, 'manifest' ), path.join( dest, destName + '.exe.manifest' ) )
			//fs.copyFileSync( path.join( basePath, 'manifest' ), path.join( dest, destName + '.debug.exe.manifest' ) )
		}
		
		// Create tasks in .vscode folder
		let tasksOutPath = path.join( workspace.uri.fsPath, '.vscode' )
		if (!fs.existsSync( tasksOutPath ))
			fs.mkdirSync( tasksOutPath )
		
		tasksOutPath = path.join( tasksOutPath, 'tasks.json' )
		if (!fs.existsSync( tasksOutPath )) {
			fs.writeFileSync( tasksOutPath, fs.readFileSync( tasks ).toString()
			.replace( '${entryFile}', path.relative( workspace.uri.fsPath, entryPoint ).replace( '\\', '\\\\' ) ) )
		}
		
		return resolve( entryPoint.length > 4 ? vscode.Uri.file( entryPoint ) : undefined )
	})
}

function generateReadMe( workspace: vscode.WorkspaceFolder, type: string ) {
	
	const readMePath = path.join( workspace.uri.fsPath, 'README.md' )
	if (fs.existsSync( readMePath )) return
	
	let text:string = `# ${workspace.name.charAt(0).toUpperCase() + workspace.name.slice(1)}\nA [BlitzMax `
	if (BlitzMax.legacy)
		text += 'Legacy](https://nitrologic.itch.io/blitzmax/)'
	else
		text += 'NG](https://blitzmax.org/)'
	text += ` ${type}.`
	
	fs.writeFileSync( readMePath, text )
}
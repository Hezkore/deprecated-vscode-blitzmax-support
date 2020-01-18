'use strict'

import * as vscode from 'vscode'
import * as os from 'os'
import * as https from 'https'
import { BlitzMax } from './blitzmax'
import { log } from './common'

export async function checkBlitzMaxUpdates( isAuto: boolean = false ) {
	
	if (!isAuto){
		if (BlitzMax.legacy)
			vscode.window.showErrorMessage( 'The update system does not work with Legacy BlitzMax' )
		
		BlitzMax.warnNotReady()
	}
	
	if (BlitzMax.legacy || !BlitzMax.ready || BlitzMax.problem) return
	
	log()
	log( `Looking for BlitzMax ${BlitzMax.version} updates `, true, !isAuto )
	
	return new Promise<undefined>( async ( resolve, _reject ) => {
		
		log( '.', false )
		
		let downloadUrl: string = 'https://blitzmax.org/downloads/'
		let osVersion: string = getOsName()
		let version: string =  'v' + BlitzMax.releaseVersion + osVersion
		let json: RepoRelease[] = await getBlitzMaxReleases()
		
		//version = 'v0.0.0.0'+osVersion
		
		let localVersionNumber: number = versionToNumber( version )
		let releaseVersionNumber: number
		let bestVersionNumber: number
		let bestRelease: RepoRelease | undefined
		let newestRelease: number = 0
		
		log( '.', false )
		
		json.forEach( release => {
			
			releaseVersionNumber = versionToNumber( release.tag_name )
			
			// Is this for our platform?
			if (release.tag_name.endsWith( osVersion )) {
				
				// Newest release
				if (newestRelease < releaseVersionNumber)
					newestRelease = releaseVersionNumber
				
				// Check if this version is higher
				if (releaseVersionNumber > localVersionNumber) {
					if (!bestRelease || releaseVersionNumber > bestVersionNumber) {
						bestVersionNumber = releaseVersionNumber
						bestRelease = release
					}
				}
			}
		})
		
		if (bestRelease) {
			log( '.', false )
			
			log( 'New release available - ' + bestRelease.tag_name, true, true )
			log( 'Download at: ' + downloadUrl )
			
			let infoMessage: string = 'New BlitzMax release available! Visit download page?'
			
			if (isAuto) {
				vscode.window.showInformationMessage( infoMessage, 'Yes', 'No', 'Never' ).then( selection => {
					
					
					if (selection?.toLowerCase() == 'yes')
						vscode.env.openExternal(vscode.Uri.parse( downloadUrl ))
					else if (selection?.toLowerCase() == 'never')
						vscode.workspace.getConfiguration( 'blitzmax' ).update( 'checkForUpdates', false, true )
				})
			} else {
				vscode.window.showInformationMessage( infoMessage, 'Yes', 'No' ).then( selection => {
					
					if (selection?.toLowerCase() == 'yes')
						vscode.env.openExternal(vscode.Uri.parse( downloadUrl ))
				})
			}
			
		} else {
			log( '.', false )
			
			if (localVersionNumber == newestRelease)
				log( 'Your version matches the latest release' )
			
			if (localVersionNumber > newestRelease)
				log( 'Your version is newer than any current release' )
		}
	})
}

function versionToNumber( version: string ): number {
	
	let fixedVersion: string = ''
	let idSplit: string[] = version.slice( 1 ).split( '.' )

	for (let i = 0; i < idSplit.length - 1; i++) {
		if (!isNaN(Number(idSplit[i])))
			fixedVersion += Number(idSplit[i])
		else break
		
	}
	
	return Number( fixedVersion )
}

function getOsName(): string {
	switch (os.platform().toLowerCase()) {
		case 'darwin':
			return '.macos'
		
		case 'linux':
			return '.linux.x64'
			
		default:
			return '.' + os.platform().toLowerCase()
	}
}

async function getBlitzMaxReleases(): Promise<RepoRelease[]> {
	
	return new Promise<RepoRelease[]>( ( resolve, _reject ) => {
		
		var options = {
			host: 'api.github.com',
			path: '/repos/bmx-ng/bmx-ng/releases',
			method: 'GET',
			headers: {'user-agent': 'node.js'}
		}
		
		https.get( options, res => {
			let body = ''
			
			res.on( 'data', chunk => {
				body += chunk
			})
		
			res.on( 'end', () => {
				try {
					let json: RepoRelease[] = JSON.parse( body )
					return resolve( json )
				} catch (error) {
					console.error(error.message)
					return resolve()
				}
			})
		}).on("error", (error) => {
			console.error( error.message )
			return resolve()
		})
	})
}

interface RepoRelease{
	url: string,
	name: string,
	tag_name: string,
	assets: RepoReleaseAsset[]
}

interface RepoReleaseAsset{
	name: string,
	browser_download_url: string
}
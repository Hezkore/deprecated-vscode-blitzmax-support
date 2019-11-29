import * as vscode from 'vscode'

export async function quickAnalyze( code: string ): Promise<QuickAnalyzeResult> {
	
	return new Promise( async function( resolve ) {		
		
		let result: QuickAnalyzeResult = { strict: false, imports: [], lastImportLine: 0 }
		
		return resolve( result )
	})
}

export interface QuickAnalyzeResult{
	strict: boolean,
	imports: string[],
	lastImportLine: number
}
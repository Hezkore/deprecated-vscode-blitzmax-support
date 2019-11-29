import * as vscode from 'vscode'

export async function quickAnalyze( code: string ): Promise<QuickAnalyzeResult> {
	
	return new Promise( async function( resolve ) {		
		
		if (!code || code.length < 6)
			return {strict: false, imports: [], lastImportLine: 0}
		
		let result: QuickAnalyzeResult = { strict: false, imports: [], lastImportLine: 0 }
		let lines: string[] = code.trim().split( '\n' )
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trimRight()
			if (line.length < 6) continue
			const lowerLine: string = line.toLowerCase()
			
			if (lowerLine.startsWith( 'strict' ) ||
				lowerLine.startsWith( 'superstrict' ))
				result.strict = true
			else if (lowerLine.startsWith( 'import ' ))
			{
				result.imports.push( line.split( ' ' )[1] )
				result.lastImportLine = i
			}	
		}
		return resolve( result )
	})
}

export interface QuickAnalyzeResult{
	strict: boolean,
	imports: string[],
	lastImportLine: number
}
import * as vscode from 'vscode'

export async function quickAnalyze( code: string ): Promise<QuickAnalyzeResult> {
	
	return new Promise( async function( resolve ) {		
		
		if (!code || code.length < 6)
			return {strict: false, imports: [], lastImportLine: 0}
		
		let result: QuickAnalyzeResult = { strict: false, strictType: '', framework: '', imports: [], lastImportLine: 0 }
		let lines: string[] = code.trim().split( '\n' )
		let depth: number = 0
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trimRight()
			if (line.length < 6  || line.startsWith( "'" ) || line.startsWith( "rem " ) ) continue
			const lowerLine: string = line.toLowerCase()
			
			if (lowerLine.startsWith( 'rem ' ))
				depth++
			else if (lowerLine.startsWith( 'endrem' ) || lowerLine.startsWith( 'end rem' ))
				if (depth > 0) depth--
			else if (depth > 0)
				continue
			else if (lowerLine.startsWith( 'strict' ))
			{
				result.strict = true
				result.strictType = "Strict"
			}
			else if (lowerLine.startsWith( 'superstrict' ))
			{
				result.strict = true
				result.strictType = "SuperStrict"
			}
			else if (lowerLine.startsWith( 'import ' ))
			{
				result.imports.push( line.split( ' ' )[1] )
				result.lastImportLine = i
			}
			else if (lowerLine.startsWith( 'framework ' ))
			{
				result.framework = line.split( ' ' )[1]
				result.lastImportLine = i
			}
		}
		return resolve( result )
	})
}

export interface QuickAnalyzeResult{
	strict: boolean,
	strictType: string,
	framework: string,
	imports: string[],
	lastImportLine: number
}
import * as vscode from 'vscode'

export async function quickAnalyze( code: string, stopAtStrict: boolean = false ): Promise<QuickAnalyzeResult> {
	
	return new Promise( async function( resolve ) {		
		
		let result: QuickAnalyzeResult =
		{
			strict: false,
			strictType: '',
			framework: '',
			imports: [],
			firstImportLine: -1,
			lastImportLine: 0
		}
		if (!code || code.length < 6)
			return result
		
		let lines: string[] = code.trim().split( '\n' )
		let depth: number = 0
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trimRight()
			if (line.length < 3  || line.startsWith( "'" )) continue
			const lowerLine: string = line.toLowerCase()
			
			if (lowerLine == 'rem' || lowerLine.startsWith( 'rem ' ))
				depth++
			else if (lowerLine == 'endrem' || lowerLine == 'end rem' )
			{
				if (depth > 0)
					depth--
			}
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
				if (result.firstImportLine < 0)
					result.firstImportLine = i
			}
			else if (lowerLine.startsWith( 'framework ' ))
			{
				result.framework = line.split( ' ' )[1]
				result.lastImportLine = i
				if (result.firstImportLine < 0)
					result.firstImportLine = i
			}
			
			if (stopAtStrict && result.strict)
				return resolve( result )
		}
		return resolve( result )
	})
}

export interface QuickAnalyzeResult{
	strict: boolean,
	strictType: string,
	framework: string,
	imports: string[],
	firstImportLine: number
	lastImportLine: number
}
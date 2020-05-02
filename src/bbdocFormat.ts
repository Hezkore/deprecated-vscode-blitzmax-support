enum FormatType {
	None,
	Reference,
	Highlight,
	External
}

export interface FormatSettings {
	referenceText: string,
	highlightText: string,
	externalText: string
}

export function formatBBDocText( text: string, settings: FormatSettings ): string {
	
	let result: string = ''
	let state = FormatType.None
	let word: string = ''
	
	const ChrEnd = [' ', '.', ',', '\n', '\t']
	
	for (let chrNr = 0; chrNr < text.length; chrNr++) {
		const chr = text[chrNr]
		
		switch (state) {
			case FormatType.None:
				switch (chr) {
					case '@':
						state = FormatType.Highlight
						break
					
					case '#':
						state = FormatType.Reference
						break
				
					default:
						result += chr
						break
				}
				break
				
			default:
				if (ChrEnd.includes( chr ) || chrNr == text.length - 1) {
					result += formatWord( word, state, settings ) + ' '
					word = ''
					state = FormatType.None
				} else word += chr
				break
		}
	}
	
	return result
}

function formatWord( word: string, type: FormatType, settings: FormatSettings ): string {
	
	if (!word) return word
	
	switch (type) {
		case FormatType.Reference: return settings.referenceText.replace( /{{word}}/g, word )
		case FormatType.Highlight: return settings.highlightText.replace( /{{word}}/g, word )
		case FormatType.External: return settings.externalText.replace( /{{word}}/g, word )
	
		default: break
	}
	
	console.log( word )
	
	return word
}
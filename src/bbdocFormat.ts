export enum FormatType {
	None,
	Reference,
	Highlight,
	Html,
	Table
}

export interface FormatResult {
	Type: FormatType
	Words: string[]
	HtmlTag?: string
	HtmlData?: string
	Table?: FormatTableResult
}

export interface FormatTableResult {
	items: string[][]
	width: number
	height: number
}

export function formatBBDocText( text: string, formater: Function, clearNewLines: boolean = false ): string {
	
	let result: string = ''
	let state = FormatType.None
	let word: string = ''
	let htmlTag: string = ''
	let htmlTagEnd: string | undefined
	let htmlData: string = ''
	let htmlDataStart: string | undefined
	let htmlDataEnd: string | undefined
	let lastHtmlTag: string = ''
	
	const ChrEnd = [' ', '.', ',', '\n', '\t', ')', ']']
	
	for (let chrNr = 0; chrNr < text.length; chrNr++) {
		const chr = text[chrNr]
		if (clearNewLines && (chr == '\n' || chr == '\r')) continue
		
		switch (state) {
			case FormatType.None:
				switch (chr) {
					case '[':
						if (!htmlTagEnd) htmlTagEnd = ']'
					case '<':
						if (!htmlTagEnd) htmlTagEnd = '>'
						state = FormatType.Html
						htmlTag = ''
						htmlData = ''
						continue
					
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
				
			case FormatType.Html:
				if (chr == htmlTagEnd) {
					
					switch (htmlTagEnd) {
						case ']':
							htmlDataStart = '('
							htmlDataEnd = ')'
							chrNr ++
							break
					}
					
					if (!htmlDataEnd || chrNr >= text.length - 1 || text[chrNr] != htmlDataStart) {
						
						if (htmlTag) {
							let formatResult: FormatResult
							
							switch (htmlTagEnd) {
								// [] can also be a markdown table
								// Send as table if no data is attached
								case ']':
									state = FormatType.Table
									formatResult = {
										Type: state,
										Words: [htmlTag],
										Table: parseTable( htmlTag, formater, clearNewLines )								
									}
									break
							
								default:
									formatResult = {
										Type: state,
										Words: [htmlTag],
										HtmlTag: htmlTag
									}
									break
							}
							
							switch (htmlTag.toLowerCase()) {
								case '/br':
								case 'br/':
								case 'br':
									//if (lastHtmlTag.toLowerCase() != htmlTag.toLowerCase())
									//	result += '\n'
									break
							
								default:
									result += formater( formatResult )
									break
							}
						}
						state = FormatType.None
						htmlDataStart = undefined
						htmlDataEnd = undefined
						lastHtmlTag = htmlTag
						htmlTag = ''
						htmlTagEnd = undefined
					}
					htmlTagEnd = undefined
				} else if(htmlDataEnd) {
					
					if (chr != htmlDataEnd) {
						htmlData += chr
					} else {
						htmlDataEnd = undefined
						
						if (htmlTag) {
							let formatResult = {
								Type: state,
								Words: [htmlTag, htmlData],
								HtmlTag: htmlTag,
								HtmlData: htmlData
							}
							result += formater( formatResult )
						}
						state = FormatType.None
					}
					
				} else htmlTag += chr
				break
				
			default:
				word += chr
				
				if (ChrEnd.includes( chr ) || chrNr >= text.length - 1) {
					if (ChrEnd.includes( chr )) word = word.slice( 0, -1 )
					if (word) {
						let formatResult = {
							Type: state,
							Words: [word]
						}
						result += formater( formatResult )
						word = ''
					}
					if (ChrEnd.includes( chr )) result += chr
					state = FormatType.None
				}
				break
		}
	}
	
	return result
}

function parseTable( text: string, formater: Function, clearNewLines: boolean = false ): FormatTableResult {
	
	let part: string = ''
	let table: FormatTableResult = { items: [], width: 0, height: 0 }
	let itemNr: number = 0
	let lineNr: number = 0
	
	//console.log( 'Aigh parse this table: ' + text )
	for (let chrNr = 0; chrNr < text.length; chrNr++) {
		const chr = text[chrNr]
		
		if (chrNr == text.length - 1 || chr == '|') {
			if (!table.items[itemNr]) table.items[itemNr] = []
			table.items[itemNr][lineNr] = formatBBDocText( part.trim(), formater, clearNewLines )
			part = ''
			itemNr ++
			if (itemNr > table.width) table.width = itemNr
			continue
		}
		
		switch (chr) {
			case '\n':
			case '\r':
				if (!table.items[itemNr]) table.items[itemNr] = []
				table.items[itemNr][lineNr] = formatBBDocText( part.trim(), formater, clearNewLines )
				part = ''
				lineNr ++
				if (lineNr > table.height) table.height = lineNr
				itemNr = 0
				continue
			
			default:
				if (part.length <= 0 && (chr == ' ' || chr == '*')) continue
				part += chr
				continue
		}
	}
	
	//console.log( table )
	
	return table
}
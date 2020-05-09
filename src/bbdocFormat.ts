export enum FormatType {
	None,
	Highlight,
	Html,
	Table,
	Reference,
	Header1,
	Header2,
	Header3,
	Header4,
	Header5,
	Header6,
	Italic,
	Code
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
	let codeMultiLine: boolean = false
	let codeMultiLineLanguage: string = ''
	let codeMultiLineLanguageDone: boolean = false
	
	const ChrEnd = [' ', '.', ',', '\n', '\t', ')', ']']
	
	for (let chrNr = 0; chrNr < text.length; chrNr++) {
		const chr = text[chrNr]
		if (clearNewLines && (chr == '\n' || chr == '\r')) continue
		
		const nextChr: string[] = [
			chrNr + 1 < text.length ? text[chrNr + 1] : '',
			chrNr + 2 < text.length ? text[chrNr + 2] : '',
			chrNr + 3 < text.length ? text[chrNr + 3] : '',
			chrNr + 4 < text.length ? text[chrNr + 4] : '',
			chrNr + 5 < text.length ? text[chrNr + 5] : ''
		]
		
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
					
					case '*':
						state = FormatType.Italic
						break
					
					case '@':
						state = FormatType.Highlight
						break
					
					case '`':
						state = FormatType.Code
						codeMultiLine = false
						if (nextChr[0] == chr && nextChr[1] == chr) {
							chrNr += 2
							codeMultiLineLanguage = ''
							codeMultiLineLanguageDone = false
							codeMultiLine = true
						}
						break
					
					case '#':
						
						// First we check if this is size 1 header
						if (nextChr[0] == ' ') {
							chrNr += 1
							state = FormatType.Header1
							break
						}
						
						// Okay not a header 1, but perhaps a bigger header?
						let headerSize = 0
						if (nextChr[0] == chr) {
							headerSize = 2
						}
						
						// If this is a bigger header; figure out the size
						if (headerSize > 0) {
							for (let i = 1; i < nextChr.length; i++) {
								const c = nextChr[i]
								if (c == chr)
									headerSize++
								else
									break
							}
						}
						
						state = FormatType.Reference + headerSize
						if (headerSize) chrNr += headerSize
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
									if (nextChr[0] != '\n') result += '\n'
									break
							
								default:
									result += formater( formatResult )
									break
							}
						}
						state = FormatType.None
						htmlDataStart = undefined
						htmlDataEnd = undefined
						//lastHtmlTag = htmlTag
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
				
			case FormatType.Header1:
			case FormatType.Header2:
			case FormatType.Header3:
			case FormatType.Header4:
			case FormatType.Header5:
			case FormatType.Header6:
				if (chr == '\n' || chr == '\r' || chrNr >= text.length - 1) {
					if (chrNr >= text.length - 1) word += chr
					let formatResult = {
						Type: state,
						Words: [word]
					}
					result += formater( formatResult )
					word = ''
					state = FormatType.None
				} else word += chr
				break
				
			case FormatType.Italic:
				if (chr == '*' || chrNr >= text.length - 1) {
					if (chrNr >= text.length - 1) word += chr
					let formatResult = {
						Type: state,
						Words: [word]
					}
					result += formater( formatResult )
					word = ''
					state = FormatType.None
				} else word += chr
				break
			
			case FormatType.Code:
				if (codeMultiLine) {
					if (chrNr >= text.length - 1 ||
					(chr == '`' && nextChr[0] == '`' && nextChr[1] == '`')) {
						let formatResult = {
							Type: state,
							Words: [word]
						}
						result += formater( formatResult )
						word = ''
						state = FormatType.None
						chrNr += 2
					} else {
						if (codeMultiLineLanguageDone) {
							word += chr
						} else {
							if (chr == '\n' || chr == '\r') {
								codeMultiLineLanguageDone = true
							} else codeMultiLineLanguage += chr
						}
					}
				} else {
					if (chr == '`' || chrNr >= text.length - 1) {
						let formatResult = {
							Type: state,
							Words: [word]
						}
						result += formater( formatResult )
						word = ''
						state = FormatType.None
					} else word += chr
				}
				break
			
			default:
				word += chr
				if (chr == '.' && (nextChr[0].match(/[a-z]/i))) {
					break
				}
				
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
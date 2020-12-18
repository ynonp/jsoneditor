/**
 * Normalize a parse error message like
 *     "Unexpected token i in JSON at position 4"
 * or
 *     "JSON.parse: expected property name or '}' at line 2 column 3 of the JSON data"
 * and return the line and column numbers in an object
 *
 * Note that the returned line and column number in the object are zero-based,
 * and in the message are one based (human readable)
 *
 * @param {string} jsonText
 * @param {string} parseErrorMessage
 * @return {{
 *   position: number | null,
 *   line: number | null,
 *   column: number | null,
 *   message: message
 * }}
 */
export function normalizeJsonParseError (jsonText, parseErrorMessage) {
  const positionMatch = POSITION_REGEX.exec(parseErrorMessage)

  if (positionMatch) {
    // a message from Chrome, like "Unexpected token i in JSON at line 2 column 3"
    const position = parseInt(positionMatch[1], 10)

    const line = countCharacterOccurrences(jsonText, '\n', 0, position)
    const lastIndex = jsonText.lastIndexOf('\n', position)
    const column = position - lastIndex - 1

    return {
      position,
      line,
      column,
      message: parseErrorMessage.replace(POSITION_REGEX, () => {
        return `line ${line + 1} column ${column + 1}`
      })
    }
  } else {
    // a message from Firefox, like "JSON.parse: expected property name or '}' at line 2 column 3 of the JSON data"
    const lineMatch = LINE_REGEX.exec(parseErrorMessage)
    const lineOneBased = lineMatch
      ? parseInt(lineMatch[1], 10)
      : null
    const line = lineOneBased !== null
      ? (lineOneBased - 1)
      : null

    const columnMatch = COLUMN_REGEX.exec(parseErrorMessage)
    const columnOneBased = columnMatch
      ? parseInt(columnMatch[1], 10)
      : null
    const column = columnOneBased !== null
      ? (columnOneBased - 1)
      : null

    const position = (line !== null && column !== null)
      ? calculatePosition(jsonText, line, column)
      : null

    // line and column are one based in the message
    return {
      position,
      line,
      column,
      message: parseErrorMessage.replace(/^JSON.parse: /, '')
    }
  }
}

/**
 * Calculate the position in the text based on a line and column number
 * @param {string} text
 * @param {number} line     Zero-based line number
 * @param {number} column   Zero-based column number
 * @returns {number | null}
 */
export function calculatePosition(text, line, column) {
  let index = text.indexOf('\n')
  let i = 1

  while (i < line && index !== -1) {
    index = text.indexOf('\n', index + 1)
    i++
  }

  return (index !== -1)
    ? (index + column + 1) // +1 for the return character itself
    : null
}

export function countCharacterOccurrences (text, character, start = 0, end = text.length) {
  let count = 0

  for (let i = start; i < end; i++) {
    if (text.charAt(i) === character) {
      count++
    }
  }

  return count
}

const POSITION_REGEX = /position (\d+)/
const LINE_REGEX = /line (\d+)/
const COLUMN_REGEX = /column (\d+)/

/** JSDoc type definitions */

/**
 * @typedef {{} | [] | string | number | boolean | null} JSON
 */

/**
 * @typedef {{
 *   name: string?,
 *   mode: 'code' | 'form' | 'text' | 'tree' | 'view'?,
 *   modes: string[]?,
 *   history: boolean?,
 *   indentation: number | string?,
 *   onChange: function (patch: JSONPatchDocument, revert: JSONPatchDocument)?,
 *   onChangeText: function ()?,
 *   onChangeMode: function (mode: string, prevMode: string)?,
 *   onError:  function (err: Error)?,
 *   isPropertyEditable: function (Path)?
 *   isValueEditable: function (Path)?,
 *   escapeUnicode: boolean?,
 *   expand: function(path: Path) : boolean?,
 *   ajv: Object?,
 *   ace: Object?
 * }} Options
 */

/**
 * @typedef {Array<string | number | Symbol>} Path
 */

/**
 * @typedef {{
 *   op: 'add' | 'remove' | 'replace' | 'copy' | 'move' | 'test',
 *   path: string,
 *   from?: string,
 *   value?: *
 * }} JSONPatchOperation
 */

/**
 * @typedef {JSONPatchOperation[]} JSONPatchDocument
 */

/**
 * @typedef {{
 *   patch: JSONPatchDocument,
 *   revert: JSONPatchDocument,
 *   error: Error | null
 * }} JSONPatchResult
 */

/**
 * @typedef {{
 *   paths: Path[],
 *   anchorPath: Path,
 *   focusPath: Path,
 *   pathsMap: Object<string, boolean>
 * }} MultiSelection
 */

/**
 * @typedef {{beforePath: Path, anchorPath: Path, focusPath: Path}} BeforeSelection
 */

/**
 * @typedef {{appendPath: Path, anchorPath: Path, focusPath: Path}} AppendSelection
 */

/**
 * @typedef {{keyPath: Path, anchorPath: Path, focusPath: Path, edit?: boolean}} KeySelection
 */

/**
 * @typedef {{valuePath: Path, anchorPath: Path, focusPath: Path, edit?: boolean}} ValueSelection
 */

/**
 * @typedef {MultiSelection | BeforeSelection | AppendSelection | KeySelection | ValueSelection} Selection
 */

/**
 * @typedef {{beforePath: Path}} BeforeSelectionSchema
 */

/**
 * @typedef {{appendPath: Path}} AppendSelectionSchema
 */

/**
 * @typedef {{keyPath: Path, edit?: boolean, next?: boolean}} KeySelectionSchema
 */

/**
 * @typedef {{valuePath: Path, edit?: boolean, next?: boolean}} ValueSelectionSchema
 */

/**
 * @typedef {{anchorPath: Path, focusPath: Path}} MultiSelectionSchema
 */

/**
 * @typedef {MultiSelectionSchema  | BeforeSelectionSchema | AppendSelectionSchema | KeySelectionSchema | ValueSelectionSchema} SelectionSchema
 */

/**
 * @typedef {Object} MenuDropdownItem
 * @property {string} text
 * @property {function} onClick
 * @property {string} [title=undefined]
 * @property {boolean} [default=false]
 */ 

 /**
  * @typedef {{path: Path, message: string, isChildError?: boolean}} ValidationError
  */
  
/**
 * @typedef {{start: number, end: number}} Section
 *  Start included, end excluded
 */

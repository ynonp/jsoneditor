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
 * @typedef {<string | number>[]} Path
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
 * @typedef {{paths: Path[], pathsMap: Object<string, boolean>}} | {beforePath: Path} | {appendPath: Path}} Selection
 */

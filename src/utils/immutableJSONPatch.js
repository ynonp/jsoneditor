import { isEqual, initial, last } from 'lodash-es'
import { setIn, getIn, deleteIn, insertAt, existsIn } from './immutabilityHelpers.js'
import { parseJSONPointer, compileJSONPointer } from './jsonPointer.js'

const PATCH_OPS = {
  add,
  remove,
  replace,
  copy,
  move
}

const REVERT_OPS = {
  add: revertAdd,
  remove: revertRemove,
  replace: revertReplace,
  copy: revertCopy,
  move: revertMove
}

/**
 * Apply a patch to a JSON object
 * The original JSON object will not be changed,
 * instead, the patch is applied in an immutable way
 * @param {JSON} json
 * @param {JSONPatchDocument} operations    Array with JSON patch actions
 * @return {{json: JSON, revert: JSONPatchDocument, error: string | null}}
 */
export function immutableJSONPatch (json, operations) {
  // TODO: create a version of immutableJSONPatch which doesn't calculate revert operations (faster, and tree-shakable)
  let updatedJson = json
  let revertOperations = []

  for (let i = 0; i < operations.length; i++) {
    const error = validateJSONPatchOperation(operations[i])
    if (error) {
      return { json, revert: [], error }
    }

    const operation = preprocessJSONPatchOperation(updatedJson, operations[i])

    const patch = PATCH_OPS[operation.op]
    const revert = REVERT_OPS[operation.op]
    if (patch && revert) {
      revertOperations = revert(updatedJson, operation).concat(revertOperations)
      updatedJson = patch(updatedJson, operation)
    } else if (operation.op === 'test') {
      const error = test(updatedJson, operation)
      if (error) {
        return { json, revert: [], error }
      }
    } else {
      const error = 'Unknown JSONPatch operation ' + JSON.stringify(operation.op)
      return { json, revert: [], error }
    }
  }

  return {
    json: updatedJson,
    revert: revertOperations,
    error: null
  }
}

/**
 * Replace an existing item
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {JSON}
 */
export function replace (json, { path, value }) {
  return setIn(json, path, value)
}

/**
 * Remove an item or property
 * @param {JSON} json
 * @param {{ path: Path }} operation
 * @return {JSON}
 */
export function remove (json, { path }) {
  return deleteIn(json, path)
}

/**
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {JSON}
 */
export function add (json, { path, value }) {
  if (isArrayItem(json, path)) {
    return insertAt(json, path, value)
  } else {
    return setIn(json, path, value)
  }
}

/**
 * Copy a value
 * @param {JSON} json
 * @param {{ path: Path, from: Path }} operation
 * @return {JSON}
 */
export function copy (json, { path, from }) {
  const value = getIn(json, from)

  if (isArrayItem(json, path)) {
    return insertAt(json, path, value)
  } else {
    const value = getIn(json, from)

    return setIn(json, path, value)
  }
}

/**
 * Move a value
 * @param {JSON} json
 * @param {{ path: Path, from: Path }} operation
 * @return {JSON}
 */
export function move (json, { path, from }) {
  const value = getIn(json, from)
  const removedJson = deleteIn(json, from)

  return isArrayItem(removedJson, path)
    ? insertAt(removedJson, path, value)
    : setIn(removedJson, path, value)
}

/**
 * Test whether the data contains the provided value at the specified path.
 * Returns an error message when the tests, returns null otherwise
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {null | string}
 */
export function test (json, { path, value }) {
  if (value === undefined) {
    return 'Test failed, no value provided'
  }

  if (!existsIn(json, path)) {
    return 'Test failed, path not found'
  }

  const actualValue = getIn(json, path)
  if (!isEqual(actualValue, value)) {
    return 'Test failed, value differs'
  }
}

/**
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {JSONPatchOperation[]}
 */
function revertReplace (json, { path, value }) {
  return [{
    op: 'replace',
    path: compileJSONPointer(path),
    value: getIn(json, path)
  }]
}

/**
 * @param {JSON} json
 * @param {{ path: Path }} operation
 * @return {JSONPatchOperation[]}
 */
function revertRemove (json, { path }) {
  return [{
    op: 'add',
    path: compileJSONPointer(path),
    value: getIn(json, path)
  }]
}

/**
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {JSONPatchOperation[]}
 */
function revertAdd (json, { path, value }) {
  if (isArrayItem(json, path) || !existsIn(json, path)) {
    return [{
      op: 'remove',
      path: compileJSONPointer(path)
    }]
  } else {
    return revertReplace(json, { path, value })
  }
}

/**
 * @param {JSON} json
 * @param {{ path: Path, value: JSON }} operation
 * @return {JSONPatchOperation[]}
 */
function revertCopy (json, { path, value }) {
  return revertAdd(json, { path, value })
}

/**
 * @param {JSON} json
 * @param {{ path: Path, from: Path }} operation
 * @return {JSONPatchOperation[]}
 */
function revertMove (json, { path, from }) {
  let revert = [
    {
      op: 'move',
      from: compileJSONPointer(path),
      path: compileJSONPointer(from)
    }
  ]

  if (!isArrayItem(json, path) && existsIn(json, path)) {
    // the move replaces an existing value in an object
    revert = revert.concat(revertRemove(json, { path }))
  }

  return revert
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @returns {boolean}
 */
function isArrayItem(json, path) {
  const parent = getIn(json, initial(path))

  return Array.isArray(parent)
}

/**
 * Resolve the path index of an array, resolves indexes '-'
 * @param {JSON} json
 * @param {Path} path
 * @returns {Path} Returns the resolved path
 */
export function resolvePathIndex (json, path) {
  if (last(path) !== '-') {
    return path
  }

  const parentPath = initial(path)
  const parent = getIn(json, parentPath)

  return parentPath.concat(parent.length)
}

/**
 * Validate a JSONPatch operation
 * @param {JSONPatchOperation} operation
 * @returns {null | string}
 */
export function validateJSONPatchOperation (operation) {
  // TODO: write unit tests
  const ops = ['add', 'remove', 'replace', 'copy', 'move', 'test']

  if (!ops.includes(operation.op)) {
    return 'Unknown JSONPatch op ' + JSON.stringify(operation.op)
  }

  if (typeof operation.path !== 'string') {
    return 'Required property "path" missing or not a string in operation ' + JSON.stringify(operation)
  }

  if (operation.op === 'copy' || operation.op === 'move') {
    if (typeof operation.from !== 'string') {
      return 'Required property "from" missing or not a string in operation ' + JSON.stringify(operation)
    }
  }

  return null
}

// TODO: write unit tests
export function preprocessJSONPatchOperation (json, operation) {
  return {
    op: operation.op,
    path: resolvePathIndex(json, parseJSONPointer(operation.path)),
    from: operation.from !== undefined
      ? parseJSONPointer(operation.from)
      : null,
    value: operation.value
  }
}

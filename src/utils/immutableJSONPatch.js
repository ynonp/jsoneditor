import { isEqual, initial, last } from 'lodash-es'
import { setIn, getIn, deleteIn, insertAt, existsIn } from './immutabilityHelpers.js'
import { parseJSONPointer, compileJSONPointer } from './jsonPointer.js'

const DEFAULT_OPTIONS = {
  fromJSON: (value, previousValue) => value,
  clone: (value, previousValue) => value,
  toJSON: (value) => value
}

/**
 * Apply a patch to a JSON object
 * The original JSON object will not be changed,
 * instead, the patch is applied in an immutable way
 * @param {JSON} json
 * @param {JSONPatchDocument} operations    Array with JSON patch actions
 * @param {JSONPatchOptions} [options]
 * @return {{json: JSON, revert: JSONPatchDocument, error: string | null}}
 */
export function immutableJSONPatch (json, operations, options = DEFAULT_OPTIONS) {
  let updatedJson = json
  let reverts = []

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]

    const error = validateJSONPatchOperation(operation)
    if (error) {
      return { json, revert: [], error }
    }

    const path = operation.path !== undefined
      ? resolvePathIndex(updatedJson, parseJSONPointer(operation.path))
      : null

    const from = operation.from !== undefined
      ? parseJSONPointer(operation.from)
      : null

    switch (operation.op) {
      case 'add': {
        reverts.unshift(revertAdd(updatedJson, path, operation.value, options))
        updatedJson = add(updatedJson, path, operation.value, options)
        break
      }

      case 'remove': {
        reverts.unshift(revertRemove(updatedJson, path, options))
        updatedJson = remove(updatedJson, path, options)
        break
      }

      case 'replace': {
        reverts.unshift(revertReplace(updatedJson, path, operation.value, options))
        updatedJson = replace(updatedJson, path, operation.value, options)
        break
      }

      case 'copy': {
        reverts.unshift(revertCopy(updatedJson, path, from, options))
        updatedJson = copy(updatedJson, path, from, options)
        break
      }

      case 'move': {
        reverts = revertMove(updatedJson, path, from, options).concat(reverts)
        updatedJson = move(updatedJson, path, from, options)
        break
      }

      case 'test': {
        // when a test fails, cancel the whole patch and return the error
        const error = test(updatedJson, path, operation.value, options)
        if (error) {
          return { json, revert: [], error }
        }

        break
      }

      default: {
        // unknown patch operation. Cancel the whole patch and return an error
        return {
          json,
          revert: [],
          error: 'Unknown JSONPatch op ' + JSON.stringify(operation.op)
        }
      }
    }
  }

  return {
    json: updatedJson,
    revert: reverts,
    error: null
  }
}

/**
 * Replace an existing item
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {JSON}
 */
export function replace (json, path, value, options) {
  const oldValue = getIn(json, path)
  const newValue = options.fromJSON(value, oldValue)

  return setIn(json, path, newValue)
}

/**
 * Remove an item or property
 * @param {JSON} json
 * @param {Path} path
 * @param {JSONPatchOptions} [options]
 * @return {JSON}
 */
export function remove (json, path, options) {
  return deleteIn(json, path)
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {JSON}
 * @return {JSON}
 */
export function add (json, path, value, options) {
  if (isArrayItem(json, path)) {
    const newValue = options.fromJSON(value, undefined)

    return insertAt(json, path, newValue)
  } else {
    const oldValue = getIn(json, path)
    const newValue = options.fromJSON(value, oldValue)

    return setIn(json, path, newValue)
  }
}

/**
 * Copy a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @param {JSONPatchOptions} [options]
 * @return {JSON}
 */
export function copy (json, path, from, options) {
  const value = getIn(json, from)

  if (isArrayItem(json, path)) {
    const newValue = options.clone(value, undefined)

    return insertAt(json, path, newValue)
  } else {
    const oldValue = getIn(json, path)
    const value = getIn(json, from)
    const newValue = options.clone(value, oldValue)

    return setIn(json, path, newValue)
  }
}

/**
 * Move a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @param {JSONPatchOptions} [options]
 * @return {JSON}
 */
export function move (json, path, from, options) {
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
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {null | string}
 */
export function test (json, path, value, options) {
  if (value === undefined) {
    return 'Test failed, no value provided'
  }

  if (!existsIn(json, path)) {
    return 'Test failed, path not found'
  }

  const actualValue = options.toJSON(getIn(json, path))
  if (!isEqual(actualValue, value)) {
    return 'Test failed, value differs'
  }
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {JSONPatchOperation}
 */
function revertReplace (json, path, value, options) {
  const oldValue = getIn(json, path)

  return {
    op: 'replace',
    path: compileJSONPointer(path),
    value: options.toJSON(oldValue)
  }
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSONPatchOptions} [options]
 * @return {JSONPatchOperation}
 */
function revertRemove (json, path, options) {
  const oldValue = getIn(json, path)

  return {
    op: 'add',
    path: compileJSONPointer(path),
    value: options.toJSON(oldValue)
  }
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {JSONPatchOperation}
 */
function revertAdd (json, path, value, options) {
  if (isArrayItem(json, path) || !existsIn(json, path)) {
    return {
      op: 'remove',
      path: compileJSONPointer(path)
    }
  } else {
    return revertReplace(json, path, value, options)
  }
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @param {JSONPatchOptions} [options]
 * @return {JSONPatchOperation}
 */
function revertCopy (json, path, value, options) {
  return revertAdd(json, path, value, options)
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @param {JSONPatchOptions} [options]
 * @return {JSONPatchOperation[]}
 */
function revertMove (json, path, from, options) {
  const revert = [
    {
      op: 'move',
      from: compileJSONPointer(path),
      path: compileJSONPointer(from)
    }
  ]

  if (!isArrayItem(json, path) && existsIn(json, path)) {
    // the move replaces an existing value in an object
    revert.push(revertRemove(json, path, options))
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

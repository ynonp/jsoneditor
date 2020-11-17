import { initial, isEqual, last } from 'lodash-es'
import {
  deleteIn,
  existsIn,
  getIn,
  insertAt,
  setIn
} from '../utils/immutabilityHelpers.js'
import { parseJSONPointer } from '../utils/jsonPointer.js'

/**
 * Apply a patch to a JSON object
 * The original JSON object will not be changed,
 * instead, the patch is applied in an immutable way
 * @param {JSON} json
 * @param {JSONPatchDocument} operations    Array with JSON patch operations
 * @return {JSON}
 */
export function documentStatePatch (json, operations) {
  let updatedJson = json

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const path = operation.path !== undefined ? parseJSONPointer(operation.path) : null
    const from = operation.from !== undefined ? parseJSONPointer(operation.from) : null

    switch (operation.op) {
      case 'add': {
        updatedJson = add(updatedJson, path, operation.value)
        break
      }

      case 'remove': {
        updatedJson = remove(updatedJson, path)
        break
      }

      case 'replace': {
        updatedJson = replace(updatedJson, path, operation.value)
        break
      }

      case 'copy': {
        if (!operation.from) {
          throw new Error('Property "from" expected in copy operation ' + JSON.stringify(operation))
        }
        updatedJson = copy(updatedJson, path, from)
        break
      }

      case 'move': {
        if (!operation.from) {
          throw new Error('Property "from" expected in move operation ' + JSON.stringify(operation))
        }
        updatedJson = move(updatedJson, path, from)
        break
      }

      case 'test': {
        // when a test fails, cancel the whole patch and return the error
        test(updatedJson, path, operation.value)
        break
      }

      default: {
        // unknown patch operation. Cancel the whole patch and return an error
        throw new Error('Unknown JSONPatch op ' + JSON.stringify(operation.op))
      }
    }
  }

  return updatedJson
}

/**
 * Replace an existing item
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @return {JSON}
 */
export function replace (json, path, value) {
  return setIn(json, path, value)
}

/**
 * Remove an item or property
 * @param {JSON} json
 * @param {Path} path
 * @return {JSON}
 */
export function remove (json, path) {
  return deleteIn(json, path)
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @return {JSON}
 * @private
 */
export function add (json, path, value) {
  const resolvedPath = resolvePathIndex(json, path)

  return isArrayItem(json, resolvedPath)
    ? insertAt(json, resolvedPath, value)
    : setIn(json, resolvedPath, value)
}

/**
 * Copy a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @return {JSON}
 * @private
 */
export function copy (json, path, from) {
  const value = getIn(json, from)
  const resolvedPath = resolvePathIndex(json, path)

  return isArrayItem(json, resolvedPath)
    ? insertAt(json, resolvedPath, value)
    : setIn(json, resolvedPath, value)
}

/**
 * Move a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @return {JSON}
 * @private
 */
export function move (json, path, from) {
  const value = getIn(json, from)
  const removedJson = deleteIn(json, from)
  const resolvedPath = resolvePathIndex(removedJson, path)

  return isArrayItem(removedJson, resolvedPath)
    ? insertAt(removedJson, resolvedPath, value)
    : setIn(removedJson, resolvedPath, value)
}

/**
 * Test whether the data contains the provided value at the specified path.
 * Throws an error when the test fails.
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 */
export function test (json, path, value) {
  if (value === undefined) {
    throw new Error('Test failed, no value provided')
  }

  if (!existsIn(json, path)) {
    throw new Error('Test failed, path not found')
  }

  const actualValue = getIn(json, path)
  if (!isEqual(actualValue, value)) {
    throw new Error('Test failed, value differs')
  }
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

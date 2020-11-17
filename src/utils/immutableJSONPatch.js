import {
  deleteIn,
  existsIn,
  getIn,
  insertAt,
  setIn
} from './immutabilityHelpers.js'
import { compileJSONPointer, parseJSONPointer } from './jsonPointer.js'
import { isEqual, initial, last } from 'lodash-es'

/**
 * Apply a patch to a JSON object
 * The original JSON object will not be changed,
 * instead, the patch is applied in an immutable way
 * @param {JSON} json
 * @param {JSONPatchDocument} operations    Array with JSON patch operations
 * @return {{json: JSON, revert: JSONPatchDocument, error: Error | null}}
 */
export function immutableJSONPatch (json, operations) {
  let updatedJson = json
  let revert = []

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const path = operation.path !== undefined ? parseJSONPointer(operation.path) : null
    const from = operation.from !== undefined ? parseJSONPointer(operation.from) : null

    switch (operation.op) {
      case 'add': {
        const result = add(updatedJson, path, operation.value)
        updatedJson = result.json
        revert = result.revert.concat(revert)
        break
      }

      case 'remove': {
        const result = remove(updatedJson, path)
        updatedJson = result.json
        revert = result.revert.concat(revert)

        break
      }

      case 'replace': {
        const result = replace(updatedJson, path, operation.value)
        updatedJson = result.json
        revert = result.revert.concat(revert)

        break
      }

      case 'copy': {
        if (!operation.from) {
          return {
            json: updatedJson,
            revert: [],
            error: new Error('Property "from" expected in copy operation ' + JSON.stringify(operation))
          }
        }

        const result = copy(updatedJson, path, from)
        updatedJson = result.json
        revert = result.revert.concat(revert)

        break
      }

      case 'move': {
        if (!operation.from) {
          return {
            json: updatedJson,
            revert: [],
            error: new Error('Property "from" expected in move operation ' + JSON.stringify(operation))
          }
        }

        const result = move(updatedJson, path, from)
        updatedJson = result.json
        revert = result.revert.concat(revert)

        break
      }

      case 'test': {
        // when a test fails, cancel the whole patch and return the error
        const error = test(updatedJson, path, operation.value)
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
          error: new Error('Unknown JSONPatch op ' + JSON.stringify(operation.op))
        }
      }
    }
  }

  return {
    json: updatedJson,
    revert,
    error: null
  }
}

/**
 * Replace an existing item
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @return {{json: JSON, revert: JSONPatchDocument}}
 */
export function replace (json, path, value) {
  const oldValue = getIn(json, path)

  return {
    json: setIn(json, path, value),
    revert: [{
      op: 'replace',
      path: compileJSONPointer(path),
      value: oldValue
    }]
  }
}

/**
 * Remove an item or property
 * @param {JSON} json
 * @param {Path} path
 * @return {{json: JSON, revert: JSONPatchDocument}}
 */
export function remove (json, path) {
  const oldValue = getIn(json, path)

  return {
    json: deleteIn(json, path),
    revert: [{
      op: 'add',
      path: compileJSONPointer(path),
      value: oldValue
    }]
  }
}

/**
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @return {{json: JSON, revert: JSONPatchDocument}}
 * @private
 */
export function add (json, path, value) {
  const resolvedPath = resolvePathIndex(json, path)
  const parent = getIn(json, initial(path))
  const parentIsArray = Array.isArray(parent)
  const oldValue = parentIsArray
    ? undefined
    : getIn(json, resolvedPath)

  const updatedJson = parentIsArray
    ? insertAt(json, resolvedPath, value)
    : setIn(json, resolvedPath, value)

  if (!parentIsArray && existsIn(json, resolvedPath)) {
    return {
      json: updatedJson,
      revert: [{
        op: 'replace',
        path: compileJSONPointer(resolvedPath),
        value: oldValue
      }]
    }
  } else {
    return {
      json: updatedJson,
      revert: [{
        op: 'remove',
        path: compileJSONPointer(resolvedPath)
      }]
    }
  }
}

/**
 * Copy a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @return {{json: JSON, revert: JSONPatchDocument}}
 * @private
 */
export function copy (json, path, from) {
  const value = getIn(json, from)

  return add(json, path, value)
}

/**
 * Move a value
 * @param {JSON} json
 * @param {Path} path
 * @param {Path} from
 * @return {{json: JSON, revert: JSONPatchDocument}}
 * @private
 */
export function move (json, path, from) {
  const resolvedPath = resolvePathIndex(json, path)
  const parent = getIn(json, initial(path))
  const parentIsArray = Array.isArray(parent)
  const oldValue = getIn(json, path)
  const value = getIn(json, from)

  const removedJson = remove(json, from).json
  const updatedJson = parentIsArray
    ? insertAt(removedJson, resolvedPath, value)
    : setIn(removedJson, resolvedPath, value)

  if (oldValue !== undefined && !parentIsArray) {
    // replaces an existing value in an object
    return {
      json: updatedJson,
      revert: [
        {
          op: 'move',
          from: compileJSONPointer(resolvedPath),
          path: compileJSONPointer(from)
        },
        {
          op: 'add',
          path: compileJSONPointer(resolvedPath),
          value: oldValue
        }
      ]
    }
  } else {
    return {
      json: updatedJson,
      revert: [
        {
          op: 'move',
          from: compileJSONPointer(resolvedPath),
          path: compileJSONPointer(from)
        }
      ]
    }
  }
}

/**
 * Test whether the data contains the provided value at the specified path.
 * Throws an error when the test fails.
 * @param {JSON} json
 * @param {Path} path
 * @param {JSON} value
 * @return {null | Error} Returns an error when the tests, returns null otherwise
 */
export function test (json, path, value) {
  if (value === undefined) {
    return new Error('Test failed, no value provided')
  }

  if (!existsIn(json, path)) {
    return new Error('Test failed, path not found')
  }

  const actualValue = getIn(json, path)
  if (!isEqual(actualValue, value)) {
    return new Error('Test failed, value differs')
  }
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

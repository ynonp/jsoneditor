import { first, initial, isEmpty, last, pickBy, cloneDeepWith } from 'lodash-es'
import { STATE_PROPS } from '../constants.js'
import { getNextKeys } from '../logic/documentState.js'
import { getParentPath } from '../logic/selection.js'
import { getIn } from '../utils/immutabilityHelpers.js'
import { compileJSONPointer } from '../utils/jsonPointer.js'
import { findUniqueName } from '../utils/stringUtils.js'
import { isObject } from '../utils/typeUtils.js'

/**
 * Create a JSONPatch for an insert operation.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path} path
 * @param {Array.<{key?: string, value: JSON}>} values
 * @param {string[]} nextKeys   A list with all keys *after* the renamed key,
 *                              these keys will be moved down, so the renamed
 *                              key will maintain it's position above these keys
 * @return {JSONPatchDocument}
 */
export function insertBefore (json, path, values, nextKeys) { // TODO: find a better name and define datastructure for values
  const parentPath = initial(path)
  const parent = getIn(json, parentPath)

  if (Array.isArray(parent)) {
    const offset = parseInt(last(path), 10)
    return values.map((entry, index) => ({
      op: 'add',
      path: compileJSONPointer(parentPath.concat(offset + index)),
      value: entry.value
    }))
  } else { // 'object'
    return [
      // insert new values
      ...values.map(entry => {
        const newProp = findUniqueName(entry.key, parent)
        return {
          op: 'add',
          path: compileJSONPointer(parentPath.concat(newProp)),
          value: entry.value
        }
      }),

      // move all lower down keys so the inserted key will maintain it's position
      ...nextKeys.map(key => moveDown(parentPath, key))
    ]
  }
}

/**
 * Create a JSONPatch for an append operation. The values will be appended
 * to the end of the array or object.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path} path
 * @param {Array.<{key?: string, value: JSON}>} values
 * @return {JSONPatchDocument}
 */
export function append (json, path, values) { // TODO: find a better name and define datastructure for values
  const parent = getIn(json, path)

  if (Array.isArray(parent)) {
    const offset = parent.length
    return values.map((entry, index) => ({
      op: 'add',
      path: compileJSONPointer(path.concat(offset + index)),
      value: entry.value
    }))
  } else { // 'object'
    return values.map(entry => {
      const newProp = findUniqueName(entry.key, parent)
      return {
        op: 'add',
        path: compileJSONPointer(path.concat(newProp)),
        value: entry.value
      }
    })
  }
}

/**
 * Rename an object key
 * Not applicable to arrays
 *
 * @param {Path} parentPath
 * @param {string} oldKey
 * @param {string} newKey
 * @param {string[]} nextKeys   A list with all keys *after* the renamed key,
 *                              these keys will be moved down, so the renamed
 *                              key will maintain it's position above these keys
 * @returns {JSONPatchDocument}
 */
export function rename (parentPath, oldKey, newKey, nextKeys) {
  return [
    // rename a key
    {
      op: 'move',
      from: compileJSONPointer(parentPath.concat(oldKey)),
      path: compileJSONPointer(parentPath.concat(newKey))
    },

    // move all lower down keys so the renamed key will maintain it's position
    ...nextKeys.map(key => moveDown(parentPath, key))
  ]
}

/**
 * Create a JSONPatch for an insert operation.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path[]} paths
 * @param {Array.<{key?: string, value: JSON}>} values
 * @param {string[]} nextKeys   A list with all keys *after* the renamed key,
 *                              these keys will be moved down, so the renamed
 *                              key will maintain it's position above these keys
 * @return {JSONPatchDocument}
 */
export function replace (json, paths, values, nextKeys) { // TODO: find a better name and define datastructure for values
  const firstPath = first(paths)
  const parentPath = initial(firstPath)
  const parent = getIn(json, parentPath)

  if (Array.isArray(parent)) {
    const firstPath = first(paths)
    const offset = firstPath ? parseInt(last(firstPath), 10) : 0

    return [
      // remove operations
      ...removeAll(paths),

      // insert operations
      values.map((entry, index) => ({
        op: 'add',
        path: compileJSONPointer(parentPath.concat(index + offset)),
        value: entry.value
      }))
    ]
  } else { // parent is Object
    // if we're going to replace an existing object with key "a" with a new
    // key "a", we must not create a new unique name "a (copy)".
    const removeKeys = new Set(paths.map(path => last(path)))
    const parentWithoutRemovedKeys = pickBy(parent, (value, key) => !removeKeys.has(key))

    return [
      // remove operations
      ...removeAll(paths),

      // insert operations
      ...values.map(entry => {
        const newProp = findUniqueName(entry.key, parentWithoutRemovedKeys)
        return {
          op: 'add',
          path: compileJSONPointer(parentPath.concat(newProp)),
          value: entry.value
        }
      }),

      // move down operations
      // move all lower down keys so the renamed key will maintain it's position
      ...nextKeys.map(key => moveDown(parentPath, key))
    ]
  }
}

/**
 * Create a JSONPatch for a duplicate action.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the duplicated node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {JSON} doc
 * @param {Path[]} paths
 * @return {JSONPatchDocument}
 */
export function duplicate (doc, state, paths) {
  // FIXME: here we assume selection.paths is sorted correctly, that's a dangerous assumption
  const lastPath = last(paths)
  const parentPath = initial(lastPath)
  const beforeKey = last(lastPath)
  const props = getIn(state, parentPath.concat(STATE_PROPS))
  const nextKeys = getNextKeys(props, beforeKey, false)
  const parent = getIn(doc, parentPath)

  if (Array.isArray(parent)) {
    const lastPath = last(paths)
    const offset = lastPath ? (parseInt(last(lastPath), 10) + 1) : 0

    return [
      // copy operations
      ...paths.map((path, index) => ({
        op: 'copy',
        from: compileJSONPointer(path),
        path: compileJSONPointer(parentPath.concat(index + offset))
      })),

      // move down operations
      // move all lower down keys so the renamed key will maintain it's position
      ...nextKeys.map(key => moveDown(parentPath, key))
    ]
  } else { // 'object'
    return [
      // copy operations
      ...paths.map(path => {
        const prop = last(path)
        const newProp = findUniqueName(prop, parent)

        return {
          op: 'copy',
          from: compileJSONPointer(path),
          path: compileJSONPointer(parentPath.concat(newProp))
        }
      }),

      // move down operations
      // move all lower down keys so the renamed key will maintain it's position
      ...nextKeys.map(key => moveDown(parentPath, key))
    ]
  }
}

export function insert (doc, state, selection, values) {
  if (selection.beforePath) {
    const parentPath = initial(selection.beforePath)
    const beforeKey = last(selection.beforePath)
    const props = getIn(state, parentPath.concat(STATE_PROPS))
    const nextKeys = getNextKeys(props, beforeKey, true)
    const operations = insertBefore(doc, selection.beforePath, values, nextKeys)
    // TODO: move calculation of nextKeys inside insertBefore?

    return operations
  } else if (selection.appendPath) {
    const operations = append(doc, selection.appendPath, values)

    return operations
  } else if (selection.paths) {
    const lastPath = last(selection.paths) // FIXME: here we assume selection.paths is sorted correctly, that's a dangerous assumption
    const parentPath = initial(lastPath)
    const beforeKey = last(lastPath)
    const props = getIn(state, parentPath.concat(STATE_PROPS))
    const nextKeys = getNextKeys(props, beforeKey, true)
    const operations = replace(doc, selection.paths, values, nextKeys)
    // TODO: move calculation of nextKeys inside replace?

    return operations
  }
}

export function createNewValue (doc, selection, type) {
  switch (type) {
    case 'value':
      return ''

    case 'object':
      return {}

    case 'array':
      return []

    case 'structure': {
      const parentPath = getParentPath(selection)
      const parent = getIn(doc, parentPath)

      if (Array.isArray(parent) && !isEmpty(parent)) {
        const jsonExample = first(parent)
        const structure = cloneDeepWith(jsonExample, (value) => {
          return Array.isArray(value)
            ? []
            : isObject(value)
              ? undefined // leave object as is, will recurse into it
              : ''
        })

        console.log('structure', jsonExample, structure)

        return structure
      } else {
        // no example structure
        return ''
      }
    }

    default:
      return ''
  }
}

/**
 * Create a JSONPatch for a remove operation
 * @param {Path} path
 * @return {JSONPatchDocument}
 */
export function remove (path) {
  return [{
    op: 'remove',
    path: compileJSONPointer(path)
  }]
}

/**
 * Create a JSONPatch for a multiple remove operation
 * @param {Path[]} paths
 * @return {JSONPatchDocument}
 */
export function removeAll (paths) {
  return paths
    .map(path => ({
      op: 'remove',
      path: compileJSONPointer(path)
    }))
    .reverse() // reverse is needed for arrays: delete the last index first
}

// helper function to move a key down in an object,
// so another key can get positioned before the moved down keys
function moveDown (parentPath, key) {
  return {
    op: 'move',
    from: compileJSONPointer(parentPath.concat(key)),
    path: compileJSONPointer(parentPath.concat(key))
  }
}

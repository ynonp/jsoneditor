import first from 'lodash/first'
import initial from 'lodash/initial'
import last from 'lodash/last'
import { getIn } from './utils/immutabilityHelpers'
import { compileJSONPointer } from './utils/jsonPointer'
import { findUniqueName } from './utils/stringUtils'

/**
 * Create a JSONPatch for an insert action.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path} path
 * @param {Array.<{key?: string, value: JSON}>} values
 * @return {Array}
 */
export function insertBefore (json, path, values) {  // TODO: find a better name and define datastructure for values
  const parentPath = initial(path)
  const parent = getIn(json, parentPath)

  if (Array.isArray(parent)) {
    const startIndex = parseInt(last(path), 10)
    return values.map((entry, offset) => ({
      op: 'add',
      path: compileJSONPointer(parentPath.concat(startIndex + offset)),
      value: entry.value
    }))
  }
  else { // 'object'
    const addActions = values.map(entry => {
      const newProp = findUniqueName(entry.key, parent)
      return {
        op: 'add',
        path: compileJSONPointer(parentPath.concat(newProp)),
        value: entry.value
      }
    })

    // we move all lower down properties to the same parent again,
    // to force them to move under the inserted properties instead of the
    // new properties appearing at the bottom of the object
    const keys = Object.keys(parent)
    const beforeKey = last(path)
    const beforeIndex = keys.indexOf(beforeKey)
    const keysToMove = (beforeIndex !== -1)
      ? keys.slice(beforeIndex)
      : []
    const moveActions = keysToMove.map(key => {
      const movePath = compileJSONPointer(parentPath.concat(key))
      return {
        op: 'move',
        from: movePath,
        path: movePath
      }
    })

    return addActions.concat(moveActions)
  }
}

/**
 * Create a JSONPatch for an insert action.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path} path
 * @param {Array.<{key?: string, value: JSON}>} values
 * @return {Array}
 */
export function insertAfter (json, path, values) {  // TODO: find a better name and define datastructure for values
  // TODO: refactor. path should be parent path
  const parentPath = initial(path)
  const parent = getIn(json, parentPath)

  if (Array.isArray(parent)) {
    const startIndex = parseInt(last(path), 10)
    return values.map((entry, offset) => ({
      op: 'add',
      path: compileJSONPointer(parentPath.concat(startIndex + 1 + offset)), // +1 to insert after
      value: entry.value
    }))
  }
  else { // 'object'
    return values.map(entry => {
      const newProp = findUniqueName(entry.key, parent)
      return {
        op: 'add',
        path: compileJSONPointer(parentPath.concat(newProp)),
        value: entry.value
      }
    })
  }
}

/**
 * Create a JSONPatch for an insert action.
 *
 * This function needs the current data in order to be able to determine
 * a unique property name for the inserted node in case of duplicating
 * and object property
 *
 * @param {JSON} json
 * @param {Path[]} paths
 * @param {Array.<{key?: string, value: JSON}>} values
 * @return {Array}
 */
export function replace (json, paths, values) {  // TODO: find a better name and define datastructure for values
  const firstPath = first(paths)
  const parentPath = initial(firstPath)
  const parent = getIn(json, parentPath)

  if (Array.isArray(parent)) {
    const firstPath = first(paths)
    const offset = firstPath ? parseInt(last(firstPath), 10) : 0

    const removeActions = removeAll(paths)
    const insertActions = values.map((entry, index) => ({
      op: 'add',
      path: compileJSONPointer(parentPath.concat(index + offset)),
      value: entry.value
    }))

    return removeActions.concat(insertActions)
  }
  else { // parent is Object
    const removeActions = removeAll(paths)
    const insertActions = values.map(entry => {
      const newProp = findUniqueName(entry.key, parent)
      return {
        op: 'add',
        path: compileJSONPointer(parentPath.concat(newProp)),
        value: entry.value
      }
    })

    // we move all lower down properties to the same parent again,
    // to force them to move under the inserted properties instead of the
    // new properties appearing at the bottom of the object
    const keys = Object.keys(parent)
    const beforeKey = last(firstPath)
    const beforeIndex = keys.indexOf(beforeKey)
    const keysToMove = (beforeIndex !== -1)
      ? keys.slice(beforeIndex)
      : []
    const moveActions = keysToMove.map(key => {
      const movePath = compileJSONPointer(parentPath.concat(key))
      return {
        op: 'move',
        from: movePath,
        path: movePath
      }
    })

    return removeActions.concat(insertActions, moveActions)
  }
}

/**
 * Create a JSONPatch for a remove action
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
 * Create a JSONPatch for a multiple remove action
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

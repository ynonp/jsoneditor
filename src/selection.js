import { isEqual } from 'lodash-es'
import { STATE_PROPS } from './constants.js'
import { getIn } from './utils/immutabilityHelpers.js'
import { compileJSONPointer, parseJSONPointer } from './utils/jsonPointer.js'
import { isObject } from './utils/typeUtils.js'

/**
 * Expand a selection start and end into an array containing all paths
 * between (and including) start and end
 *
 * @param {JSON} doc
 * @param {JSON} state
 * @param {Path} anchorPath
 * @param {Path} focusPath
 * @return {Path[]} paths
 */
export function expandSelection (doc, state, anchorPath, focusPath) {
  if (isEqual(anchorPath, focusPath)) {
    // just a single node
    return [ anchorPath ]
  } else {
    // multiple nodes
    let sharedPath = findSharedPath(anchorPath, focusPath)

    if (anchorPath.length === sharedPath.length || focusPath.length === sharedPath.length) {
      // a parent and a child, like ['arr', 1] and ['arr']
      return [ sharedPath ]
    }

    const anchorKey = anchorPath[sharedPath.length]
    const focusKey = focusPath[sharedPath.length]
    const value = getIn(doc, sharedPath)

    if (isObject(value)) {
      const props = getIn(state, sharedPath.concat(STATE_PROPS))
      const anchorIndex = props.findIndex(prop => prop.key === anchorKey)
      const focusIndex = props.findIndex(prop => prop.key === focusKey)

      if (anchorIndex !== -1 && focusIndex !== -1) {
        const startIndex = Math.min(anchorIndex, focusIndex)
        const endIndex = Math.max(anchorIndex, focusIndex)
        const paths = []

        for (let i = startIndex; i <= endIndex; i++) {
          paths.push(sharedPath.concat(props[i].key))
        }

        return paths
      }
    }

    if (Array.isArray(value)) {
      const startIndex = Math.min(anchorKey, focusKey)
      const endIndex = Math.max(anchorKey, focusKey)
      const paths = []

      for (let i = startIndex; i <= endIndex; i++) {
        paths.push(sharedPath.concat(i))
      }

      return paths
    }
  }

  throw new Error('Failed to create selection')
}

/**
 * @param {JSONPatchDocument} operations
 * @returns {MultiSelection}
 */
export function createSelectionFromOperations (operations) {
  const paths = operations
    .filter(operation => operation.op === 'add' || operation.op === 'copy')
    .map(operation => parseJSONPointer(operation.path))

  return  {
    paths,
    pathsMap: createPathsMap(paths)
  }
}

/**
 * @param {Path[]} paths
 * @returns {Object}
 */
export function createPathsMap (paths) {
  const pathsMap = {}

  paths.forEach(path => {
    pathsMap[compileJSONPointer(path)] = true
  })

  return pathsMap
}

/**
 * Find the common path of two paths.
 * For example findCommonRoot(['arr', '1', 'name'], ['arr', '1', 'address', 'contact']) returns ['arr', '1']
 * @param {Path} path1
 * @param {Path} path2
 * @return {Path}
 */
// TODO: write unit tests for findSharedPath
export function findSharedPath (path1, path2) {
  let i = 0;
  while (i < path1.length && path1[i] === path2[i]) {
    i++;
  }

  return path1.slice(0, i)
}

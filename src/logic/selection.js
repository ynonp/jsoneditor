import { first, initial, isEmpty, isEqual, last } from 'lodash-es'
import { STATE_PROPS } from '../constants.js'
import { getIn } from '../utils/immutabilityHelpers.js'
import { compileJSONPointer, parseJSONPointer } from '../utils/jsonPointer.js'
import { isObject } from '../utils/typeUtils.js'
import {
  getNextVisiblePath,
  getPreviousVisiblePath,
  getVisiblePaths
} from './documentState.js'

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
    return [anchorPath]
  } else {
    // multiple nodes
    const sharedPath = findSharedPath(anchorPath, focusPath)

    if (anchorPath.length === sharedPath.length || focusPath.length === sharedPath.length) {
      // a parent and a child, like ['arr', 1] and ['arr']
      return [sharedPath]
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
 * @param {Selection} selection
 * @return {Path} Returns parent path
 */
export function getParentPath (selection) {
  if (selection.beforePath) {
    return initial(selection.beforePath)
  }

  if (selection.appendPath) {
    return selection.appendPath
  }

  if (selection.keyPath) {
    return initial(selection.keyPath)
  }

  if (selection.valuePath) {
    return initial(selection.valuePath)
  }

  if (selection.paths) {
    const firstPath = first(selection.paths)
    return initial(firstPath)
  }
}

/**
 * @param {Selection} selection
 * @param {Path} path
 * @return boolean
 */
// TODO: write unit test
export function isSelectionInsidePath (selection, path) {
  return (
    pathStartsWith(selection.focusPath, path) &&
    ((selection.focusPath.length > path.length) || selection.appendPath)
  )
}

/**
 * @param {Selection} selection
 * @returns {Path}
 */
function getLastPath (selection) {
  return (selection.beforePath ||
    selection.appendPath ||
    selection.keyPath ||
    selection.valuePath ||
    last(selection.paths))
}

/**
 * @param {JSON} doc
 * @param {JSON} state
 * @param {Selection} selection
 * @returns {Selection | null}
 */
// TODO: write unit tests
export function getSelectionUp (doc, state, selection) {
  const previousPath = getPreviousVisiblePath(doc, state, selection.focusPath)

  // TODO: deduplicate
  if (previousPath !== null) {
    if (selection.keyPath) {
      const parentPath = initial(previousPath)
      const parent = getIn(doc, parentPath)
      if (Array.isArray(parent) || isEmpty(previousPath)) {
        // switch to valuePath: array has no keys, and root object also not
        return createSelection(doc, state, { valuePath: previousPath })
      } else {
        return createSelection(doc, state, { keyPath: previousPath })
      }
    } else if (selection.valuePath) {
      return createSelection(doc, state, { valuePath: previousPath })
    } else {
      // multi selection with one entry
      return createSelection(doc, state, {
        anchorPath: previousPath,
        focusPath: previousPath
      })
    }
  }

  return null
}

/**
 * @param {JSON} doc
 * @param {JSON} state
 * @param {Selection} selection
 * @returns {Selection | null}
 */
// TODO: write unit tests
export function getSelectionDown (doc, state, selection) {
  const path = getLastPath(selection)
  const nextPath = getNextVisiblePath(doc, state, path)

  // TODO: deduplicate
  if (nextPath !== null) {
    if (selection.keyPath) {
      const parentPath = initial(nextPath)
      const parent = getIn(doc, parentPath)
      if (Array.isArray(parent)) {
        // switch to valuePath: array has no keys
        return createSelection(doc, state, { valuePath: nextPath })
      } else {
        return createSelection(doc, state, { keyPath: nextPath })
      }
    } else if (selection.valuePath) {
      return createSelection(doc, state, { valuePath: nextPath })
    } else {
      // multi selection with one entry
      return createSelection(doc, state, {
        anchorPath: nextPath,
        focusPath: nextPath
      })
    }
  }

  return null
}

/**
 * @param {Selection} selection
 * @returns {Selection | null}
 */
// TODO: write unit tests
export function getSelectionLeft (selection) {
  const path = selection.focusPath
  return {
    keyPath: path,
    anchorPath: path,
    focusPath: path
  }
}

/**
 * @param {Selection} selection
 * @returns {Selection | null}
 */
// TODO: write unit tests
export function getSelectionRight (selection) {
  const path = selection.focusPath
  return {
    valuePath: path,
    anchorPath: path,
    focusPath: path
  }
}

/**
 * Get a proper initial selection based on what is visible
 * @param {JSON} doc
 * @param {JSON} state
 * @returns {Selection}
 */
export function getInitialSelection (doc, state) {
  const visiblePaths = getVisiblePaths(doc, state)

  // find the first, deepest nested entry (normally a value, not an Object/Array)
  let index = 0
  while (index < visiblePaths.length - 1 && visiblePaths[index + 1].length > visiblePaths[index].length) {
    index++
  }

  const path = visiblePaths[index]
  return (path.length === 0 || Array.isArray(getIn(doc, initial(path))))
    ? { valuePath: path, anchorPath: path, focusPath: path } // Array items and root object/array do not have a key, so select value in that case
    : { keyPath: path, anchorPath: path, focusPath: path }
}

/**
 * @param {JSONPatchDocument} operations
 * @returns {MultiSelection}
 */
// TODO: write unit tests
export function createSelectionFromOperations (operations) {
  const paths = operations
    .filter(operation => operation.op === 'add' || operation.op === 'copy')
    .map(operation => parseJSONPointer(operation.path))

  return {
    paths,
    anchorPath: first(paths),
    focusPath: last(paths),
    pathsMap: createPathsMap(paths)
  }
}

/**
 * @param {Path[]} paths
 * @returns {Object}
 */
// TODO: write unit tests
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
  let i = 0
  while (i < path1.length && path1[i] === path2[i]) {
    i++
  }

  return path1.slice(0, i)
}

/**
 * @param {Selection} selection
 * @return {Path}
 */
export function findRootPath (selection) {
  return selection.paths && selection.paths.length > 1
    ? initial(selection.focusPath) // the parent path of the paths
    : selection.focusPath
}

/**
 * @param {Path} path
 * @param {Path} parentPath
 * @return boolean
 */
// TODO: unit test
export function pathStartsWith (path, parentPath) {
  if (path.length < parentPath.length) {
    return false
  }

  for (let  i = 0; i < parentPath.length; i++) {
    if (path[i] !== parentPath[i]) {
      return false
    }
  }

  return true
}

/**
 * @param {Selection} selection
 * @return {Selection}
 */
// TODO: write unit tests
export function removeEditModeFromSelection (selection) {
  if (selection && selection.edit) {
    return {
      ...selection,
      edit: false
    }
  } else {
    return selection
  }
}

/**
 * @param {JSON} doc
 * @param {JSON} state
 * @param {SelectionSchema} selectionSchema
 * @return {Selection}
 */
// TODO: write unit tests
export function createSelection(doc, state, selectionSchema) {
  const { anchorPath, focusPath, beforePath, appendPath, keyPath, valuePath, edit = false, next = false } = selectionSchema

  if (keyPath) {
    let selection = {
      keyPath,
      anchorPath: keyPath,
      focusPath: keyPath,
      edit
    }
    if (next) {
      selection = getSelectionDown(doc, state, selection)
    }
    return selection
  } else if (valuePath) {
    let selection = {
      valuePath,
      anchorPath: valuePath,
      focusPath: valuePath,
      edit
    }
    if (next) {
      selection = getSelectionDown(doc, state, selection)
    }
    return selection
  } else if (beforePath) {
    return {
      beforePath,
      anchorPath: beforePath,
      focusPath: beforePath
    }
  } else if (appendPath) {
    return {
      appendPath,
      anchorPath: appendPath,
      focusPath: appendPath
    }
  } else if (anchorPath && focusPath) {
    const paths = expandSelection(doc, state, anchorPath, focusPath)

    return {
      paths,
      anchorPath,
      focusPath,
      pathsMap: createPathsMap(paths)
    }
  } else {
    throw new TypeError(`Unknown type of selection ${JSON.stringify(selectionSchema)}`)
  }
}

import { initial, isEqual, isNumber, last, uniqueId } from 'lodash-es'
import {
  DEFAULT_VISIBLE_SECTIONS,
  STATE_EXPANDED,
  STATE_ID,
  STATE_KEYS,
  STATE_VISIBLE_SECTIONS
} from '../constants.js'
import { forEachIndex } from '../utils/arrayUtils.js'
import {
  deleteIn,
  getIn,
  insertAt,
  setIn,
  updateIn
} from '../utils/immutabilityHelpers.js'
import { compileJSONPointer, parseJSONPointer } from '../utils/jsonPointer.js'
import { isObject } from '../utils/typeUtils.js'
import {
  inVisibleSection,
  mergeSections,
  nextRoundNumber,
  previousRoundNumber
} from './expandItemsSections.js'

/**
 * Sync a state object with the doc it belongs to: update keys, limit, and expanded state
 *
 * @param {JSON} doc
 * @param {JSON | undefined} state
 * @param {Path} path
 * @param {function (path: Path) : boolean} expand
 * @param {boolean} [forceRefresh=false] if true, force refreshing the expanded state
 * @returns {JSON | undefined}
 */
// TODO: refactor syncState so we don't have to pass path=[] all the time, this is only used internally for recursiveness
export function syncState (doc, state, path, expand, forceRefresh = false) {
  // TODO: this function can be made way more efficient if we pass prevState:
  //  when immutable, we can simply be done already when the state === prevState

  const updatedState = Array.isArray(doc) ? [] : {}

  // note that state may be a primitive value, inserted by applying a JSON Patch
  // operation. So state[STATE_ID] may be undefined.
  updatedState[STATE_ID] = state && state[STATE_ID]
    ? state[STATE_ID]
    : uniqueId()

  if (isObject(doc)) {
    updatedState[STATE_KEYS] = syncKeys(doc, state && state[STATE_KEYS])

    updatedState[STATE_EXPANDED] = (state && !forceRefresh)
      ? state[STATE_EXPANDED]
      : expand(path)

    if (updatedState[STATE_EXPANDED]) {
      Object.keys(doc).forEach(key => {
        const childDocument = doc[key]
        const childState = state && state[key]
        updatedState[key] = syncState(childDocument, childState, path.concat(key), expand, forceRefresh)
      })
    }

    // FIXME: must create new id's in case of duplicate id's
  } else if (Array.isArray(doc)) {
    updatedState[STATE_EXPANDED] = (state && !forceRefresh)
      ? state[STATE_EXPANDED]
      : expand(path)

    // note that we reset the visible items when the state is not expanded
    updatedState[STATE_VISIBLE_SECTIONS] = (state && updatedState[STATE_EXPANDED])
      ? (state[STATE_VISIBLE_SECTIONS] || DEFAULT_VISIBLE_SECTIONS)
      : DEFAULT_VISIBLE_SECTIONS

    if (updatedState[STATE_EXPANDED]) {
      updatedState[STATE_VISIBLE_SECTIONS].forEach(({ start, end }) => {
        forEachIndex(start, Math.min(doc.length, end), index => {
          const childDocument = doc[index]
          const childState = state && state[index]
          updatedState[index] = syncState(childDocument, childState, path.concat(index), expand, forceRefresh)
        })
      })
    }
  } else {
    // primitive value (string, number, boolean, null)
  }

  return updatedState
}

/**
 * Expand all nodes on given path
 * @param {JSON} state
 * @param {Path} path
 * @return {JSON} returns the updated state
 */
// TODO: write unit tests for expandPath
export function expandPath (state, path) {
  let updatedState = state

  for (let i = 0; i < path.length; i++) {
    const partialPath = path.slice(0, i)
    const expandedPath = partialPath.concat(STATE_EXPANDED)
    updatedState = setIn(updatedState, expandedPath, true, true)

    // if needed, enlarge the expanded sections such that the search result becomes visible in the array
    const key = path[i]
    if (isNumber(key)) {
      const sectionsPath = partialPath.concat(STATE_VISIBLE_SECTIONS)
      const sections = getIn(updatedState, sectionsPath) || DEFAULT_VISIBLE_SECTIONS
      if (!inVisibleSection(sections, key)) {
        const start = previousRoundNumber(key)
        const end = nextRoundNumber(start)
        const newSection = { start, end }
        const updatedSections = mergeSections(sections.concat(newSection))
        updatedState = setIn(updatedState, sectionsPath, updatedSections)
      }
    }
  }

  return updatedState
}

/**
 * Expand a section of items in an array
 * @param {JSON} state
 * @param {Path} path
 * @param {Section} section
 * @return {JSON} returns the updated state
 */
// TODO: write unit test
export function expandSection (state, path, section) {
  return updateIn(state, path.concat(STATE_VISIBLE_SECTIONS), (sections = DEFAULT_VISIBLE_SECTIONS) => {
    return mergeSections(sections.concat(section))
  })
}

export function syncKeys (value, prevKeys) {
  if (!isObject(value)) {
    return undefined
  }

  if (!prevKeys) {
    return Object.keys(value)
  }

  // copy the keys that still exist
  const keys = prevKeys.filter(key => value[key] !== undefined)

  // add new keys
  const keysSet = new Set(keys)
  Object.keys(value)
    .filter(key => !keysSet.has(key))
    .forEach(key => keys.push(key))

  return keys
}

// TODO: write unit tests
// TODO: split this function in smaller functions
export function patchKeys (state, operations) {
  let updatedState = state

  operations.forEach(operation => {
    if (operation.op === 'move') {
      if (isEqual(
        initial(parseJSONPointer(operation.from)),
        initial(parseJSONPointer(operation.path))
      )) {
        // move inside the same object
        const pathFrom = parseJSONPointer(operation.from)
        const pathTo = parseJSONPointer(operation.path)
        const parentPath = initial(pathFrom)
        const keys = getIn(updatedState, parentPath.concat(STATE_KEYS))

        const oldKey = last(pathFrom)
        const newKey = last(pathTo)
        const oldIndex = keys.indexOf(oldKey)

        if (oldIndex !== -1) {
          if (oldKey !== newKey) {
            // A key is renamed.

            // in case the new key shadows an existing key, remove the existing key
            const newIndex = keys.indexOf(newKey)
            if (newIndex !== -1) {
              const updatedKeys = deleteIn(keys, [newIndex])
              updatedState = setIn(updatedState, parentPath.concat([STATE_KEYS]), updatedKeys, true)
            }

            // Rename the key in the object's keys so it maintains its identity and hence its index
            updatedState = setIn(updatedState, parentPath.concat([STATE_KEYS, oldIndex, 'key']), newKey, true)
          } else {
            // operation.from and operation.path are the same:
            // key is moved but stays the same -> move it to the end of the keys
            const oldKey = keys[oldIndex]
            const updatedKeys = insertAt(deleteIn(keys, [oldIndex]), [keys.length - 1], oldKey)

            updatedState = setIn(updatedState, parentPath.concat([STATE_KEYS]), updatedKeys, true)
          }
        }
      }
    }

    if (operation.op === 'add' || operation.op === 'copy') {
      const pathTo = parseJSONPointer(operation.path)
      const parentPath = initial(pathTo)
      const key = last(pathTo)
      const keys = getIn(updatedState, parentPath.concat(STATE_KEYS))
      if (keys) {
        const index = keys.indexOf(key)
        if (index === -1) {
          const updatedKeys = insertAt(keys, [keys.length], key)

          updatedState = setIn(updatedState, parentPath.concat([STATE_KEYS]), updatedKeys, true)
        }
      }
    }
  })

  return updatedState
}

export function getNextKeys (keys, key, includeKey = false) {
  if (keys) {
    const index = keys.indexOf(key)
    if (index !== -1) {
      return includeKey
        ? keys.slice(index)
        : keys.slice(index + 1)
    }
  }

  return []
}

/**
 * Get all paths which are visible and rendered
 * @param {JSON} doc
 * @param {JSON} state
 * @returns {Path[]}
 */
// TODO: create memoized version of getVisiblePaths which remembers just the previous result if doc and state are the same
export function getVisiblePaths (doc, state) {
  const paths = [
    [] // root itself is always visible
  ]

  function _recurse (doc, state, path) {
    if (doc && state && state[STATE_EXPANDED] === true) {
      if (Array.isArray(doc)) {
        const visibleSections = state[STATE_VISIBLE_SECTIONS]

        visibleSections.forEach(({ start, end }) => {
          forEachIndex(start, Math.min(doc.length, end), index => {
            paths.push(path.concat(index))
            _recurse(doc[index], state[index], path.concat(index))
          })
        })
      } else { // Object
        const keys = state[STATE_KEYS]
        keys.forEach(key => {
          paths.push(path.concat(key))
          _recurse(doc[key], state[key], path.concat(key))
        })
      }
    }
  }

  _recurse(doc, state, [])

  return paths
}

/**
 * Find the previous visible path.
 * This can be the last child of the previous object or array, or the parent of a first entry.
 * @param {JSON} doc
 * @param {JSON} state
 * @param {Path} path
 * @return {Path | null}
 */
// TODO: write tests for getPreviousVisiblePath
export function getPreviousVisiblePath (doc, state, path) {
  const visiblePaths = getVisiblePaths(doc, state)
  const visiblePathPointers = visiblePaths.map(compileJSONPointer)
  const pathPointer = compileJSONPointer(path)
  const index = visiblePathPointers.indexOf(pathPointer)

  if (index !== -1 && index > 0) {
    return visiblePaths[index - 1]
  }

  return null
}

/**
 * Find the next visible path.
 * This can be the next parent entry.
 * @param {JSON} doc
 * @param {JSON} state
 * @param {Path} path
 * @param {boolean} [after=false]
 * @return {Path | null} path
 */
// TODO: write tests for getNextVisiblePath
export function getNextVisiblePath (doc, state, path, after = false) {
  const visiblePaths = getVisiblePaths(doc, state)
  const visiblePathPointers = visiblePaths.map(compileJSONPointer)
  const index = visiblePathPointers.indexOf(compileJSONPointer(path))

  if (index !== -1 && index < visiblePaths.length - 1) {
    return visiblePaths[index + 1]
  }

  return null
}

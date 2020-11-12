import { initial, isEqual, isNumber, last, uniqueId } from 'lodash-es'
import {
  DEFAULT_VISIBLE_SECTIONS,
  STATE_EXPANDED,
  STATE_PROPS,
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
import { isObject, isObjectOrArray } from '../utils/typeUtils.js'
import {
  inVisibleSection,
  mergeSections,
  nextRoundNumber,
  previousRoundNumber
} from './expandItemsSections.js'

/**
 * Sync a state object with the doc it belongs to: update props, limit, and expanded state
 *
 * @param {JSON} doc
 * @param {JSON | undefined} state
 * @param {Path} path
 * @param {function (path: Path) : boolean} expand
 * @param {boolean} [forceRefresh=false] if true, force refreshing the expanded state
 * @returns {JSON | undefined}
 */
export function syncState (doc, state = undefined, path, expand, forceRefresh = false) {
  // TODO: this function can be made way more efficient if we pass prevState:
  //  when immutable, we can simply be done already when the state === prevState

  if (isObject(doc)) {
    const updatedState = {}

    updatedState[STATE_PROPS] = updateProps(doc, state && state[STATE_PROPS])

    updatedState[STATE_EXPANDED] = (state && !forceRefresh)
      ? state[STATE_EXPANDED]
      : expand(path)

    if (updatedState[STATE_EXPANDED]) {
      Object.keys(doc).forEach(key => {
        const childDocument = doc[key]
        if (isObjectOrArray(childDocument)) {
          const childState = state && state[key]
          updatedState[key] = syncState(childDocument, childState, path.concat(key), expand, forceRefresh)
        }
      })
    }

    return updatedState
  }

  if (Array.isArray(doc)) {
    const updatedState = []

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
          if (isObjectOrArray(childDocument)) {
            const childState = state && state[index]
            updatedState[index] = syncState(childDocument, childState, path.concat(index), expand, forceRefresh)
          }
        })
      })
    }

    return updatedState
  }

  // primitive values have no state
  return undefined
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

export function updateProps (value, prevProps) {
  if (!isObject(value)) {
    return undefined
  }

  // copy the props that still exist
  const props = prevProps
    ? prevProps.filter(item => value[item.key] !== undefined)
    : []

  // add new props
  const prevKeys = new Set(props.map(item => item.key))
  Object.keys(value).forEach(key => {
    if (!prevKeys.has(key)) {
      props.push({
        id: uniqueId(),
        key
      })
    }
  })

  return props
}

// TODO: write unit tests
// TODO: split this function in smaller functions
export function patchProps (state, operations) {
  let updatedState = state

  operations.map(operation => {
    if (operation.op === 'move') {
      if (isEqual(
        initial(parseJSONPointer(operation.from)),
        initial(parseJSONPointer(operation.path))
      )) {
        // move inside the same object
        const pathFrom = parseJSONPointer(operation.from)
        const pathTo = parseJSONPointer(operation.path)
        const parentPath = initial(pathFrom)
        const props = getIn(updatedState, parentPath.concat(STATE_PROPS))

        if (props) {
          const oldKey = last(pathFrom)
          const newKey = last(pathTo)
          const oldIndex = props.findIndex(item => item.key === oldKey)

          if (oldIndex !== -1) {
            if (oldKey !== newKey) {
              // A property is renamed.

              // in case the new key shadows an existing key, remove the existing key
              const newIndex = props.findIndex(item => item.key === newKey)
              if (newIndex !== -1) {
                const updatedProps = deleteIn(props, [newIndex])
                updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps, true)
              }

              // Rename the key in the object's props so it maintains its identity and hence its index
              updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS, oldIndex, 'key']), newKey, true)
            } else {
              // operation.from and operation.path are the same:
              // property is moved but stays the same -> move it to the end of the props
              const oldProp = props[oldIndex]
              const updatedProps = insertAt(deleteIn(props, [oldIndex]), [props.length - 1], oldProp)

              updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps, true)
            }
          }
        }
      }
    }

    if (operation.op === 'add' || operation.op === 'copy') {
      const pathTo = parseJSONPointer(operation.path)
      const parentPath = initial(pathTo)
      const key = last(pathTo)
      const props = getIn(updatedState, parentPath.concat(STATE_PROPS))
      if (props) {
        const index = props.findIndex(item => item.key === key)
        if (index === -1) {
          const newProp = {
            id: uniqueId(),
            key
          }
          const updatedProps = insertAt(props, [props.length], newProp)

          updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps, true)
        }
      }
    }
  })

  return updatedState
}

export function getNextKeys (props, key, includeKey = false) {
  if (props) {
    const index = props.findIndex(prop => prop.key === key)
    if (index !== -1) {
      return props.slice(index + (includeKey ? 0 : 1)).map(prop => prop.key)
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
  let paths = [
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
        const props = state[STATE_PROPS]
        props.forEach(prop => {
          paths.push(path.concat(prop.key))
          _recurse(doc[prop.key], state[prop.key], path.concat(prop.key))
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

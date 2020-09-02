import { initial, isEqual, isNumber, last, uniqueId } from 'lodash-es'
import {
  DEFAULT_LIMIT,
  STATE_EXPANDED,
  STATE_LIMIT,
  STATE_PROPS
} from '../constants.js'
import { deleteIn, getIn, insertAt, setIn } from '../utils/immutabilityHelpers.js'
import { parseJSONPointer } from '../utils/jsonPointer.js'
import { isObject, isObjectOrArray } from '../utils/typeUtils.js'

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

    // note that we reset the limit when the state is not expanded
    updatedState[STATE_LIMIT] = (state && updatedState[STATE_EXPANDED])
      ? state[STATE_LIMIT]
      : DEFAULT_LIMIT

    if (updatedState[STATE_EXPANDED]) {
      for (let i = 0; i < Math.min(doc.length, updatedState[STATE_LIMIT]); i++) {
        const childDocument = doc[i]
        if (isObjectOrArray(childDocument)) {
          const childState = state && state[i]
          updatedState[i] = syncState(childDocument, childState, path.concat(i), expand, forceRefresh)
        }
      }
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

  for (let i = 1; i < path.length; i++) {
    const partialPath = path.slice(0, i)
    // FIXME: setIn has to create object first
    updatedState = setIn(updatedState, partialPath.concat(STATE_EXPANDED), true, true)

    // if needed, enlarge the limit such that the search result becomes visible
    const key = path[i]
    if (isNumber(key)) {
      const limit = getIn(updatedState, partialPath.concat(STATE_LIMIT)) || DEFAULT_LIMIT
      if (key > limit) {
        const newLimit = Math.ceil(key / DEFAULT_LIMIT) * DEFAULT_LIMIT
        updatedState = setIn(updatedState, partialPath.concat(STATE_LIMIT), newLimit, true)
      }
    }
  }

  return updatedState
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

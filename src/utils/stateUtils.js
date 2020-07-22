import { isNumber } from 'lodash-es'
import {
  DEFAULT_LIMIT,
  STATE_EXPANDED,
  STATE_LIMIT,
  STATE_PROPS
} from '../constants.js'
import { setIn } from './immutabilityHelpers.js'
import { isObject, isObjectOrArray } from './typeUtils.js'
import { updateProps } from './updateProps.js'

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
export function stateUtils (doc, state = undefined, path, expand, forceRefresh = false) {
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
          updatedState[key] = stateUtils(childDocument, childState, path.concat(key), expand, forceRefresh)
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
          updatedState[i] = stateUtils(childDocument, childState, path.concat(i), expand, forceRefresh)
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
    updatedState = setIn(updatedState, partialPath.concat(STATE_EXPANDED), true)

    // if needed, enlarge the limit such that the search result becomes visible
    const key = path[i]
    if (isNumber(key)) {
      const limit = getIn(updatedState, partialPath.concat(STATE_LIMIT)) || DEFAULT_LIMIT
      if (key > limit) {
        const newLimit = Math.ceil(key / DEFAULT_LIMIT) * DEFAULT_LIMIT
        updatedState = setIn(updatedState, partialPath.concat(STATE_LIMIT), newLimit)
      }
    }
  }

  return updatedState
}

import initial from 'lodash-es/initial.js'
import { STATE_PROPS } from '../constants.js'
import { deleteIn, getIn, insertAt, setIn } from './immutabilityHelpers.js'
import { parseJSONPointer } from './jsonPointer.js'
import { isObject } from './typeUtils.js'
import { isEqual, last, uniqueId } from 'lodash-es'

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
                updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps)
              }

              // Rename the key in the object's props so it maintains its identity and hence its index
              updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS, oldIndex, 'key']), newKey)
            } else {
              // operation.from and operation.path are the same:
              // property is moved but stays the same -> move it to the end of the props
              const oldProp = props[oldIndex]
              const updatedProps = insertAt(deleteIn(props, [oldIndex]), [props.length - 1], oldProp)

              updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps)
            }
          }
        }
      }
    }

    if (operation.op === 'add') {
      const path = parseJSONPointer(operation.path)
      const parentPath = initial(path)
      const props = getIn(updatedState, parentPath.concat(STATE_PROPS))
      if (props) {
        const newProp = {
          id: uniqueId(),
          key: last(path)
        }
        const updatedProps = insertAt(props, [props.length], newProp)

        updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps)
      }
    }
  })

  return updatedState
}

export function getNextKeys(props, parentPath, key, includeKey = false) {
  if (props) {
    const index = props.findIndex(prop => prop.key === key)
    if (index !== -1) {
      return props.slice(index + (includeKey ? 0 : 1)).map(prop => prop.key)
    }
  }

  return []
}
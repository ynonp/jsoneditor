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
          const index = props.findIndex(item => item.key === oldKey)

          if (index !== -1) {
            if (oldKey !== newKey) {
              // A property is renamed. Rename it in the object's props
              // so it maintains its identity and hence its index
              updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS, index, 'key']), newKey)
            } else {
              // operation.from and operation.path are the same:
              // property is moved but stays the same -> move it to the end of the props
              const oldProp = props[index]
              const updatedProps = insertAt(deleteIn(props, [index]), [props.length - 1], oldProp)

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
        const key = last(path)
        const newProp = {
          key,
          id: uniqueId()
        }
        const updatedProps = insertAt(props, [props.length], newProp)

        updatedState = setIn(updatedState, parentPath.concat([STATE_PROPS]), updatedProps)
      }
    }
  })

  return updatedState
}

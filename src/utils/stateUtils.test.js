import assert from 'assert'
import {
  DEFAULT_LIMIT,
  STATE_EXPANDED,
  STATE_LIMIT,
  STATE_PROPS
} from '../constants.js'
import { stateUtils } from './stateUtils.js'

describe('syncState', () => {
  it('syncState', () => {
    const document = {
      array: [1, 2, {c: 6}],
      object: {a: 4, b: 5},
      value: 'hello'
    }

    function expand (path) {
      return path.length <= 1
    }

    const state = stateUtils(document, undefined, [], expand)

    const expectedState = {}
    expectedState[STATE_EXPANDED] = true
    expectedState[STATE_PROPS] =  [
      { 'id': state[STATE_PROPS][0].id, 'key': 'array' },
      { 'id': state[STATE_PROPS][1].id, 'key': 'object' },
      { 'id': state[STATE_PROPS][2].id, 'key': 'value' }
    ]
    expectedState.array = []
    expectedState.array[STATE_EXPANDED] = true
    expectedState.array[STATE_LIMIT] = DEFAULT_LIMIT
    expectedState.array[2] = {}
    expectedState.array[2][STATE_EXPANDED] = false
    expectedState.array[2][STATE_PROPS] = [
      { 'id': state.array[2][STATE_PROPS][0].id, 'key': 'c' } // FIXME: props should not be created because node is not expanded
    ]
    expectedState.object = {}
    expectedState.object[STATE_EXPANDED] = true
    expectedState.object[STATE_PROPS] =  [
      { 'id': state.object[STATE_PROPS][0].id, 'key': 'a' },
      { 'id': state.object[STATE_PROPS][1].id, 'key': 'b' }
    ]

    assert.deepStrictEqual(state, expectedState)
  })

  // TODO: write more unit tests for stateUtils
})

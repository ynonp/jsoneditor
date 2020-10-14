import assert from 'assert'
import {
  DEFAULT_VISIBLE_SECTIONS,
  STATE_EXPANDED,
  STATE_PROPS,
  STATE_VISIBLE_SECTIONS
} from '../constants.js'
import { syncState, updateProps } from './documentState.js'

describe('documentState', () => {
  it('syncState', () => {
    const document = {
      array: [1, 2, { c: 6 }],
      object: { a: 4, b: 5 },
      value: 'hello'
    }

    function expand (path) {
      return path.length <= 1
    }

    const state = syncState(document, undefined, [], expand)

    const expectedState = {}
    expectedState[STATE_EXPANDED] = true
    expectedState[STATE_PROPS] = [
      { id: state[STATE_PROPS][0].id, key: 'array' },
      { id: state[STATE_PROPS][1].id, key: 'object' },
      { id: state[STATE_PROPS][2].id, key: 'value' }
    ]
    expectedState.array = []
    expectedState.array[STATE_EXPANDED] = true
    expectedState.array[STATE_VISIBLE_SECTIONS] = DEFAULT_VISIBLE_SECTIONS
    expectedState.array[2] = {}
    expectedState.array[2][STATE_EXPANDED] = false
    expectedState.array[2][STATE_PROPS] = [
      { id: state.array[2][STATE_PROPS][0].id, key: 'c' } // FIXME: props should not be created because node is not expanded
    ]
    expectedState.object = {}
    expectedState.object[STATE_EXPANDED] = true
    expectedState.object[STATE_PROPS] = [
      { id: state.object[STATE_PROPS][0].id, key: 'a' },
      { id: state.object[STATE_PROPS][1].id, key: 'b' }
    ]

    assert.deepStrictEqual(state, expectedState)
  })

  it('updateProps (1)', () => {
    const props1 = updateProps({ b: 2 })
    assert.deepStrictEqual(props1.map(item => item.key), ['b'])

    const props2 = updateProps({ a: 1, b: 2 }, props1)
    assert.deepStrictEqual(props2.map(item => item.key), ['b', 'a'])
    assert.deepStrictEqual(props2[0], props1[0]) // b must still have the same id
  })

  it('updateProps (2)', () => {
    const props1 = updateProps({ a: 1, b: 2 })
    const props2 = updateProps({ a: 1, b: 2 }, props1)
    assert.deepStrictEqual(props2, props1)
  })

  // TODO: write more unit tests
})

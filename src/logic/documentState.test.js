import assert from 'assert'
import { times } from 'lodash-es'
import {
  ARRAY_SECTION_SIZE,
  DEFAULT_VISIBLE_SECTIONS,
  STATE_EXPANDED,
  STATE_PROPS,
  STATE_VISIBLE_SECTIONS
} from '../constants.js'
import { compileJSONPointer } from '../utils/jsonPointer.js'
import {
  expandSection,
  getVisiblePaths,
  syncState,
  updateProps
} from './documentState.js'

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

  it('get all expanded paths', () => {
    const doc = {
      array: [1, 2, { c: 6 }],
      object: { a: 4, b: 5 },
      value: 'hello'
    }

    const state = syncState(doc, undefined, [], path => false)
    assert.deepStrictEqual(getVisiblePaths(doc, state).map(compileJSONPointer), [
      ''
    ])

    const state0 = syncState(doc, undefined, [], path => path.length <= 0)
    assert.deepStrictEqual(getVisiblePaths(doc, state0).map(compileJSONPointer), [
      '',
      '/array',
      '/object',
      '/value'
    ])

    const state1 = syncState(doc, undefined, [], path => path.length <= 1)
    assert.deepStrictEqual(getVisiblePaths(doc, state1).map(compileJSONPointer), [
      '',
      '/array',
      '/array/0',
      '/array/1',
      '/array/2',
      '/object',
      '/object/a',
      '/object/b',
      '/value'
    ])

    const state2 = syncState(doc, undefined, [], path => path.length <= 2)
    assert.deepStrictEqual(getVisiblePaths(doc, state2).map(compileJSONPointer), [
      '',
      '/array',
      '/array/0',
      '/array/1',
      '/array/2',
      '/array/2/c',
      '/object',
      '/object/a',
      '/object/b',
      '/value'
    ])
  })

  it('get all expanded paths should recon with visible sections in an array', () => {
    const count = 5 * ARRAY_SECTION_SIZE
    const doc = {
      array: times(count, (index) => `item ${index}`)
    }

    // by default, should have a visible section from 0-100 only (so 100-500 is invisible)
    const state1 = syncState(doc, undefined, [], path => path.length <= 1)
    assert.deepStrictEqual(getVisiblePaths(doc, state1).map(compileJSONPointer), [
      '',
      '/array',
      ...times(ARRAY_SECTION_SIZE, (index) => `/array/${index}`)
    ])

    // create a visible section from 200-300 (in addition to the visible section 0-100)
    const start = 200
    const end = 300
    const state2 = expandSection(state1, ['array'], { start, end })
    assert.deepStrictEqual(getVisiblePaths(doc, state2).map(compileJSONPointer), [
      '',
      '/array',
      ...times(ARRAY_SECTION_SIZE, (index) => `/array/${index}`),
      ...times((end - start), (index) => `/array/${index + start}`)
    ])
  })

  // TODO: write more unit tests
})

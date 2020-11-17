import assert from 'assert'
import { times } from 'lodash-es'
import {
  ARRAY_SECTION_SIZE,
  DEFAULT_VISIBLE_SECTIONS,
  STATE_EXPANDED,
  STATE_ID,
  STATE_KEYS,
  STATE_VISIBLE_SECTIONS
} from '../constants.js'
import { compileJSONPointer } from '../utils/jsonPointer.js'
import {
  expandSection,
  getVisiblePaths,
  syncState,
  syncKeys
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

    function throwUndefinedId () {
      throw new Error('Undefined id')
    }

    const state = syncState(document, undefined, [], expand)

    const expectedState = {}
    expectedState[STATE_EXPANDED] = true
    expectedState[STATE_ID] = state[STATE_ID] || throwUndefinedId()
    expectedState[STATE_KEYS] = [ 'array', 'object', 'value' ]
    expectedState.array = [
      {
        [STATE_ID]: state.array[0][STATE_ID] || throwUndefinedId()
      },
      {
        [STATE_ID]: state.array[1][STATE_ID] || throwUndefinedId()
      },
      {
        [STATE_ID]: state.array[2][STATE_ID] || throwUndefinedId(),
        [STATE_EXPANDED]: false,
        [STATE_KEYS]: [ 'c' ] // FIXME: keys should not be created because node is not expanded
      },
    ]
    expectedState.array[STATE_ID] = state.array[STATE_ID] || throwUndefinedId()
    expectedState.array[STATE_EXPANDED] = true
    expectedState.array[STATE_VISIBLE_SECTIONS] = DEFAULT_VISIBLE_SECTIONS
    expectedState.object = {
      [STATE_ID]: state.object[STATE_ID] || throwUndefinedId(),
      [STATE_EXPANDED]: true,
      [STATE_KEYS]: [ 'a', 'b' ],
      a: {
        [STATE_ID]: state.object.a[STATE_ID] || throwUndefinedId(),
      },
      b: {
        [STATE_ID]: state.object.b[STATE_ID] || throwUndefinedId(),
      }
    }
    expectedState.value = {
      [STATE_ID]: state.value[STATE_ID] || throwUndefinedId()
    }

    assert.deepStrictEqual(state, expectedState)
  })

  it('updateKeys (1)', () => {
    const keys1 = syncKeys({ b: 2 })
    assert.deepStrictEqual(keys1, ['b'])

    const keys2 = syncKeys({ a: 1, b: 2 }, keys1)
    assert.deepStrictEqual(keys2, ['b', 'a'])
  })

  it('updateKeys (2)', () => {
    const keys1 = syncKeys({ a: 1, b: 2 })
    const keys2 = syncKeys({ a: 1, b: 2 }, keys1)
    assert.deepStrictEqual(keys2, keys1)
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

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
import { isObject } from '../utils/typeUtils.js'
import {
  collapseSinglePath,
  createState,
  documentStatePatch,
  expandSection,
  expandSinglePath,
  getVisiblePaths,
  syncKeys,
  syncState
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

  describe ('createState', () => {
    it ('should create state for an object', () => {
      const state = createState({ a: 2, b: 3 })

      const expected = {}
      expected[STATE_ID] = state[STATE_ID]
      expected[STATE_EXPANDED] = false
      expected[STATE_KEYS] = ['a', 'b']

      assert.deepStrictEqual(state, expected)
      assert(typeof state[STATE_ID] === 'string')
    })

    it ('should create state for an array', () => {
      const state = createState([ 1, 2, 3 ])

      const expected = []
      expected[STATE_ID] = state[STATE_ID]
      expected[STATE_EXPANDED] = false
      expected[STATE_VISIBLE_SECTIONS] = []

      assert.deepStrictEqual(state, expected)
      assert(typeof state[STATE_ID] === 'string')
    })

    it ('should create state for a primitive value', () => {
      const state = createState(42)

      const expected = {}
      expected[STATE_ID] = state[STATE_ID]

      assert.deepStrictEqual(state, expected)
      assert(typeof state[STATE_ID] === 'string')
    })
  })

  describe('expand', () => {
    it ('should expand an object', () => {
      const doc = { a: 2, b: { bb: 3 } }
      const state = expandSinglePath(doc, createState(doc), [])

      const expected = {}
      expected[STATE_ID] = state[STATE_ID]
      expected[STATE_EXPANDED] = true
      expected[STATE_KEYS] = ['a', 'b']
      expected['a'] = { [STATE_ID] : state['a'][STATE_ID] }
      expected['b'] = {
        [STATE_ID] : state['b'][STATE_ID],
        [STATE_EXPANDED]: false,
        [STATE_KEYS]: ['bb']
      }

      assert.deepStrictEqual(state, expected)

      // expand nested object
      const state2 = expandSinglePath(doc, state, ['b'])

      const expected2 = {}
      expected2[STATE_ID] = state[STATE_ID]
      expected2[STATE_EXPANDED] = true
      expected2[STATE_KEYS] = ['a', 'b']
      expected2['a'] = { [STATE_ID] : state['a'][STATE_ID] }
      expected2['b'] = {
        [STATE_ID] : state['b'][STATE_ID],
        [STATE_EXPANDED]: true,
        [STATE_KEYS]: ['bb'],
        'bb': {
          [STATE_ID] : state2['b']['bb'][STATE_ID],
        }
      }

      assert.deepStrictEqual(state2, expected2)
    })

    it ('should expand an array', () => {
      const doc = [ 1, 2, 3 ]
      const state = expandSinglePath(doc, createState(doc), [])

      const expected = []
      expected[STATE_ID] = state[STATE_ID]
      expected[STATE_EXPANDED] = true
      expected[STATE_VISIBLE_SECTIONS] = [{ start: 0, end: 100 }]
      expected[0] = { [STATE_ID] : state[0][STATE_ID] }
      expected[1] = { [STATE_ID] : state[1][STATE_ID] }
      expected[2] = { [STATE_ID] : state[2][STATE_ID] }

      assert.deepStrictEqual(state, expected)
      assert(typeof state[STATE_ID] === 'string')
    })

    it ('should expand a nested array', () => {
      // TODO
    })

    it ('should not expand a primitive value', () => {
      const doc = 42
      const state = expandSinglePath(doc, createState(doc), [])

      const expected = {}
      expected[STATE_ID] = state[STATE_ID]

      assert.deepStrictEqual(state, expected)
      assert(typeof state[STATE_ID] === 'string')
    })
  })

  describe('collapse', () => {
    it ('should collapse an object', () => {
      const doc = { a: 2, b: { bb: 3 } }
      const state = expandSinglePath(doc, createState(doc), [])
      assert.strictEqual(state[STATE_EXPANDED], true)
      assert.notStrictEqual(state.a, undefined)
      assert.notStrictEqual(state.b, undefined)

      const collapsedState = collapseSinglePath(doc, state, [])

      const expected = {}
      expected[STATE_ID] = state[STATE_ID]
      expected[STATE_EXPANDED] = false
      expected[STATE_KEYS] = ['a', 'b']
      assert.deepStrictEqual(collapsedState, expected)
    })

    it ('should collapse an array', () => {
      const doc = [ 1, 2, 3 ]
      const state = createState(doc)
      assert.strictEqual(state.length, 0)
      assert.strictEqual(state[1], undefined)
      assert.strictEqual(state[2], undefined)
      assert.strictEqual(state[2], undefined)

      const expandedState = expandSinglePath(doc, state, [])
      assert.strictEqual(expandedState[STATE_EXPANDED], true)
      assert.strictEqual(expandedState.length, 3)
      assert.notStrictEqual(expandedState[1], undefined)
      assert.notStrictEqual(expandedState[2], undefined)
      assert.notStrictEqual(expandedState[2], undefined)

      const collapsedState = collapseSinglePath(doc, expandedState, [])
      assert.deepStrictEqual(collapsedState, state)
      assert.deepStrictEqual(collapsedState[STATE_VISIBLE_SECTIONS], [])
      assert.strictEqual(collapsedState.length, 0)
      assert.strictEqual(collapsedState[1], undefined)
      assert.strictEqual(collapsedState[2], undefined)
      assert.strictEqual(collapsedState[2], undefined)
    })

    it ('should not do anything in case of collapsing a primitive value', () => {
      const doc = 42
      const state = createState(doc)

      const expandedState = expandSinglePath(doc, state, [])
      assert.deepStrictEqual(expandedState, state)

      const collapsedState = collapseSinglePath(doc, state, [])
      assert.deepStrictEqual(collapsedState, state)
    })
  })

  describe ('documentStatePatch', () => {
    it ('add: should add a value to an object', () => {
      const doc = { a: 2, b: 3 }
      const state = createState(doc)

      const updatedState = documentStatePatch(state, [
        { op: 'add', 'path': '/c', value: 4 }
      ])

      assert.deepStrictEqual(updatedState[STATE_EXPANDED], false)
      assert.deepStrictEqual(updatedState[STATE_KEYS], ['a', 'b', 'c'])
      assert(isObject(updatedState['c']))
      assert.strictEqual(typeof updatedState['c'][STATE_ID], 'string')
    })

    it ('add: should add a value to an object (expanded)', () => {
      const doc = { a: 2, b: 3 }
      const state = expandSinglePath(doc, createState(doc), [])

      const updatedState = documentStatePatch(state, [
        { op: 'add', 'path': '/c', value: 4 }
      ])

      assert.deepStrictEqual(updatedState[STATE_EXPANDED], true)
      assert.deepStrictEqual(updatedState[STATE_KEYS], ['a', 'b', 'c'])
      assert(isObject(updatedState['c']))
      assert.strictEqual(typeof updatedState['c'][STATE_ID], 'string')
    })

    it ('add: should override a value in an object', () => {
      // TODO
    })

    it ('add: should insert a value in an array', () => {
      // TODO
    })

    it ('add: should append a value to an array', () => {
      // TODO
    })

    it ('remove: should remove a value from an object', () => {
      // TODO
    })

    it ('remove: should remove a value from an array', () => {
      // TODO
    })

    it ('replace: should replace a value in an object', () => {
      // TODO
    })

    it ('replace: should replace a value in an array', () => {
      // TODO
    })

    it ('replace: should the root document itself', () => {
      // TODO
    })

    it ('copy: should copy a value into an object', () => {
      // TODO
    })

    it ('copy: should copy a value into an array', () => {
      // TODO
    })

    it ('move: should move a value from object to object', () => {
      // TODO
    })

    it ('move: should move and replace a value into an object', () => {
      // TODO
    })

    it ('move: should move a value from array to array', () => {
      // TODO
    })

    it ('move: should move a value from object to array', () => {
      // TODO
    })

    it ('move: should move a value from array to object', () => {
      // TODO
    })
  })

  // TODO: write more unit tests
})

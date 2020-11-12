import assert from 'assert'
import { syncState } from './documentState.js'
import {
  expandSelection,
  findRootPath,
  getInitialSelection,
  getParentPath,
  getSelectionLeft,
  getSelectionRight
} from './selection.js'

describe('selection', () => {
  const doc = {
    obj: {
      arr: [1, 2, { first: 3, last: 4 }]
    },
    str: 'hello world',
    nill: null,
    bool: false
  }
  const state = syncState(doc, undefined, [], () => true)

  it('should expand a selection (object)', () => {
    const start = ['obj', 'arr', '2', 'last']
    const end = ['nill']

    const actual = expandSelection(doc, state, start, end)
    assert.deepStrictEqual(actual, [
      ['obj'],
      ['str'],
      ['nill']
    ])
  })

  it('should expand a selection (array)', () => {
    const start = ['obj', 'arr', 1]
    const end = ['obj', 'arr', 0] // note the "wrong" order of start and end

    const actual = expandSelection(doc, state, start, end)
    assert.deepStrictEqual(actual, [
      ['obj', 'arr', 0],
      ['obj', 'arr', 1]
    ])
  })

  it('should expand a selection (array) (2)', () => {
    const start = ['obj', 'arr', 1] // child
    const end = ['obj', 'arr'] // parent

    const actual = expandSelection(doc, state, start, end)
    assert.deepStrictEqual(actual, [
      ['obj', 'arr']
    ])
  })

  it('should expand a selection (value)', () => {
    const start = ['obj', 'arr', 2, 'first']
    const end = ['obj', 'arr', 2, 'first']

    const actual = expandSelection(doc, state, start, end)
    assert.deepStrictEqual(actual, [
      ['obj', 'arr', 2, 'first']
    ])
  })

  it('should expand a selection (value)', () => {
    const start = ['obj', 'arr']
    const end = ['obj', 'arr']

    const actual = expandSelection(doc, state, start, end)
    assert.deepStrictEqual(actual, [
      ['obj', 'arr']
    ])
  })

  it('should get parent path from a selection', () => {
    assert.deepStrictEqual(getParentPath({ beforePath: ['a', 'b'] }), ['a'])
    assert.deepStrictEqual(getParentPath({ appendPath: ['a', 'b'] }), ['a', 'b'])
    assert.deepStrictEqual(getParentPath({
      paths: [
        ['a', 'b'],
        ['a', 'c'],
        ['a', 'd']
      ]
    }), ['a'])
  })

  it('should find the root path from a selection', () => {
    assert.deepStrictEqual(findRootPath({
      paths: [
        ['a', 'b'],
        ['a', 'c'],
        ['a', 'd']
      ]
    }), ['a'])
    assert.deepStrictEqual(findRootPath({ beforePath: ['a', 'b'] }), [])
    assert.deepStrictEqual(findRootPath({ appendPath: ['a', 'b'] }), [])
    assert.deepStrictEqual(findRootPath(), [])
  })

  describe('navigate', () => {
    it ('should move selection left', () => {
      assert.deepStrictEqual({ keyPath: ['path'] }, getSelectionLeft({ valuePath: ['path'] }))

      assert.deepStrictEqual(null, getSelectionLeft({ keyPath: ['path'] }))
      assert.deepStrictEqual(null, getSelectionLeft({ beforePath: ['path'] }))
      assert.deepStrictEqual(null, getSelectionLeft({ appendPath: ['path'] }))

      assert.deepStrictEqual({ keyPath: ['path'] },
        getSelectionLeft({ paths: [['path']], pathsMap: { '/path': true } }))

      assert.deepStrictEqual(null,
        getSelectionLeft({ paths: [['path1'], ['path2']], pathsMap: { '/path1': true, '/path2': true } }))
    })

    it ('should move selection right', () => {
      assert.deepStrictEqual({ valuePath: ['path'] }, getSelectionRight({ keyPath: ['path'] }))

      assert.deepStrictEqual(null, getSelectionRight({ valuePath: ['path'] }))
      assert.deepStrictEqual(null, getSelectionRight({ beforePath: ['path'] }))
      assert.deepStrictEqual(null, getSelectionRight({ appendPath: ['path'] }))

      assert.deepStrictEqual({ valuePath: ['path'] },
        getSelectionRight({ paths: [['path']], pathsMap: { '/path': true } }))
      assert.deepStrictEqual(null,
        getSelectionRight({ paths: [['path1'], ['path2']], pathsMap: { '/path1': true, '/path2': true } }))
    })
  })

  it('getInitialSelection', () => {
    function getInitialSelectionWithState(doc) {
      const state = syncState(doc, undefined, [], path => path.length <= 1)
      return getInitialSelection(doc, state)
    }

    assert.deepStrictEqual(getInitialSelectionWithState({}), { valuePath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState([]), { valuePath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState('test'), { valuePath: [] })

    assert.deepStrictEqual(getInitialSelectionWithState({a: 2, b: 3}), { keyPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState({a: {}}), { keyPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState([2,3,4]), { valuePath: [0] })
  })
})

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
    const path = ['a', 'b']

    assert.deepStrictEqual(getParentPath({ beforePath: path, anchorPath: path, focusPath: path }), ['a'])
    assert.deepStrictEqual(getParentPath({ appendPath: path, anchorPath: path, focusPath: path }), ['a', 'b'])
    assert.deepStrictEqual(getParentPath({
      anchorPath: ['a', 'b'],
      focusPath: ['a', 'd'],
      paths: [
        ['a', 'b'],
        ['a', 'c'],
        ['a', 'd']
      ],
      pathsMap: {
        '/a/b': true,
        '/a/c': true,
        '/a/d': true
      }
    }), ['a'])
  })

  it('should find the root path from a selection', () => {
    assert.deepStrictEqual(findRootPath({
      anchorPath: ['a', 'b'],
      focusPath: ['a', 'd'],
      paths: [
        ['a', 'b'],
        ['a', 'c'],
        ['a', 'd']
      ],
      pathsMap: {
        '/a/b': true,
        '/a/c': true,
        '/a/d': true
      }
    }), ['a'])

    const path = ['a', 'b']
    assert.deepStrictEqual(findRootPath({ beforePath: path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ appendPath: path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ keyPath: path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ valuePath: path, anchorPath: path, focusPath: path }), path)
  })

  describe('navigate', () => {
    it ('should move selection left', () => {
      const expected = { keyPath: ['path'], anchorPath: ['path'], focusPath: ['path'] }

      assert.deepStrictEqual(getSelectionLeft({ valuePath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionLeft({ keyPath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionLeft({ beforePath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionLeft({ appendPath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)

      assert.deepStrictEqual(getSelectionLeft({
          paths: [['path1'], ['path2']],
          anchorPath: ['path1'],
          focusPath: ['path2'],
          pathsMap: { '/path1': true, '/path2': true }
        }), { keyPath: ['path2'], anchorPath: ['path2'], focusPath: ['path2'] })
    })

    it ('should move selection right', () => {
      const expected = { valuePath: ['path'], anchorPath: ['path'], focusPath: ['path'] }

      assert.deepStrictEqual(getSelectionRight({ keyPath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionRight({ valuePath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionRight({ beforePath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)
      assert.deepStrictEqual(getSelectionRight({ appendPath: ['path'], anchorPath: ['path'], focusPath: ['path'] }), expected)

      assert.deepStrictEqual(getSelectionRight({
        paths: [['path1'], ['path2']],
        anchorPath: ['path1'],
        focusPath: ['path2'],
        pathsMap: { '/path1': true, '/path2': true }
      }), { valuePath: ['path2'], anchorPath: ['path2'], focusPath: ['path2'] })
    })
  })

  it('getInitialSelection', () => {
    function getInitialSelectionWithState(doc) {
      const state = syncState(doc, undefined, [], path => path.length <= 1)
      return getInitialSelection(doc, state)
    }

    assert.deepStrictEqual(getInitialSelectionWithState({}), { valuePath: [], anchorPath: [], focusPath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState([]), { valuePath: [], anchorPath: [], focusPath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState('test'), { valuePath: [], anchorPath: [], focusPath: [] })

    assert.deepStrictEqual(getInitialSelectionWithState({a: 2, b: 3}), { keyPath: ['a'], anchorPath: ['a'], focusPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState({a: {}}), { keyPath: ['a'], anchorPath: ['a'], focusPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState([2,3,4]), { valuePath: [0], anchorPath: [0], focusPath: [0] })
  })
})

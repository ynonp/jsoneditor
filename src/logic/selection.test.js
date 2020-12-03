import assert from 'assert'
import { syncState } from './documentState.js'
import {
  createSelection,
  expandSelection,
  findRootPath,
  getInitialSelection,
  getParentPath,
  getSelectionLeft,
  getSelectionRight,
  SELECTION_TYPE,
  selectionToPartialJson
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

    assert.deepStrictEqual(getParentPath({ type: SELECTION_TYPE.AFTER, path, anchorPath: path, focusPath: path }), ['a'])
    assert.deepStrictEqual(getParentPath({ type: SELECTION_TYPE.INSIDE, path, anchorPath: path, focusPath: path }), ['a', 'b'])
    assert.deepStrictEqual(getParentPath({
      type: SELECTION_TYPE.MULTI,
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
      type: SELECTION_TYPE.MULTI,
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
    assert.deepStrictEqual(findRootPath({ type: SELECTION_TYPE.AFTER, path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ type: SELECTION_TYPE.INSIDE, path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ type: SELECTION_TYPE.KEY, path, anchorPath: path, focusPath: path }), path)
    assert.deepStrictEqual(findRootPath({ type: SELECTION_TYPE.VALUE, path, anchorPath: path, focusPath: path }), path)
  })

  describe('navigate', () => {
    const doc = {
      path: true,
      path1: true,
      path2: true
    }
    const state = syncState(doc, undefined, [], () => true)

    it('should move selection left', () => {
      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.VALUE,
        anchorPath: ['path'],
        focusPath: ['path']
      }), {
        type: SELECTION_TYPE.KEY,
        anchorPath: ['path'],
        focusPath: ['path'],
        edit: false
      })

      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.KEY,
        anchorPath: ['path1'],
        focusPath: ['path1']
      }), {
        type: SELECTION_TYPE.AFTER,
        anchorPath: ['path'],
        focusPath: ['path']
      })

      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.AFTER,
        anchorPath: ['path'],
        focusPath: ['path']
      }), {
        type: SELECTION_TYPE.VALUE,
        anchorPath: ['path'],
        focusPath: ['path'],
        edit: false
      })

      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.INSIDE,
        anchorPath: [],
        focusPath: []
      }), {
        type: SELECTION_TYPE.VALUE,
        anchorPath: [],
        focusPath: [],
        edit: false
      })

      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.MULTI,
        anchorPath: ['path1'],
        focusPath: ['path2'],
        paths: [['path1'], ['path2']],
        pathsMap: { '/path1': true, '/path2': true }
      }), {
        type: SELECTION_TYPE.KEY,
        anchorPath: ['path2'],
        focusPath: ['path2'],
        edit: false
      })
    })

    it('should selection array item as a whole when moving left', () => {
      const doc = [1, 2, 3]
      const state = syncState(doc, undefined, [], () => false)

      assert.deepStrictEqual(getSelectionLeft(doc, state, {
        type: SELECTION_TYPE.VALUE,
        anchorPath: [1],
        focusPath: [1]
      }), {
        anchorPath: [1],
        focusPath: [1],
        paths: [
          [1]
        ],
        pathsMap: {
          '/1': true
        },
        type: 'multi'
      })
    })

    it('should move selection left and keep anchor path', () => {
      const keepAnchorPath = true
      assert.deepStrictEqual(getSelectionLeft(doc, state, { type: SELECTION_TYPE.VALUE, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }, keepAnchorPath), {
        type: SELECTION_TYPE.MULTI,
        anchorPath: ['path'],
        focusPath: ['path'],
        paths: [
          ['path']
        ],
        pathsMap: {
          '/path': true
        }
      })
    })

    it('should move selection right', () => {
      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.KEY, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }), {
        type: SELECTION_TYPE.VALUE,
        anchorPath: ['path'],
        focusPath: ['path'],
        edit: false
      })

      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.VALUE, path: [], anchorPath: [], focusPath: [] }), {
        type: SELECTION_TYPE.INSIDE,
        anchorPath: [],
        focusPath: []
      })

      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.VALUE, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }), {
        type: SELECTION_TYPE.AFTER,
        anchorPath: ['path'],
        focusPath: ['path']
      })

      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.AFTER, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }), {
        type: SELECTION_TYPE.KEY,
        anchorPath: ['path1'],
        focusPath: ['path1'],
        edit: false
      })

      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.INSIDE, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }), null)

      assert.deepStrictEqual(getSelectionRight(doc, state, {
        type: SELECTION_TYPE.MULTI,
        anchorPath: ['path1'],
        focusPath: ['path2'],
        paths: [['path1'], ['path2']],
        pathsMap: { '/path1': true, '/path2': true }
      }), {
        type: SELECTION_TYPE.VALUE,
        anchorPath: ['path2'],
        focusPath: ['path2'],
        edit: false
      })
    })

    it('should move selection right and keep anchor path', () => {
      const keepAnchorPath = true
      assert.deepStrictEqual(getSelectionRight(doc, state, { type: SELECTION_TYPE.KEY, path: ['path'], anchorPath: ['path'], focusPath: ['path'] }, keepAnchorPath), {
        type: SELECTION_TYPE.MULTI,
        anchorPath: ['path'],
        focusPath: ['path'],
        paths: [
          ['path']
        ],
        pathsMap: {
          '/path': true
        }
      })
    })

    // TODO: test nested, expanded objects -> should move to append to next object
  })

  it('getInitialSelection', () => {
    function getInitialSelectionWithState (doc) {
      const state = syncState(doc, undefined, [], path => path.length <= 1)
      return getInitialSelection(doc, state)
    }

    assert.deepStrictEqual(getInitialSelectionWithState({}), { type: SELECTION_TYPE.VALUE, anchorPath: [], focusPath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState([]), { type: SELECTION_TYPE.VALUE, anchorPath: [], focusPath: [] })
    assert.deepStrictEqual(getInitialSelectionWithState('test'), { type: SELECTION_TYPE.VALUE, anchorPath: [], focusPath: [] })

    assert.deepStrictEqual(getInitialSelectionWithState({ a: 2, b: 3 }), { type: SELECTION_TYPE.KEY, anchorPath: ['a'], focusPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState({ a: {} }), { type: SELECTION_TYPE.KEY, anchorPath: ['a'], focusPath: ['a'] })
    assert.deepStrictEqual(getInitialSelectionWithState([2, 3, 4]), { type: SELECTION_TYPE.VALUE, anchorPath: [0], focusPath: [0] })
  })

  it('should turn selection into text', () => {
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.KEY, path: ['str'] })), '"str"')
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.VALUE, path: ['str'] })), '"hello world"')
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.AFTER, path: ['str'] })), null)
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.INSIDE, path: ['str'] })), null)

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { anchorPath: ['str'], focusPath: ['bool'] })),
      '"str": "hello world",\n' +
      '"nill": null,\n' +
      '"bool": false,'
    )

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { anchorPath: ['obj', 'arr', 0], focusPath: ['obj', 'arr', 1] })),
      '1,\n' +
      '2,'
    )
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { anchorPath: ['obj', 'arr', 0], focusPath: ['obj', 'arr', 0] })), '1')

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.VALUE, path: ['obj'] })), JSON.stringify(doc.obj, null, 2))

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, {
      anchorPath: ['obj'],
      focusPath: ['obj']
    })), '"obj": ' + JSON.stringify(doc.obj, null, 2) + ',')
  })

  it('should turn selection into text with specified indentation', () => {
    const indentation = 4
    const objArr2 = '{\n' +
      '    "first": 3,\n' +
      '    "last": 4\n' +
      '}'

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, { type: SELECTION_TYPE.VALUE, path: ['obj', 'arr', 2] }), indentation), objArr2)
    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, {
      anchorPath: ['obj', 'arr', 1],
      focusPath: ['obj', 'arr', 2]
    }), indentation), `2,\n${objArr2},`)

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, {
      anchorPath: ['obj'],
      focusPath: ['obj']
    })), '"obj": ' + JSON.stringify(doc.obj, null, 2) + ',')

    assert.deepStrictEqual(selectionToPartialJson(doc, createSelection(doc, state, {
      anchorPath: ['obj'],
      focusPath: ['obj']
    }), indentation), '"obj": ' + JSON.stringify(doc.obj, null, indentation) + ',')
  })
})

import assert from 'assert'
import { expandSelection, getParentPath, findRootPath } from './selection.js'
import { syncState } from './documentState.js'

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
})

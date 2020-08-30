import assert from 'assert'
import { sortArray, sortObjectKeys, getSortingMoves } from './sort.js'

describe('sort', () => {
  it('should sort object keys', () => {
    const object = { b: 1, c: 1, a: 1 }

    assert.deepStrictEqual(sortObjectKeys(object), [
      { op: 'move', from: '/a', path: '/a' },
      { op: 'move', from: '/b', path: '/b' },
      { op: 'move', from: '/c', path: '/c' }
    ])

    assert.deepStrictEqual(sortObjectKeys(object, undefined, 1), [
      { op: 'move', from: '/a', path: '/a' },
      { op: 'move', from: '/b', path: '/b' },
      { op: 'move', from: '/c', path: '/c' }
    ])

    assert.deepStrictEqual(sortObjectKeys(object, undefined, -1), [
      { op: 'move', from: '/c', path: '/c' },
      { op: 'move', from: '/b', path: '/b' },
      { op: 'move', from: '/a', path: '/a' }
    ])
  })

  it('should sort object keys using a rootPath', () => {
    const object = { b: 1, c: 1, a: 1 }

    assert.deepStrictEqual(sortObjectKeys(object, ['root', 'path']), [
      { op: 'move', from: '/root/path/a', path: '/root/path/a' },
      { op: 'move', from: '/root/path/b', path: '/root/path/b' },
      { op: 'move', from: '/root/path/c', path: '/root/path/c' }
    ])
  })

  it('should sort object keys case insensitive', () => {
    const object = { B: 1, a: 1 }

    assert.deepStrictEqual(sortObjectKeys(object), [
      { op: 'move', from: '/a', path: '/a' },
      { op: 'move', from: '/B', path: '/B' }
    ])
  })

  it('should sort array', () => {
    assert.deepStrictEqual(sortArray([2, 3, 1]), [
      { op: 'move', from: '/2', path: '/0' }
    ])
    assert.deepStrictEqual(sortArray([2, 3, 1], undefined, undefined, -1), [
      { op: 'move', from: '/1', path: '/0' }
    ])
  })

  it('should sort array using natural sort', () => {
    assert.deepStrictEqual(sortArray(['10', '2', '1']), [
      { op: 'move', from: '/1', path: '/0' },
      { op: 'move', from: '/2', path: '/0' }
    ])
  })

  it('should sort array case insensitive', () => {
    assert.deepStrictEqual(sortArray(['B', 'a']), [
      { op: 'move', from: '/1', path: '/0' }
    ])
  })

  it('should sort array using a rootPath', () => {
    assert.deepStrictEqual(sortArray([2, 3, 1], ['root', 'path']), [
      { op: 'move', from: '/root/path/2', path: '/root/path/0' }
    ])
  })

  it('should sort array by nested properties and custom direction', () => {
    const a = { data: { value: 1 } }
    const b = { data: { value: 2 } }
    const c = { data: { value: 3 } }

    assert.deepStrictEqual(sortArray([b, a, c], undefined, ['data', 'value']), [
      { op: 'move', from: '/1', path: '/0' }
    ])
    assert.deepStrictEqual(sortArray([b, a, c], undefined, ['data', 'value'], 1), [
      { op: 'move', from: '/1', path: '/0' }
    ])
    assert.deepStrictEqual(sortArray([b, a, c], undefined, ['data', 'value'], -1), [
      { op: 'move', from: '/2', path: '/0' }
    ])
  })

  it('should give the move operations needed to sort given array', () => {
    const comparator = (a, b) => a - b

    assert.deepStrictEqual(getSortingMoves([1, 2, 3], comparator), [])

    assert.deepStrictEqual(getSortingMoves([2, 3, 1], comparator), [
      { fromIndex: 2, toIndex: 0 }
    ])

    assert.deepStrictEqual(getSortingMoves([2, 1, 3], comparator), [
      { fromIndex: 1, toIndex: 0 }
    ])

    assert.deepStrictEqual(getSortingMoves([1, 3, 2], comparator), [
      { fromIndex: 2, toIndex: 1 }
    ])

    assert.deepStrictEqual(getSortingMoves([3, 2, 1], comparator), [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 2, toIndex: 0 }
    ])

    assert.deepStrictEqual(getSortingMoves([3, 1, 2], comparator), [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 2, toIndex: 1 }
    ])
  })

  it('should give the move operations needed to sort given array containing objects', () => {
    const comparator = (a, b) => a.id - b.id

    const actual = getSortingMoves([{ id: 4 }, { id: 3 }, { id: 1 }, { id: 2 }], comparator)

    const expected = [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 2, toIndex: 0 },
      { fromIndex: 3, toIndex: 1 }
    ]

    assert.deepStrictEqual(actual, expected)
  })
})

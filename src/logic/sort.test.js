import assert from 'assert'
import { sortArray, sortObjectKeys, sortMoveOperations } from './sort.js'

describe.only('sort', () => {

  it('should sort array', () => {
    assert.deepStrictEqual(sortArray([ 2, 3, 1 ]), [1, 2, 3])
    assert.deepStrictEqual(sortArray([ 2, 3, 1 ], undefined, -1), [3, 2, 1])
  })
  
  it('should sort array using natural sort', () => {
    assert.deepStrictEqual(sortArray([ '10', '2', '1' ]), ['1', '2', '10'])
  })

  it('should sort array by nested properties', () => {
    const a = {data: { value: 1 }}
    const b = {data: { value: 2 }}
    const c = {data: { value: 3 }}

    assert.deepStrictEqual(sortArray([ b, c, a ], ['data', 'value']), [a, b, c])
    assert.deepStrictEqual(sortArray([ b, a, c ], ['data', 'value']), [a, b, c])
    assert.deepStrictEqual(sortArray([ b, a, c ], ['data', 'value'], 1), [a, b, c])
    assert.deepStrictEqual(sortArray([ b, a, c ], ['data', 'value'], -1), [c, b, a])
  })
  
  it('should sort object keys', () => {
    const object = { b: 1, c: 1, a: 1 }

    assert.deepStrictEqual(Object.keys(sortObjectKeys(object)), ['a', 'b', 'c'])
    assert.deepStrictEqual(Object.keys(sortObjectKeys(object, 1)), ['a', 'b', 'c'])
    assert.deepStrictEqual(Object.keys(sortObjectKeys(object, -1)), ['c', 'b', 'a'])
  })

  it('should give the move operations needed to sort given array', () => {
    const comparator = (a, b) => a - b

    assert.deepStrictEqual(sortMoveOperations([ 1, 2, 3 ], comparator), [])

    assert.deepStrictEqual(sortMoveOperations([ 2, 3, 1 ], comparator), [
      { fromIndex: 2, toIndex: 0 }
    ])

    assert.deepStrictEqual(sortMoveOperations([ 2, 1, 3 ], comparator), [
      { fromIndex: 1, toIndex: 0 }
    ])

    assert.deepStrictEqual(sortMoveOperations([ 1, 3, 2 ], comparator), [
      { fromIndex: 2, toIndex: 1 }
    ])

    assert.deepStrictEqual(sortMoveOperations([ 3, 2, 1 ], comparator), [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 2, toIndex: 0 }
    ])

    assert.deepStrictEqual(sortMoveOperations([ 3, 1, 2 ], comparator), [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 2, toIndex: 1 }
    ])
  })
})

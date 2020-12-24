import assert from 'assert'
import { immutableJSONPatch } from 'immutable-json-patch'
import { sortBy, times } from 'lodash-es'
import {
  sortArray,
  sortObjectKeys,
  sortOperationsMove,
  sortOperationsMoveAdvanced
} from './sort.js'

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

  it('should generate the move operations needed to sort given array', () => {
    const comparator = (a, b) => a - b

    assert.deepStrictEqual(sortOperationsMove([1, 2, 3], comparator), [])

    assert.deepStrictEqual(sortOperationsMove([2, 3, 1], comparator), [
      { op: 'move', from: '/2', path: '/0' }
    ])

    assert.deepStrictEqual(sortOperationsMove([2, 1, 3], comparator), [
      { op: 'move', from: '/1', path: '/0' }
    ])

    assert.deepStrictEqual(sortOperationsMove([1, 3, 2], comparator), [
      { op: 'move', from: '/2', path: '/1' }
    ])

    assert.deepStrictEqual(sortOperationsMove([3, 2, 1], comparator), [
      { op: 'move', from: '/1', path: '/0' },
      { op: 'move', from: '/2', path: '/0' }
    ])

    // Note: more efficient would be to { fromIndex: 0, toIndex: 2 }
    assert.deepStrictEqual(sortOperationsMove([3, 1, 2], comparator), [
      { op: 'move', from: '/1', path: '/0' },
      { op: 'move', from: '/2', path: '/1' }
    ])

    // just double check that the move operations indeed sort the contents
    const array = [0, 1, 3, 5, 4, 2]
    const operations = sortOperationsMove(array, comparator)
    assert.deepStrictEqual(immutableJSONPatch(array, operations), [0, 1, 2, 3, 4, 5])
  })

  it('should generate the move operations to sort given array (2)', () => {
    const comparator = (a, b) => a - b

    assert.deepStrictEqual(sortOperationsMoveAdvanced([1, 2, 3, 6, 4, 5], comparator), [
      { op: 'move', from: '/3', path: '/5' }
    ])

    assert.deepStrictEqual(sortOperationsMoveAdvanced([2, 3, 4, 1, 5, 6], comparator), [
      { op: 'move', from: '/3', path: '/0' }
    ])

    {
      const array = [3, 1, 2, 5, 4, 6]
      const operations = sortOperationsMoveAdvanced(array, comparator)
      assert.deepStrictEqual(immutableJSONPatch(array, operations), sortBy(array))
      assert.deepStrictEqual(operations, [
        { op: 'move', from: '/0', path: '/3' },
        { op: 'move', from: '/2', path: '/4' }
      ])
    }

    {
      const array = [0, 1, 3, 5, 4, 2]
      const operations = sortOperationsMoveAdvanced(array, comparator)
      assert.deepStrictEqual(immutableJSONPatch(array, operations), sortBy(array))
      assert.deepStrictEqual(operations, [
        { op: 'move', from: '/5', path: '/2' },
        { op: 'move', from: '/4', path: '/5' }
      ])
    }
  })

  // TODO: move this into a benchmark file
  // TODO: also compare size of patch (KB)
  // TODO: also compare with simply replacing the whole array
  it.skip('should generate the move operations to sort given array for a large array', () => {
    const comparator = (a, b) => a - b

    function benchmark (size, changes) {
      const array = generateArray(size, changes)

      const [operationsSimple, sortDurationSimple] = measure(() => sortOperationsMove(array, comparator))
      const [operationsAdvanced, sortDurationAdvanced] = measure(() => sortOperationsMoveAdvanced(array, comparator))

      const [sortedSimple, applyDurationSimple] = measure(() => immutableJSONPatch(array, operationsSimple))
      const [sortedAdvanced, applyDurationAdvanced] = measure(() => immutableJSONPatch(array, operationsAdvanced))

      // validate the results
      const sorted = sortBy(array)
      assert.deepStrictEqual(sortedSimple, sorted)
      assert.deepStrictEqual(sortedAdvanced, sortBy(array))

      return {
        size,
        changes,
        operationsSimple: operationsSimple.length,
        operationsAdvanced: operationsAdvanced.length,
        sortDurationSimple: sortDurationSimple + ' ms',
        sortDurationAdvanced: sortDurationAdvanced + ' ms',
        applyDurationSimple: applyDurationSimple + ' ms',
        applyDurationAdvanced: applyDurationAdvanced + ' ms'
      }
    }

    const results = [
      benchmark(100, 5),
      benchmark(100, 25),
      benchmark(1000, 5),
      benchmark(1000, 100),
      benchmark(1000, 1000),
      benchmark(10000, 100),
      benchmark(10000, 1000)
    ]

    console.table(results)
  })

  it('should give the move operations needed to sort given array containing objects', () => {
    const comparator = (a, b) => a.id - b.id

    const actual = sortOperationsMove([{ id: 4 }, { id: 3 }, { id: 1 }, { id: 2 }], comparator)

    const expected = [
      { op: 'move', from: '/1', path: '/0' },
      { op: 'move', from: '/2', path: '/0' },
      { op: 'move', from: '/3', path: '/1' }
    ]

    assert.deepStrictEqual(actual, expected)
  })

  it('should give the move operations needed to sort given array containing objects (advanced)', () => {
    const comparator = (a, b) => a.id - b.id

    const actual = sortOperationsMoveAdvanced([{ id: 4 }, { id: 3 }, { id: 1 }, { id: 2 }], comparator)

    const expected = [
      { op: 'move', from: '/1', path: '/3' },
      { op: 'move', from: '/0', path: '/3' }
    ]

    assert.deepStrictEqual(actual, expected)
  })
})

function generateArray (size, changes) {
  const array = times(size).map((item, index) => index)

  for (let i = 0; i < changes; i++) {
    const fromIndex = Math.floor(Math.random() * size)
    const toIndex = Math.floor(Math.random() * size)

    const value = array.splice(fromIndex, 1)[0]
    array.splice(toIndex, 0, value)
  }

  return array
}

function measure (callback) {
  const start = Date.now()
  const result = callback()
  const end = Date.now()
  const duration = end - start

  return [result, duration]
}

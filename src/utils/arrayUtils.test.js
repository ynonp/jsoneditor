import assert from "assert"
import { compareArrays } from './arrayUtils.js'

describe('arrayUtils', () => {
  it('compareArrays', () => {
    assert.strictEqual(compareArrays([], []), 0)
    assert.strictEqual(compareArrays(['a'], ['a']), 0)
    assert.strictEqual(compareArrays(['a'], ['b']), -1)
    assert.strictEqual(compareArrays(['b'], ['a']), 1)
    assert.strictEqual(compareArrays(['a'], ['a', 'b']), -1)
    assert.strictEqual(compareArrays(['a', 'b'], ['a']), 1)
    assert.strictEqual(compareArrays(['a', 'b'], ['a', 'b']), 0)

    const arrays = [
      ['b', 'a'],
      ['a'],
      [],
      ['b', 'c'],
      ['b'],
    ]

    assert.deepStrictEqual(arrays.sort(compareArrays), [
      [],
      ['a'],
      ['b'],
      ['b', 'a'],
      ['b', 'c']
    ])
  })
})

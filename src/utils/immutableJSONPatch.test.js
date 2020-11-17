import assert from 'assert'
import {
  immutableJSONPatch,
  immutableJSONPatchWithRevert
} from './immutableJSONPatch.js'

describe('immutableJSONPatch', () => {
  it('test strictEqual, notStrictEqual, deepStrictEqual', () => {
    const a = { x: 2 }
    const b = { x: 2 }

    // just to be sure the equality functions do what I think they do...
    assert.strictEqual(a, a)
    assert.notStrictEqual(b, a)
    assert.deepStrictEqual(b, a)
  })

  it('jsonpatch add', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 2 }
    }

    const patch = [
      { op: 'add', path: '/obj/b', value: { foo: 'bar' } }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 2, 3],
      obj: { a: 2, b: { foo: 'bar' } }
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'remove', path: '/obj/b' }
    ])
    assert.strictEqual(result.json.arr, json.arr)
  })

  it('jsonpatch add: insert in matrix', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 2 }
    }

    const patch = [
      { op: 'add', path: '/arr/1', value: 4 }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 4, 2, 3],
      obj: { a: 2 }
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'remove', path: '/arr/1' }
    ])
    assert.strictEqual(result.json.obj, json.obj)
  })

  it('jsonpatch add: append to matrix', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 2 }
    }

    const patch = [
      { op: 'add', path: '/arr/-', value: 4 }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 2, 3, 4],
      obj: { a: 2 }
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'remove', path: '/arr/3' }
    ])
    assert.strictEqual(result.json.obj, json.obj)
  })

  it('jsonpatch remove', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 },
      unchanged: {}
    }

    const patch = [
      { op: 'remove', path: '/obj/a' },
      { op: 'remove', path: '/arr/1' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 3],
      obj: {},
      unchanged: {}
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'add', path: '/arr/1', value: 2 },
      { op: 'add', path: '/obj/a', value: 4 }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, patch)
    assert.strictEqual(result.json.unchanged, json.unchanged)
  })

  it('jsonpatch replace', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 },
      unchanged: {}
    }

    const patch = [
      { op: 'replace', path: '/obj/a', value: 400 },
      { op: 'replace', path: '/arr/1', value: 200 }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 200, 3],
      obj: { a: 400 },
      unchanged: {}
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'replace', path: '/arr/1', value: 2 },
      { op: 'replace', path: '/obj/a', value: 4 }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, [
      { op: 'replace', path: '/obj/a', value: 400 },
      { op: 'replace', path: '/arr/1', value: 200 }
    ])
    assert.strictEqual(result.json.unchanged, json.unchanged)
  })

  it('jsonpatch replace root document', () => {
    const json = {
      a: 2
    }
    const patch = [
      { op: 'replace', path: '', value: { b: 3 } }
    ]
    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, { b: 3 })
  })

  it('jsonpatch copy', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 }
    }

    const patch = [
      { op: 'copy', from: '/obj', path: '/arr/2' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 2, { a: 4 }, 3],
      obj: { a: 4 }
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'remove', path: '/arr/2' }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, [
      { op: 'add', path: '/arr/2', value: { a: 4 } }
    ])
    assert.strictEqual(result.json.obj, json.obj)
    assert.strictEqual(result.json.arr[2], json.obj)
  })

  it('jsonpatch move', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 },
      unchanged: {}
    }

    const patch = [
      { op: 'move', from: '/obj', path: '/arr/2' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 2, { a: 4 }, 3],
      unchanged: {}
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'move', from: '/arr/2', path: '/obj' }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, patch)
    assert.strictEqual(result.json.arr[2], json.obj)
    assert.strictEqual(result.json.unchanged, json.unchanged)
  })

  it('jsonpatch move and replace', () => {
    const json = { a: 2, b: 3 }

    const patch = [
      { op: 'move', from: '/a', path: '/b' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, { b: 2 })
    assert.deepStrictEqual(result.revert, [
      { op: 'move', from: '/b', path: '/a' },
      { op: 'add', path: '/b', value: 3 }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, [
      { op: 'remove', path: '/b' },
      { op: 'move', from: '/a', path: '/b' }
    ])
  })

  it('jsonpatch move and replace (nested)', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 },
      unchanged: {}
    }

    const patch = [
      { op: 'move', from: '/obj', path: '/arr' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: { a: 4 },
      unchanged: {}
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'move', from: '/arr', path: '/obj' },
      { op: 'add', path: '/arr', value: [1, 2, 3] }
    ])

    // test revert
    const result2 = immutableJSONPatchWithRevert(result.json, result.revert)

    assert.deepStrictEqual(result2.json, json)
    assert.deepStrictEqual(result2.revert, [
      { op: 'remove', path: '/arr' },
      { op: 'move', from: '/obj', path: '/arr' }
    ])
    assert.strictEqual(result.json.unchanged, json.unchanged)
    assert.strictEqual(result2.json.unchanged, json.unchanged)
  })

  it('jsonpatch test (ok)', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 }
    }

    const patch = [
      { op: 'test', path: '/arr', value: [1, 2, 3] },
      { op: 'add', path: '/added', value: 'ok' }
    ]

    const result = immutableJSONPatchWithRevert(json, patch)
    assert.deepStrictEqual(immutableJSONPatch(json, patch), result.json)

    assert.deepStrictEqual(result.json, {
      arr: [1, 2, 3],
      obj: { a: 4 },
      added: 'ok'
    })
    assert.deepStrictEqual(result.revert, [
      { op: 'remove', path: '/added' }
    ])
  })

  it('jsonpatch test (fail: path not found)', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 }
    }

    const patch = [
      { op: 'test', path: '/arr/5', value: [1, 2, 3] },
      { op: 'add', path: '/added', value: 'ok' }
    ]

    assert.throws(() => immutableJSONPatchWithRevert(json, patch),
      new Error('Test failed: path not found (path: "/arr/5")'))
    assert.throws(() => immutableJSONPatch(json, patch),
      new Error('Test failed: path not found (path: "/arr/5")'))
  })

  it('jsonpatch test (fail: value not equal)', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 }
    }

    const patch = [
      { op: 'test', path: '/obj', value: { a: 4, b: 6 } },
      { op: 'add', path: '/added', value: 'ok' }
    ]

    assert.throws(() => immutableJSONPatchWithRevert(json, patch),
      new Error('Test failed, value differs (path: "/obj")'))
    assert.throws(() => immutableJSONPatch(json, patch),
      new Error('Test failed, value differs (path: "/obj")'))
  })

  // TODO
  it.skip('should apply options', () => {
    const json = {
      arr: [1,2,3],
      obj: {a : 2}
    }

    const patch = [
      {op: 'add', path: '/obj/a', value: 4 }
    ]
    const result = immutableJSONPatch(json, patch, {
      fromJSON: function (value, previousObject) {
        return { value, previousObject }
      },
      toJSON: value => value
    })
    assert.deepStrictEqual(result.json, {
      arr: [1,2,3],
      obj: {a : { value: 4, previousObject: 2 }}
    })

    const patch2 = [
      {op: 'add', path: '/obj/b', value: 4 }
    ]
    const result2 = immutableJSONPatch(json, patch2, {
      fromJSON: function (value, previousObject) {
        return { value, previousObject }
      },
      toJSON: value => value
    })
    assert.deepStrictEqual(result2.json, {
      arr: [1,2,3],
      obj: {a : 2, b: { value: 4, previousObject: undefined }}
    })
  })
})

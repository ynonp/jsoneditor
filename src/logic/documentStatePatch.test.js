import assert from 'assert'
import { documentStatePatch } from './documentStatePatch.js'

describe('documentStatePatch', () => {
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 2, 3],
      obj: { a: 2, b: { foo: 'bar' } }
    })
  })

  it('jsonpatch add: insert in matrix', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 2 }
    }

    const patch = [
      { op: 'add', path: '/arr/1', value: 4 }
    ]

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 4, 2, 3],
      obj: { a: 2 }
    })
  })

  it('jsonpatch add: append to matrix', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 2 }
    }

    const patch = [
      { op: 'add', path: '/arr/-', value: 4 }
    ]

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 2, 3, 4],
      obj: { a: 2 }
    })
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 3],
      obj: {},
      unchanged: {}
    })
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 200, 3],
      obj: { a: 400 },
      unchanged: {}
    })
  })

  it('jsonpatch replace root document', () => {
    const json = {
      a: 2
    }
    const patch = [
      { op: 'replace', path: '', value: { b: 3 } }
    ]
    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, { b: 3 })
  })

  it('jsonpatch copy', () => {
    const json = {
      arr: [1, 2, 3],
      obj: { a: 4 }
    }

    const patch = [
      { op: 'copy', from: '/obj', path: '/arr/2' }
    ]

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 2, { a: 4 }, 3],
      obj: { a: 4 }
    })
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 2, { a: 4 }, 3],
      unchanged: {}
    })
  })

  it('jsonpatch move to end', () => {
    const json = [1, 2, 3]

    const patch = [
      { op: 'move', from: '/1', path: '/-' }
    ]

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, [1, 3, 2])
  })

  it('jsonpatch move and replace', () => {
    const json = { a: 2, b: 3 }

    const patch = [
      { op: 'move', from: '/a', path: '/b' }
    ]

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, { b: 2 })
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: { a: 4 },
      unchanged: {}
    })
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

    const result = documentStatePatch(json, patch)

    assert.deepStrictEqual(result, {
      arr: [1, 2, 3],
      obj: { a: 4 },
      added: 'ok'
    })
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

    assert.throws(() => {
      documentStatePatch(json, patch)
    }, /Error: Test failed, path not found/)
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

    assert.throws(() => {
      documentStatePatch(json, patch)
    }, /Error: Test failed, value differs/)
  })
})

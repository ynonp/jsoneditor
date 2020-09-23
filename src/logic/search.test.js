import assert from 'assert'
import { times } from 'lodash-es'
import { searchAsync, searchGenerator } from './search.js'
import { STATE_SEARCH_PROPERTY, STATE_SEARCH_VALUE } from '../constants.js'

describe('search', () => {
  it('should search with generator', () => {
    const doc = {
      b: { c: 'a' },
      a: [
        { a: 'b', c: 'a' },
        'e',
        'a'
      ]
    }

    const search = searchGenerator('a', doc)

    assert.deepStrictEqual(search.next(), { done: false, value: ['b', 'c', STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: false, value: ['a', STATE_SEARCH_PROPERTY] })
    assert.deepStrictEqual(search.next(), { done: false, value: ['a', 0, 'a', STATE_SEARCH_PROPERTY] })
    assert.deepStrictEqual(search.next(), { done: false, value: ['a', 0, 'c', STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: false, value: ['a', 2, STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: true, value: undefined })
  })

  it('should yield every x items during search', () => {
    const doc = times(30, index => String(index))

    const search = searchGenerator('4', doc, 10)
    assert.deepStrictEqual(search.next(), { done: false, value: [4, STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: false, value: null }) // at 10
    assert.deepStrictEqual(search.next(), { done: false, value: [14, STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: false, value: null }) // at 20
    assert.deepStrictEqual(search.next(), { done: false, value: [24, STATE_SEARCH_VALUE] })
    assert.deepStrictEqual(search.next(), { done: false, value: null }) // at 30
    assert.deepStrictEqual(search.next(), { done: true, value: undefined })
  })

  it('should search async', (done) => {
    const doc = times(30, index => String(index))

    const callbacks = []

    function onProgress (results) {
      callbacks.push(results.slice(0))
    }

    function onDone (results) {
      assert.deepStrictEqual(results, [
        [4, STATE_SEARCH_VALUE],
        [14, STATE_SEARCH_VALUE],
        [24, STATE_SEARCH_VALUE]
      ])

      assert.deepStrictEqual(callbacks, [
        results.slice(0, 1),
        results.slice(0, 2),
        results.slice(0, 3)
      ])

      done()
    }

    searchAsync('4', doc, { onProgress, onDone })

    // should not have results right after creation, but only on the first next tick
    assert.deepStrictEqual(callbacks, [])
  })

  it('should cancel async search', (done) => {
    const doc = times(30, index => String(index))

    const callbacks = []

    function onProgress (results) {
      callbacks.push(results.slice(0))
    }

    function onDone () {
      throw new Error('onDone should not be invoked')
    }

    const { cancel } = searchAsync('4', doc, { onProgress, onDone })

    // should not have results right after creation, but only on the first next tick
    assert.deepStrictEqual(callbacks, [])

    setTimeout(() => {
      cancel()

      assert.deepStrictEqual(callbacks, [
        [
          [4, STATE_SEARCH_VALUE]
        ]
      ])

      done()
    })
  })
})

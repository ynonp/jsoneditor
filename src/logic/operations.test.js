import assert from 'assert'
import { createNewValue } from './operations.js'

describe('operations', () => {
  describe('createNewValue', () => {
    it('should create a value of type "value"', () => {
      assert.strictEqual(createNewValue({}, null, 'value'), '')
    })

    it('should create a value of type "object"', () => {
      assert.deepStrictEqual(createNewValue({}, null, 'object'), {})
    })

    it('should create a value of type "array"', () => {
      assert.deepStrictEqual(createNewValue({}, null, 'array'), [])
    })

    it('should create a simple value via type "structure"', () => {
      assert.deepStrictEqual(createNewValue([1, 2, 3], { paths: [[0]] }, 'structure'), '')
    })

    it('should create a nested object via type "structure"', () => {
      const doc = [
        {
          a: 2,
          b: {
            c: 3
          },
          d: [1, 2, 3]
        }
      ]

      assert.deepStrictEqual(createNewValue(doc, { paths: [[0]] }, 'structure'), {
        a: '',
        b: {
          c: ''
        },
        d: []
      })
    })
  })
})

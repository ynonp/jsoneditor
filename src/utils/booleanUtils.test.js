import assert from 'assert'
import { xor } from './booleanUtils.js'

describe ('booleanUtils', () => {
  it ('should calculate xor of two values', () => {
    assert.strictEqual(xor(1, 0), true)
    assert.strictEqual(xor(0, 1), true)
    assert.strictEqual(xor(1, 1), false)
    assert.strictEqual(xor(0, 0), false)
  })
})
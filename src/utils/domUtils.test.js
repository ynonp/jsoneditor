import assert from 'assert'
import { escapeHTML, unescapeHTML } from './domUtils.js'

describe('domUtils', () => {
  it('escapeHTML', () => {
    assert.strictEqual(escapeHTML('   hello  '), '\u00A0\u00A0 hello \u00A0')
    assert.strictEqual(escapeHTML('\u00A0 hello'), '\u00A0 hello')
    assert.strictEqual(escapeHTML('hello\nworld'), 'hello\\nworld')

    // TODO: test escapeHTML more thoroughly
  })

  it('unescapeHTML', () => {
    assert.strictEqual(unescapeHTML(' \u00A0 hello \u00A0'), '   hello  ')
    assert.strictEqual(unescapeHTML('\u00A0 hello'), '  hello')

    assert.strictEqual(unescapeHTML('hello\\nworld'), 'hello\nworld')

    // TODO: test unescapeHTML more thoroughly
  })
})

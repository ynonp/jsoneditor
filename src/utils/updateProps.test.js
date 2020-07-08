import assert from 'assert'
import { updateProps } from './updateProps.js'

describe('updateProps', () => {

  it('updateProps (1)', () => {
    const props1 = updateProps({b: 2})
    assert.deepStrictEqual(props1.map(item => item.key), ['b'])

    const props2 = updateProps({a: 1, b: 2}, props1)
    assert.deepStrictEqual(props2.map(item => item.key), ['b', 'a'])
    assert.deepStrictEqual(props2[0], props1[0]) // b must still have the same id
  })

  it('updateProps (2)', () => {
    const props1 = updateProps({a: 1, b: 2})
    const props2 = updateProps({a: 1, b: 2}, props1)
    assert.deepStrictEqual(props2, props1)
  })

})

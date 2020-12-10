import assert from 'assert'
import { ARRAY_SECTION_SIZE } from '../constants.js'
import {
  getExpandItemsSections,
  mergeSections,
  nextRoundNumber,
  previousRoundNumber
} from './expandItemsSections.js'

describe('expandItemsSections', () => {
  it('should find the next round number', () => {
    assert.strictEqual(nextRoundNumber(ARRAY_SECTION_SIZE / 2), ARRAY_SECTION_SIZE)
    assert.strictEqual(nextRoundNumber(ARRAY_SECTION_SIZE - 1), ARRAY_SECTION_SIZE)
    assert.strictEqual(nextRoundNumber(ARRAY_SECTION_SIZE), 2 * ARRAY_SECTION_SIZE)
  })

  it('should find the previous round number', () => {
    assert.strictEqual(previousRoundNumber(ARRAY_SECTION_SIZE), 0)
    assert.strictEqual(previousRoundNumber(2 * ARRAY_SECTION_SIZE - 1), ARRAY_SECTION_SIZE)
    assert.strictEqual(previousRoundNumber(2 * ARRAY_SECTION_SIZE), ARRAY_SECTION_SIZE)
    assert.strictEqual(previousRoundNumber(ARRAY_SECTION_SIZE + 1), ARRAY_SECTION_SIZE)
    assert.strictEqual(previousRoundNumber(5 * ARRAY_SECTION_SIZE), 4 * ARRAY_SECTION_SIZE)
  })

  it('should calculate expandable sections (start, middle, end)', () => {
    assert.deepStrictEqual(getExpandItemsSections(0, 1000), [
      { start: 0, end: 100 },
      { start: 400, end: 500 },
      { start: 900, end: 1000 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 510), [
      { start: 30, end: 100 },
      { start: 200, end: 300 },
      { start: 500, end: 510 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 250), [
      { start: 30, end: 100 },
      { start: 100, end: 200 },
      { start: 200, end: 250 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 200), [
      { start: 30, end: 100 },
      { start: 100, end: 200 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 170), [
      { start: 30, end: 100 },
      { start: 100, end: 170 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 100), [
      { start: 30, end: 100 }
    ])

    assert.deepStrictEqual(getExpandItemsSections(30, 70), [
      { start: 30, end: 70 }
    ])
  })

  it('should apply expanding a new piece of selection', () => {
    // merge
    assert.deepStrictEqual(mergeSections([
      { start: 0, end: 100 },
      { start: 100, end: 200 }
    ]), [
      { start: 0, end: 200 }
    ])

    // sort correctly
    assert.deepStrictEqual(mergeSections([
      { start: 0, end: 100 },
      { start: 400, end: 500 },
      { start: 200, end: 300 }
    ]), [
      { start: 0, end: 100 },
      { start: 200, end: 300 },
      { start: 400, end: 500 }
    ])

    // merge partial overlapping
    assert.deepStrictEqual(mergeSections([
      { start: 0, end: 30 },
      { start: 20, end: 100 }
    ]), [
      { start: 0, end: 100 }
    ])

    // merge full overlapping
    assert.deepStrictEqual(mergeSections([
      { start: 100, end: 200 },
      { start: 0, end: 300 }
    ]), [
      { start: 0, end: 300 }
    ])
    assert.deepStrictEqual(mergeSections([
      { start: 0, end: 300 },
      { start: 100, end: 200 }
    ]), [
      { start: 0, end: 300 }
    ])

    // merge overlapping with two
    assert.deepStrictEqual(mergeSections([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
      { start: 100, end: 200 }
    ]), [
      { start: 0, end: 300 }
    ])
  })
})

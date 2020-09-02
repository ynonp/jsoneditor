import naturalCompare from 'natural-compare-lite'
import { getIn } from '../utils/immutabilityHelpers.js'
import { compileJSONPointer } from '../utils/jsonPointer.js'

function caseInsensitiveNaturalCompare (a, b) {
  const aLower = typeof a === 'string' ? a.toLowerCase() : a
  const bLower = typeof b === 'string' ? b.toLowerCase() : b

  return naturalCompare(aLower, bLower)
}

/**
 * Sort the keys of an object
 * @param {Object} object         The object to be sorted
 * @param {Path} [rootPath=[]]    Relative path when the array was located
 * @param {1 | -1} [direction=1]  Pass 1 to sort ascending, -1 to sort descending
 * @return {JSONPatchDocument}    Returns a JSONPatch document with move operation
 *                                to get the array sorted.
 */
export function sortObjectKeys (object, rootPath = [], direction = 1) {
  const keys = Object.keys(object)
  const sortedKeys = keys.slice()

  sortedKeys.sort((keyA, keyB) => {
    return direction * caseInsensitiveNaturalCompare(keyA, keyB)
  })

  // TODO: can we make this more efficient? check if the first couple of keys are already in order and if so ignore them
  const operations = []
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i]
    const path = compileJSONPointer(rootPath.concat(key))
    operations.push({
      op: 'move',
      from: path,
      path
    })
  }

  return operations
}

/**
 * Sort the items of an array
 * @param {Array} array             The array to be sorted
 * @param {Path} [rootPath=[]]      Relative path when the array was located
 * @param {Path} [propertyPath=[]]  Nested path to the property on which to sort the contents
 * @param {1 | -1} [direction=1]    Pass 1 to sort ascending, -1 to sort descending
 * @return {JSONPatchDocument}      Returns a JSONPatch document with move operation
 *                                  to get the array sorted.
 */
export function sortArray (array, rootPath = [], propertyPath = [], direction = 1) {
  const comparator = createObjectComparator(propertyPath, direction)

  return getSortingMoves(array, comparator).map(({ fromIndex, toIndex }) => {
    return {
      op: 'move',
      from: compileJSONPointer(rootPath.concat(fromIndex)),
      path: compileJSONPointer(rootPath.concat(toIndex))
    }
  })
}

/**
 * Create a comparator function to compare nested properties in an array
 * @param {Path} propertyPath
 * @param {1 | -1} direction
 */
function createObjectComparator (propertyPath, direction) {
  return function comparator (a, b) {
    const valueA = getIn(a, propertyPath)
    const valueB = getIn(b, propertyPath)

    if (valueA === undefined) {
      return direction
    }
    if (valueB === undefined) {
      return -direction
    }

    if (typeof valueA !== 'string' && typeof valueB !== 'string') {
      // both values are a number, boolean, or null -> use simple, fast sorting
      return valueA > valueB
        ? direction
        : valueA < valueB
          ? -direction
          : 0
    }

    return direction * caseInsensitiveNaturalCompare(valueA, valueB)
  }
}

/**
 * Create an array containing all move operations
 * needed to sort the array contents.
 * @param {Array} array
 * @param {function (a, b) => number} comparator
 * @param {Array.<{fromIndex: number, toIndex: number}>}
 */
export function getSortingMoves (array, comparator) {
  const operations = []
  const sorted = []

  // TODO: rewrite the function to pass a callback instead of returning an array?
  for (let i = 0; i < array.length; i++) {
    // TODO: implement a faster way to sort. Something with longest increasing subsequence?
    // TODO: can we simplify the following code?
    const item = array[i]
    if (i > 0 && comparator(sorted[i - 1], item) > 0) {
      let j = i - 1
      while (j > 0 && comparator(sorted[j - 1], item) > 0) {
        j--
      }

      operations.push({
        fromIndex: i,
        toIndex: j
      })

      sorted.splice(j, 0, item)
    } else {
      sorted.push(item)
    }
  }

  return operations
}

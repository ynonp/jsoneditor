import { getIn } from '../utils/immutabilityHelpers.js'
import naturalSort from 'javascript-natural-sort'

/**
 * Sort the items of an array
 * @param {Array} array           The array to be sorted
 * @param {Path} [path=[]]        Nested path to the property on which to sort the contents
 * @param {1 | -1} [direction=1]  Pass 1 to sort ascending, -1 to sort descending
 * @return {Array} Returns a sorted shallow copy of the array
 */
export function sortArray (array, path = [], direction = 1) {
  function comparator (a, b) {
    const valueA = getIn(a, path)
    const valueB = getIn(b, path)

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

    return direction * naturalSort(valueA, valueB)
  }

  // TODO: use lodash orderBy, split comparator and direction?
  const sortedArray = array.slice()
  sortedArray.sort(comparator)

  return sortedArray
}

/**
 * Sort the keys of an object
 * @param {Object} object         The object to be sorted
 * @param {1 | -1} [direction=1]  Pass 1 to sort ascending, -1 to sort descending
 * @return {Object} Returns a sorted shallow copy of the object
 */
export function sortObjectKeys (object, direction = 1) {
  const keys = Object.keys(object)
  keys.sort((keyA, keyB) => {
    return direction * naturalSort(keyA, keyB)
  })
  
  const sortedObject = {}
  keys.forEach(key => sortedObject[key] = object[key])

  return sortedObject
}

/**
 * Create an array containing all move operations
 * needed to sort the array contents.
 * @param {Array} array 
 * @param {function (a, b) => number} comparator 
 * @param {Array.<{fromIndex: number, toIndex: number}>} 
 */
export function sortMoveOperations (array, comparator) {
  const operations = []

  const sorted = array.slice()

  for (let i = 1; i < sorted.length; i++) {
    // TODO: implement a faster way to sort (binary tree sort?) 
    // TODO: can we simplify the following code?
    if (comparator(sorted[i - 1], sorted[i]) > 0) {
      let j = i - 1
      while (comparator(sorted[j - 1], sorted[i]) > 0 && j > 0) {
        j--
      }

      operations.push({
        fromIndex: i,
        toIndex: j
      })

      const item = sorted.splice(i, 1)
      sorted.splice(j, 0, [item])
    }
  }

  return operations
}

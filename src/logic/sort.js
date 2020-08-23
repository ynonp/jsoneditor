import { getIn } from '../utils/immutabilityHelpers.js'

/**
 * Sort the items of an array
 * @param {Array} array       The array to be sorted
 * @param {Path} path         Nested path to the property on which to sort the contents
 * @param {1 | -1} direction  Pass 1 to sort ascending, -1 to sort descending
 * @return {Array} Returns a sorted shallow copy of the array
 */
// TODO: write unit tests for sortArray
export function sortArray (array, path, direction) {
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
 * @param {Object} object     The object to be sorted
 * @param {1 | -1} direction  Pass 1 to sort ascending, -1 to sort descending
 * @return {Object} Returns a sorted shallow copy of the object
 */
// TODO: write unit tests for sortObjectKeys
export function sortObjectKeys (object, direction) {
  const keys = Object.keys(object)
  keys.sort((keyA, keyB) => {
    return direction * naturalSort(keyA, keyB)
  })
  
  const sortedObject = {}
  keys.forEach(key => sortedObject[key] = object[key])

  return sortedObject
}

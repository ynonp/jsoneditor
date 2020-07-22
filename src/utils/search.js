import { isNumber } from 'lodash-es'
import { STATE_SEARCH_PROPERTY, STATE_SEARCH_VALUE } from '../constants.js'
import { valueType } from './typeUtils.js'

export function search (doc, searchText) {
  return searchRecursive(null, doc, searchText)
}

function searchRecursive (key, doc, searchText) {
  let results = undefined

  if (typeof key === 'string' && containsCaseInsensitive(key, searchText)) {
    results = createOrAdd(results, STATE_SEARCH_PROPERTY, 'search')
  }

  const type = valueType(doc)
  if (type === 'array') {
    doc.forEach((item, index) => {
      let childResults = searchRecursive(index, item, searchText)
      if (childResults) {
        results = createOrAdd(results, index, childResults)
      }
    })
  } else if (type === 'object') {
    Object.keys(doc).forEach(prop => {
      let childResults = searchRecursive(prop, doc[prop], searchText)
      if (childResults) {
        results = createOrAdd(results, prop, childResults)
      }
    })
  } else { // type is a value
    if (containsCaseInsensitive(doc, searchText)) {
      results = createOrAdd(results, STATE_SEARCH_VALUE, 'search')
    }
  }

  return results
}

export function flattenSearch (searchResult) {
  const resultArray = []

  function _flattenSearch (value, path) {
    if (value) {
      if (value[STATE_SEARCH_PROPERTY]) {
        resultArray.push({
          what: STATE_SEARCH_PROPERTY,
          path
        })
      }
      if (value[STATE_SEARCH_VALUE]) {
        resultArray.push({
          what: STATE_SEARCH_VALUE,
          path
        })
      }
    }

    const type = valueType(value)
    if (type === 'array') {
      value.forEach((item, index) => {
        _flattenSearch(item, path.concat(index))
      })
    } else if (type === 'object') {
      Object.keys(value).forEach(prop => {
        _flattenSearch(value[prop], path.concat(prop))
      })
    }
  }

  _flattenSearch(searchResult, [])

  return resultArray
}

function createOrAdd(object, key, value) {
  if (object) {
    object[key] = value
    return object
  } else {
    if (isNumber(key)) {
      const array = []
      array[key] = value
      return array
    } else {
      return {
        [key]: value
      }
    }
  }
}

/**
 * Do a case insensitive search for a search text in a text
 * @param {String} text
 * @param {String} searchText
 * @return {boolean} Returns true if `search` is found in `text`
 */
export function containsCaseInsensitive (text, searchText) {
  return String(text).toLowerCase().indexOf(searchText.toLowerCase()) !== -1
}

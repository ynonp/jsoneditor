import { isEqual, isNumber } from 'lodash-es'
import { STATE_SEARCH_PROPERTY, STATE_SEARCH_VALUE } from '../constants.js'
import { existsIn, setIn } from '../utils/immutabilityHelpers.js'
import { valueType } from '../utils/typeUtils.js'


/**
 * @typedef {{path: Path, what: Symbol}} SearchItem
 */

/**
 * @typedef {Object} SearchResult
 * @property {Object} items
 * @property {Object} itemsWithActive
 * @property {SearchItem[]} flatItems
 * @property {SearchItem} activeItem
 * @property {number} activeIndex
 * @property {number} count
 */

/**
 * @param {JSON} doc
 * @param {string} searchText
 * @param {SearchResult} [previousResult]
 * @returns {SearchResult}
 */
export function search (doc, searchText, previousResult) {
  if (!searchText || searchText === '') {
    return undefined
  }

  const items = searchRecursive(null, doc, searchText)

  const flatItems = flattenSearch(items)

  const activeItem = (previousResult && previousResult.activeItem &&
    existsIn(items, previousResult.activeItem.path.concat(previousResult.activeItem.what)))
    ? previousResult.activeItem
    : flatItems[0]

  const activeIndex = flatItems.findIndex(item => isEqual(item, activeItem))

  const itemsWithActive = (items && activeItem)
    ? setIn(items, activeItem.path.concat(activeItem.what), 'search active', true)
    : items

  return {
    items,
    itemsWithActive,
    flatItems,
    count: flatItems.length,
    activeItem,
    activeIndex
  }
}

/**
 * @param {SearchResult} searchResult
 * @return {SearchResult} nextResult
 */
export function searchNext (searchResult) {
  const nextActiveIndex = searchResult.activeIndex < searchResult.flatItems.length - 1
    ? searchResult.activeIndex + 1
    : 0

  const nextActiveItem = searchResult.flatItems[nextActiveIndex]

  const itemsWithActive = nextActiveItem
    ? setIn(searchResult.items, nextActiveItem.path.concat(nextActiveItem.what), 'search active', true)
    : searchResult.items

  return {
    ...searchResult,
    itemsWithActive,
    activeItem: nextActiveItem,
    activeIndex: nextActiveIndex
  }
}

/**
 * @param {SearchResult} searchResult
 * @return {SearchResult} nextResult
 */
export function searchPrevious (searchResult) {
  const previousActiveIndex = searchResult.activeIndex > 0
    ? searchResult.activeIndex - 1
    : searchResult.flatItems.length - 1

  const previousActiveItem = searchResult.flatItems[previousActiveIndex]

  const itemsWithActive = previousActiveItem
    ? setIn(searchResult.items, previousActiveItem.path.concat(previousActiveItem.what), 'search active', true)
    : searchResult.items

  return {
    ...searchResult,
    itemsWithActive,
    activeItem: previousActiveItem,
    activeIndex: previousActiveIndex
  }
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

function flattenSearch (searchResult) {
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

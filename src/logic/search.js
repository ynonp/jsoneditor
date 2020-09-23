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
  let results

  if (typeof key === 'string' && containsCaseInsensitive(key, searchText)) {
    results = createOrAdd(results, STATE_SEARCH_PROPERTY, 'search')
  }

  const type = valueType(doc)
  if (type === 'array') {
    doc.forEach((item, index) => {
      const childResults = searchRecursive(index, item, searchText)
      if (childResults) {
        results = createOrAdd(results, index, childResults)
      }
    })
  } else if (type === 'object') {
    Object.keys(doc).forEach(prop => {
      const childResults = searchRecursive(prop, doc[prop], searchText)
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

async function tick () {
  return new Promise(setTimeout)
}

// TODO: comment
export function searchAsync (searchText, doc, { onProgress, onDone }) {
  const yieldAfterItemCount = 10000 // TODO: what is a good value?
  const search = searchGenerator(searchText, doc, yieldAfterItemCount)

  // TODO: implement pause after having found x results (like 999)

  let cancelled = false
  const results = []

  async function executeSearch () {
    let next
    do {
      next = search.next()
      if (next.value) {
        results.push(next.value) // TODO: make this immutable?
        onProgress(results)
      }
      await tick() // TODO: be able to wait longer than just one tick? So the UI stays fully responsive?
    } while (!cancelled && !next.done)

    if (next.done) {
      onDone(results)
    } // else: cancelled
  }

  // start searching on the next tick
  setTimeout(executeSearch)

  return {
    cancel: () => {
      cancelled = true
    }
  }
}

// TODO: comment
export function * searchGenerator (searchText, doc, yieldAfterItemCount = undefined) {
  let count = 0

  function * incrementCounter () {
    count++
    if (typeof yieldAfterItemCount === 'number' && count % yieldAfterItemCount === 0) {
      // pause every x items
      yield null
    }
  }

  function * searchRecursiveAsync (searchText, doc, path) {
    const type = valueType(doc)

    if (type === 'array') {
      for (let i = 0; i < doc.length; i++) {
        yield * searchRecursiveAsync(searchText, doc[i], path.concat([i]))
      }
    } else if (type === 'object') {
      for (const prop of Object.keys(doc)) {
        if (typeof prop === 'string' && containsCaseInsensitive(prop, searchText)) {
          yield path.concat([prop, STATE_SEARCH_PROPERTY])
        }
        yield * incrementCounter()

        yield * searchRecursiveAsync(searchText, doc[prop], path.concat([prop]))
      }
    } else { // type is a value
      if (containsCaseInsensitive(doc, searchText)) {
        yield path.concat([STATE_SEARCH_VALUE])
      }
      yield * incrementCounter()
    }
  }

  return yield * searchRecursiveAsync(searchText, doc, [])
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

function createOrAdd (object, key, value) {
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

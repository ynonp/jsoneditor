<script>
  import { tick, beforeUpdate, afterUpdate } from 'svelte'
  import {
    DEFAULT_LIMIT,
    STATE_EXPANDED,
    STATE_LIMIT,
    SCROLL_DURATION, STATE_PROPS
  } from './constants.js'
  import SearchBox from './SearchBox.svelte'
  import Icon from 'svelte-awesome'
  import { faSearch, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons'
  import { createHistory } from './history.js'
  import Node from './JSONNode.svelte'
  import { expandSelection } from './selection.js'
  import {
    existsIn,
    getIn,
    setIn,
    updateIn
  } from './utils/immutabilityHelpers.js'
  import { compileJSONPointer, parseJSONPointer } from './utils/jsonPointer.js'
  import { keyComboFromEvent } from './utils/keyBindings.js'
  import { flattenSearch, search } from './utils/search.js'
  import { immutableJSONPatch } from './utils/immutableJSONPatch'
  import { isEqual, isNumber, initial, last } from 'lodash-es'
  import jump from './assets/jump.js/src/jump.js'
  import { syncState } from './utils/syncState.js'

  let divContents

  beforeUpdate(() => {
    console.time('render')
  })
  afterUpdate(() => {
    console.timeEnd('render')
  })

  export let doc = {}
  let state = undefined
  let selection = null
  let selectionMap = {}

  $: {
    selectionMap = {}
    if (selection != null) {
      selection.forEach(path => {
        selectionMap[compileJSONPointer(path)] = true
      })
    }
  }

  $: console.log('selectionMap', selectionMap)

  export let onChangeJson = () => {}

  $: {
    console.time('syncState')
    state = syncState(doc, state, [], (path) => path.length < 1)
    console.timeEnd('syncState')
  }

  let showSearch = false
  let searchText = ''

  const history = createHistory({
    onChange: (state) => {
      historyState = state
    }
  })
  let historyState = history.getState()

  export function expand (callback = () => true) {
    state = syncState(doc, state, [], callback, true)
  }

  export function collapse (callback = () => false) {
    state = syncState(doc, state, [], callback, true)
  }

  export function get() {
    return doc
  }

  export function set(newDocument) {
    doc = newDocument
    state = undefined
    history.clear()
  }

  export function patch(operations) {
    const prevState = state

    const documentPatchResult = immutableJSONPatch(doc, operations)
    const statePatchResult = immutableJSONPatch(state, operations)
    // TODO: only apply operations to state for relevant operations: move, copy, delete? Figure out

    doc = documentPatchResult.json
    state = statePatchResult.json

    // if a property is renamed (move operation), rename it in the object's props
    // so it maintains its identity and hence its index
    operations
      .filter(operation => {
        return operation.op === 'move' && isEqual(
          initial(parseJSONPointer(operation.from)),
          initial(parseJSONPointer(operation.path))
        )
      })
      .forEach(operation => {
        const pathFrom = parseJSONPointer(operation.from)
        const to = parseJSONPointer(operation.path)
        const parentPath = initial(pathFrom)
        const oldKey = last(pathFrom)
        const newKey = last(to)
        const props = getIn(state, parentPath.concat(STATE_PROPS))
        const index = props.findIndex(item => item.key === oldKey)
        if (index !== -1) {
          state = setIn(state, parentPath.concat([STATE_PROPS, index, 'key']), newKey)
        }
      })

    history.add({
      undo: documentPatchResult.revert,
      redo: operations,
      prevState: prevState,
      state: state
    })

    return {
      doc,
      error: documentPatchResult.error,
      undo: documentPatchResult.revert,
      redo: operations
    }
  }

  function handleUndo() {
    if (history.getState().canUndo) {
      const item = history.undo()
      if (item) {
        doc = immutableJSONPatch(doc, item.undo).json
        state = item.prevState

        console.log('undo', { item,  doc, state })

        emitOnChange()
      }
    }
  }

  function handleRedo() {
    if (history.getState().canRedo) {
      const item = history.redo()
      if (item) {
        doc = immutableJSONPatch(doc, item.redo).json
        state = item.state

        console.log('redo', { item,  doc, state })

        emitOnChange()
      }
    }
  }

  function doSearch(doc, searchText) {
    return search(null, doc, searchText)
  }

  // TODO: refactor the search solution and move it in a separate component
  let searchResult
  let activeSearchResult = undefined
  let activeSearchResultIndex
  let flatSearchResult
  let searchResultWithActive
  $: searchResult = searchText ? doSearch(doc, searchText) : undefined
  $: flatSearchResult = flattenSearch(searchResult)

  $: {
    if (!activeSearchResult || !existsIn(searchResult, activeSearchResult.path.concat(activeSearchResult.what))) {
      activeSearchResult = flatSearchResult[0]
      focusActiveSearchResult()
    }
  }

  $: activeSearchResultIndex = flatSearchResult.findIndex(item => isEqual(item, activeSearchResult))
  $: searchResultWithActive = searchResult
      ? activeSearchResult
        ? setIn(searchResult, activeSearchResult.path.concat(activeSearchResult.what), 'search active')
        : searchResult
      : undefined

  function nextSearchResult () {
    activeSearchResult = flatSearchResult[activeSearchResultIndex + 1] || activeSearchResult
    focusActiveSearchResult()
  }

  function previousSearchResult () {
    activeSearchResult = flatSearchResult[activeSearchResultIndex - 1] || activeSearchResult
    focusActiveSearchResult()
  }

  async function focusActiveSearchResult () {
    if (activeSearchResult) {
      expandPath(activeSearchResult.path)

      await tick()

      scrollTo(activeSearchResult.path.concat(activeSearchResult.what))
    }
  }

  /**
   * Scroll the window vertically to the node with given path
   * @param {Path} path
   */
  function scrollTo (path) {
    const elem = divContents.querySelector(`div[data-path="${compileJSONPointer(path)}"]`)
    const offset = -(divContents.getBoundingClientRect().height / 4)

    if (elem) {
      jump(elem, {
        container: divContents,
        offset,
        duration: SCROLL_DURATION
      })
    }
  }

  function emitOnChange() {
    // TODO: add more logic here to emit onChange, onChangeJson, onChangeText, etc.
    onChangeJson(doc)
  }

  /**
   * @param {JSONPatchDocument} operations
   */
  function handlePatch(operations) {
    // console.log('handlePatch', operations)

    patch(operations)

    emitOnChange()
  }

  function handleToggleSearch() {
    showSearch = !showSearch
  }

  /**
   * Toggle expanded state of a node
   * @param {Path} path
   * @param {boolean} expanded
   * @param {boolean} [recursive=false]
   */
  function handleExpand (path, expanded, recursive = false) {
    if (recursive) {
      state = updateIn(state, path, (childState) => {
        return syncState(getIn(doc, path), childState, [], () => expanded, true)
      })
    } else {
      state = setIn(state, path.concat(STATE_EXPANDED), expanded)
    }
  }

  /**
   * Change limit
   * @param {Path} path
   * @param {boolean} limit
   */
  function handleLimit (path, limit) {
    state = setIn(state, path.concat(STATE_LIMIT), limit)
  }

  function handleSelect (anchorPath, focusPath) {
    if (anchorPath && focusPath) {
      selection = expandSelection(doc, state, anchorPath, focusPath)
    } else {
      selection = null
    }
  }

  /**
   * Expand all nodes on given path
   * @param {Path} path
   */
  function expandPath (path) {
    for (let i = 1; i < path.length; i++) {
      const partialPath = path.slice(0, i)
      state = setIn(state, partialPath.concat(STATE_EXPANDED), true)

      // if needed, enlarge the limit such that the search result becomes visible
      const key = path[i]
      if (isNumber(key)) {
        const limit = getIn(state, partialPath.concat(STATE_LIMIT)) || DEFAULT_LIMIT
        if (key > limit) {
          const newLimit = Math.ceil(key / DEFAULT_LIMIT) * DEFAULT_LIMIT
          state = setIn(state, partialPath.concat(STATE_LIMIT), newLimit)
        }
      }
    }
  }

  function handleKeyDown (event) {
    const combo = keyComboFromEvent(event)

    if (combo === 'Ctrl+F' || combo === 'Command+F') {
      event.preventDefault()
      showSearch = true
    }

    if (combo === 'Ctrl+Z' || combo === 'Command+Z') {
      event.preventDefault()

      // TODO: find a better way to restore focus
      const activeElement = document.activeElement
      if (activeElement && activeElement.blur && activeElement.focus) {
        activeElement.blur()
        setTimeout(() => {
          handleUndo()
          setTimeout(() => activeElement.focus())
        })
      } else {
        handleUndo()
      }
    }

    if (combo === 'Ctrl+Shift+Z' || combo === 'Command+Shift+Z') {
      event.preventDefault()

      // TODO: find a better way to restore focus
      const activeElement = document.activeElement
      if (activeElement && activeElement.blur && activeElement.focus) {
        activeElement.blur()
        setTimeout(() => {
          handleRedo()
          setTimeout(() => activeElement.focus())
        })
      } else {
        handleRedo()
      }
    }
  }
</script>

<div class="jsoneditor" on:keydown={handleKeyDown}>
  <div class="menu">
    <button
      class="button search"
      on:click={handleToggleSearch}
      title="Search (Ctrl+F)"
    >
      <Icon data={faSearch} />
    </button>
    <div class="separator"></div>
    <button
      class="button undo"
      disabled={!historyState.canUndo}
      on:click={handleUndo}
      title="Undo (Ctrl+Z)"
    >
      <Icon data={faUndo} />
    </button>
    <button
      class="button redo"
      disabled={!historyState.canRedo}
      on:click={handleRedo}
      title="Redo (Ctrl+Shift+Z)"
    >
      <Icon data={faRedo} />
    </button>
    <div class="space"></div>
    {#if showSearch}
      <div class="search-box-container">
        <SearchBox
          text={searchText}
          resultCount={flatSearchResult.length}
          activeIndex={activeSearchResultIndex}
          onChange={(text) => searchText = text}
          onNext={nextSearchResult}
          onPrevious={previousSearchResult}
          onClose={() => {
            showSearch = false
            searchText = ''
          }}
        />
      </div>
    {/if}
  </div>
  <div class="contents" bind:this={divContents}>
    <Node
      value={doc}
      path={[]}
      state={state}
      searchResult={searchResultWithActive}
      onPatch={handlePatch}
      onExpand={handleExpand}
      onLimit={handleLimit}
      onSelect={handleSelect}
      selectionMap={selectionMap}
    />
  </div>
</div>

<style src="JSONEditor.scss"></style>

<script>
  import { tick } from 'svelte'
  import {
    append,
    insertBefore,
    removeAll,
    replace
  } from './operations.js'
  import {
    DEFAULT_LIMIT,
    STATE_EXPANDED,
    STATE_LIMIT,
    SCROLL_DURATION,
    STATE_PROPS
  } from './constants.js'
  import SearchBox from './SearchBox.svelte'
  import Icon from 'svelte-awesome'
  import { faCut, faCopy, faPaste, faSearch, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons'
  import { createHistory } from './history.js'
  import Node from './JSONNode.svelte'
  import { expandSelection } from './selection.js'
  import { isContentEditableDiv } from './utils/domUtils.js'
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
  import { isEqual, isNumber, initial, last, cloneDeep } from 'lodash-es'
  import jump from './assets/jump.js/src/jump.js'
  import { syncState } from './utils/syncState.js'
  import { getNextKeys, patchProps } from './utils/updateProps.js'

  let divContents
  let domHiddenInput

  export let doc = {}
  let state = undefined
  let selection = null

  export let onChangeJson = () => {}

  let clipboard = null
  $: canCut = selection != null && selection.paths != null
  $: canCopy = selection != null && selection.paths != null
  $: canPaste = clipboard != null && selection != null

  $: state = syncState(doc, state, [], (path) => path.length < 1)

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

  /**
   * @param {JSONPatchDocument} operations
   * @param {Selection} [newSelection]
   */
  export function patch(operations, newSelection) {
    const prevState = state
    const prevSelection = selection

    console.log('operations', operations)

    const documentPatchResult = immutableJSONPatch(doc, operations)
    const statePatchResult = immutableJSONPatch(state, operations)
    // TODO: only apply operations to state for relevant operations: move, copy, delete? Figure out

    doc = documentPatchResult.json
    state = patchProps(statePatchResult.json, operations)
    if (newSelection) {
      selection = newSelection
    }

    history.add({
      undo: documentPatchResult.revert,
      redo: operations,
      prevState,
      state,
      prevSelection,
      selection: newSelection
    })

    return {
      doc,
      error: documentPatchResult.error,
      undo: documentPatchResult.revert,
      redo: operations
    }
  }

  function selectionToClipboard (selection) {
    if (!selection || !selection.paths) {
      return null
    }

    return selection.paths.map(path => {
      return {
        key: String(last(path)),
        value: cloneDeep(getIn(doc, path))
      }
    })
  }

  function handleCut() {
    if (selection && selection.paths) {
      clipboard = selectionToClipboard(selection)

      const operations = removeAll(selection.paths)
      handlePatch(operations)

      console.log('cut', { selection, clipboard })
    }
  }

  function handleCopy() {
    if (selection && selection.paths) {
      clipboard = selectionToClipboard(selection)
      console.log('copy', { clipboard })
    }
  }

  function handlePaste() {
    if (selection && clipboard) {
      console.log('paste', { clipboard, selection })

      function createNewSelection (operations) {
        const paths = operations
          .filter(operation => operation.op === 'add')
          .map(operation => parseJSONPointer(operation.path))

        return  {
          paths,
          pathsMap: createPathsMap(paths)
        }
      }

      if (selection.beforePath) {
        const parentPath = initial(selection.beforePath)
        const beforeKey = last(selection.beforePath)
        const props = getIn(state, parentPath.concat(STATE_PROPS))
        const nextKeys = getNextKeys(props, parentPath, beforeKey, true)
        const operations = insertBefore(doc, selection.beforePath, clipboard, nextKeys)
        const newSelection = createNewSelection(operations)

        handlePatch(operations, newSelection)
      } else if (selection.appendPath) {
        const operations = append(doc, selection.appendPath, clipboard)
        const newSelection = createNewSelection(operations)

        handlePatch(operations, newSelection)
      } else if (selection.paths) {
        const lastPath = last(selection.paths) // FIXME: here we assume selection.paths is sorted correctly, that's a dangerous assumption
        const parentPath = initial(lastPath)
        const beforeKey = last(lastPath)
        const props = getIn(state, parentPath.concat(STATE_PROPS))
        const nextKeys = getNextKeys(props, parentPath, beforeKey, true)
        const operations = replace(doc, selection.paths, clipboard, nextKeys)
        const newSelection = createNewSelection(operations)

        handlePatch(operations, newSelection)
      }
    }
  }

  // TODO: cleanup
  $: console.log('doc', doc)
  $: console.log('state', state)
  $: console.log('selection', selection)

  function handleUndo() {
    if (history.getState().canUndo) {
      const item = history.undo()
      if (item) {
        doc = immutableJSONPatch(doc, item.undo).json
        state = item.prevState
        selection = item.prevSelection

        console.log('undo', { item,  doc, state, selection })

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
        selection = item.selection

        console.log('redo', { item,  doc, state, selection })

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
   * @param {Selection} [newSelection]
   */
  function handlePatch(operations, newSelection) {
    // console.log('handlePatch', operations)

    const patchResult = patch(operations, newSelection)

    emitOnChange()

    return patchResult
  }

  function handleUpdateKey (oldKey, newKey) {
    // should never be called on the root
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

  /**
   * @param {Selection} newSelection
   */
  function handleSelect (newSelection) {
    // TODO: refactor handleSelect: should be redundant except for the functionality to expand the selection and generate pathsMap

    if (newSelection) {
      const { paths, anchorPath, focusPath, beforePath, appendPath } = newSelection

      if (beforePath) {
        selection = {
          beforePath
        }
      } else if (appendPath) {
        selection = {
          appendPath
        }
      } else if (anchorPath && focusPath) {
        // TODO: move expandSelection to JSONNode? (must change expandSelection to support relative path)
        const paths = expandSelection(doc, state, anchorPath, focusPath)

        selection = {
          paths,
          pathsMap: createPathsMap(paths)
        }
      } else {
        console.error('Unknown type of selection', newSelection)
      }

      // set focus to the hidden input, so we can capture quick keys like Ctrl+X, Ctrl+C, Ctrl+V
      setTimeout(() => domHiddenInput.focus())
    } else {
      selection = null
    }
  }

  function createPathsMap (paths) {
    const pathsMap = {}

    paths.forEach(path => {
      pathsMap[compileJSONPointer(path)] = true
    })

    return pathsMap
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

    if (!isContentEditableDiv(event.target)) {
      if (combo === 'Ctrl+X' || combo === 'Command+X') {
        event.preventDefault()
        handleCut()
      }
      if (combo === 'Ctrl+C' || combo === 'Command+C') {
        event.preventDefault()
        handleCopy()
      }
      if (combo === 'Ctrl+V' || combo === 'Command+V') {
        event.preventDefault()
        handlePaste()
      }
    }

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
      class="button cut"
      on:click={handleCut}
      disabled={!canCut}
      title="Cut (Ctrl+X)"
    >
      <Icon data={faCut} />
    </button>
    <button
      class="button copy"
      on:click={handleCopy}
      disabled={!canCopy}
      title="Copy (Ctrl+C)"
    >
      <Icon data={faCopy} />
    </button>
    <button
      class="button paste"
      on:click={handlePaste}
      disabled={!canPaste}
      title="Paste (Ctrl+V)"
    >
      <Icon data={faPaste} />
    </button>

    <div class="separator"></div>

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
  <label class="hidden-input-label">
    <input
      class="hidden-input"
      class:visible={!!selection}
      bind:this={domHiddenInput}
    />
  </label>
  <div class="contents" bind:this={divContents}>
    <Node
      value={doc}
      path={[]}
      state={state}
      searchResult={searchResultWithActive}
      onPatch={handlePatch}
      onUpdateKey={handleUpdateKey}
      onExpand={handleExpand}
      onLimit={handleLimit}
      onSelect={handleSelect}
      selection={selection}
    />
  </div>
</div>

<style src="JSONEditor.scss"></style>

<svelte:options immutable={true} />

<script>
  import createDebug from 'debug'
  import { initial, throttle, uniqueId } from 'lodash-es'
  import { getContext, tick } from 'svelte'
  import jump from '../../assets/jump.js/src/jump.js'
  import {
    MAX_SEARCH_RESULTS,
    SCROLL_DURATION,
    SEARCH_PROGRESS_THROTTLE,
    SIMPLE_MODAL_OPTIONS,
    STATE_EXPANDED
  } from '../../constants.js'
  import {
    expandPath,
    expandSection,
    patchKeys,
    syncState
  } from '../../logic/documentState.js'
  import { createHistory } from '../../logic/history.js'
  import {
    createNewValue,
    createPasteOperations,
    duplicate,
    insert,
    removeAll
  } from '../../logic/operations.js'
  import {
    searchAsync,
    searchNext,
    searchPrevious,
    updateSearchResult
  } from '../../logic/search.js'
  import {
    createSelection,
    createSelectionFromOperations,
    findRootPath,
    getInitialSelection,
    getSelectionDown,
    getSelectionLeft,
    getSelectionRight,
    getSelectionUp,
    isSelectionInsidePath,
    removeEditModeFromSelection,
    selectionToPartialJson
  } from '../../logic/selection.js'
  import { mapValidationErrors } from '../../logic/validation.js'
  import { getIn, setIn, updateIn } from '../../utils/immutabilityHelpers.js'
  import { immutableJSONPatch } from '../../utils/immutableJSONPatch'
  import {
    compileJSONPointer,
    parseJSONPointer
  } from '../../utils/jsonPointer.js'
  import { keyComboFromEvent } from '../../utils/keyBindings.js'
  import { isObjectOrArray, isUrl } from '../../utils/typeUtils.js'
  import CopyPasteModal from '../modals/CopyPasteModal.svelte'
  import SortModal from '../modals/SortModal.svelte'
  import TransformModal from '../modals/TransformModal.svelte'
  import JSONNode from './JSONNode.svelte'
  import Menu from './Menu.svelte'

  // TODO: document how to enable debugging in the readme: localStorage.debug="jsoneditor:*", then reload
  const debug = createDebug('jsoneditor:TreeMode')
  
  const { open } = getContext('simple-modal')
  const sortModalId = uniqueId()
  const transformModalId = uniqueId()

  let divContents
  let domHiddenInput

  export let validate = null
  export let onChangeJson = () => {}

  export function setValidator (newValidate) {
    validate = newValidate
  }

  export function getValidator () {
    return validate
  }

  export let doc = {}
  let state

  let selection = null

  function defaultExpand (path) {
    return path.length < 1
      ? true
      : (path.length === 1 && path[0] === 0) // first item of an array?
  }

  $: state = syncState(doc, state, [], defaultExpand)
  $: validationErrorsList = validate ? validate(doc) : []
  $: validationErrors = mapValidationErrors(validationErrorsList)

  let showSearch = false
  let searching = false
  let searchText = ''
  let searchResult
  let searchHandler

  function handleSearchProgress (results) {
    searchResult = updateSearchResult(doc, results, searchResult)
  }

  const handleSearchProgressDebounced = throttle(handleSearchProgress, SEARCH_PROGRESS_THROTTLE)
  
  function handleSearchDone (results) {
    searchResult = updateSearchResult(doc, results, searchResult)
    searching = false
    debug('finished search')
  }

  async function handleSearchText (text) {
    searchText = text
    await tick() // await for the search results to be updated
    await focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  async function handleNextSearchResult () {
    searchResult = searchNext(searchResult)
    await focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  async function handlePreviousSearchResult () {
    searchResult = searchPrevious(searchResult)
    await focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  async function focusActiveSearchResult (activeItem) {
    if (activeItem) {
      const path = initial(activeItem)
      state = expandPath(state, path)
      await tick()
      scrollTo(path)
    }
  }

  $: {
    // cancel previous search when still running
    if (searchHandler && searchHandler.cancel) {
      debug('cancel previous search')
      searchHandler.cancel()
    }

    debug('start search', searchText)
    searching = true

    searchHandler = searchAsync(searchText, doc, {
      onProgress: handleSearchProgressDebounced,
      onDone: handleSearchDone,
      maxResults: MAX_SEARCH_RESULTS
    })
  }

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

  export function get () {
    return doc
  }

  export function set (newDocument) {
    doc = newDocument
    searchResult = undefined
    state = undefined
    history.clear()
  }

  export function update (updatedDocument) {
    doc = updatedDocument
    state = syncState(doc, state, [], defaultExpand)
  }

  /**
   * @param {JSONPatchDocument} operations
   * @param {Selection} [newSelection]
   */
  export function patch (operations, newSelection) {
    const prevState = state
    const prevSelection = selection

    debug('operations', operations)

    const documentPatchResult = immutableJSONPatch(doc, operations)
    const statePatchResult = immutableJSONPatch(state, operations)
    // TODO: only apply operations to state for relevant operations: move, copy, delete? Figure out

    doc = documentPatchResult.json
    state = patchKeys(statePatchResult.json, operations)
    if (newSelection) {
      selection = newSelection
    }

    history.add({
      undo: documentPatchResult.revert,
      redo: operations,
      prevState,
      state,
      prevSelection: removeEditModeFromSelection(prevSelection),
      selection: removeEditModeFromSelection(newSelection)
    })

    return {
      doc,
      error: documentPatchResult.error,
      undo: documentPatchResult.revert,
      redo: operations
    }
  }

  // TODO: cleanup logging
  $: debug('doc', doc)
  $: debug('state', state)

  async function handleCut () {
    const clipboard = selectionToPartialJson(doc, selection)
    if (clipboard == null) {
      return
    }

    debug('cut', { selection, clipboard })

    try {
      await navigator.clipboard.writeText(clipboard)
    } catch (err) {
      // TODO: report error to user -> onError callback
      console.error(err)
    }

    const operations = removeAll(selection.paths)
    handlePatch(operations)
    selection = null
  }

  async function handleCopy () {
    const clipboard = selectionToPartialJson(doc, selection)
    if (clipboard == null) {
      return
    }

    debug('copy', { clipboard })

    try {
      await navigator.clipboard.writeText(clipboard)
    } catch (err) {
      // TODO: report error to user -> onError callback
      console.error(err)
    }
  }

  function handlePaste (event) {
    event.preventDefault()

    if (!selection) {
      return
    }

    try {
      const clipboardData = event.clipboardData.getData('text/plain')
      const { operations, newSelection } = createPasteOperations(doc, state, selection, clipboardData)

      debug('paste', { clipboardData, operations, selection, newSelection })

      handlePatch(operations, newSelection)
    } catch (err) {
      // TODO: report error to user -> onError callback
      console.error(err)
    }
  }

  function handlePasteFromMenu () {
    open(CopyPasteModal, {}, {
      ...SIMPLE_MODAL_OPTIONS,
      styleWindow: {
        ...SIMPLE_MODAL_OPTIONS.styleWindow,
        width: '450px'
      }
    })
  }

  function handleRemove () {
    if (!selection || !selection.paths) {
      return
    }

    debug('remove', { selection })

    const operations = removeAll(selection.paths)
    handlePatch(operations)

    selection = null
  }

  function handleDuplicate () {
    if (!selection || !selection.paths) {
      return
    }

    debug('duplicate', { selection })

    const operations = duplicate(doc, state, selection.paths)
    const newSelection = createSelectionFromOperations(operations)

    handlePatch(operations, newSelection)
  }

  /**
   * @param {'value' | 'object' | 'array' | 'structure'} type
   */
  function handleInsert (type) {
    if (selection == null) {
      return
    }

    debug('insert', { type, selection })

    const value = createNewValue(doc, selection, type)
    const values = [
      {
        key: 'new',
        value
      }
    ]
    const operations = insert(doc, state, selection, values)
    const newSelection = createSelectionFromOperations(operations)

    handlePatch(operations, newSelection)

    if (isObjectOrArray(value)) {
      // expand the new object/array in case of inserting a structure
      operations
        .filter(operation => operation.op === 'add')
        .forEach(operation => handleExpand(parseJSONPointer(operation.path), true, true))
    }
  }

  function handleUndo () {
    if (!history.getState().canUndo) {
      return
    }

    const item = history.undo()
    if (!item) {
      return
    }

    doc = immutableJSONPatch(doc, item.undo).json
    state = item.prevState
    selection = item.prevSelection

    debug('undo', { item, doc, state, selection })

    emitOnChange()
  }

  function handleRedo () {
    if (!history.getState().canRedo) {
      return
    }

    const item = history.redo()
    if (!item) {
      return
    }

    doc = immutableJSONPatch(doc, item.redo).json
    state = item.state
    selection = item.selection

    debug('redo', { item, doc, state, selection })

    emitOnChange()
  }

  function handleSort () {
    const rootPath = selection ? findRootPath(selection) : []

    open(SortModal, {
      id: sortModalId,
      json: getIn(doc, rootPath),
      rootPath,
      onSort: async (operations) => {
        debug('onSort', rootPath, operations)
        patch(operations, selection)
      }
    }, {
      ...SIMPLE_MODAL_OPTIONS,
      styleWindow: {
        ...SIMPLE_MODAL_OPTIONS.styleWindow,
        width: '400px'
      }
    })
  }

  function handleTransform () {
    const rootPath = selection ? findRootPath(selection) : []

    open(TransformModal, {
      id: transformModalId,
      json: getIn(doc, rootPath),
      rootPath,
      onTransform: async (operations) => {
        debug('onTransform', rootPath, operations)

        const expanded = getIn(state, rootPath.concat(STATE_EXPANDED))

        patch(operations, selection)

        // keep the root nodes expanded state
        await tick()
        state = setIn(state, rootPath.concat(STATE_EXPANDED), expanded)
      }
    }, {
      ...SIMPLE_MODAL_OPTIONS,
      styleWindow: {
        ...SIMPLE_MODAL_OPTIONS.styleWindow,
        width: '600px'
      }
    })
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

  /**
   * If given path is outside of the visible viewport, scroll up/down.
   * When the path is already in view, nothing is done
   * @param {Path} path
   */
  function scrollIntoView (path) {
    const elem = divContents.querySelector(`div[data-path="${compileJSONPointer(path)}"]`)

    if (elem) {
      const viewPortRect = divContents.getBoundingClientRect()
      const elemRect = elem.getBoundingClientRect()
      const margin = 20
      const elemHeight = isObjectOrArray(getIn(doc, path))
        ? margin // do not use real height when array or object
        : elemRect.height

      if (elemRect.top < viewPortRect.top + margin) {
        // scroll down
        jump(elem, {
          container: divContents,
          offset: -margin,
          duration: 0
        })
      } else if (elemRect.top + elemHeight > viewPortRect.bottom - margin) {
        // scroll up
        jump(elem, {
          container: divContents,
          offset: -(viewPortRect.height - elemHeight - margin),
          duration: 0
        })
      }
    }
  }

  function emitOnChange () {
    // TODO: add more logic here to emit onChange, onChangeJson, onChangeText, etc.
    onChangeJson(doc)
  }

  /**
   * @param {JSONPatchDocument} operations
   * @param {Selection} [newSelection]
   */
  function handlePatch (operations, newSelection) {
    // debug('handlePatch', operations)

    const patchResult = patch(operations, newSelection)

    emitOnChange()

    return patchResult
  }

  function handleUpdateKey (oldKey, newKey) {
    // should never be called on the root
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
      state = setIn(state, path.concat(STATE_EXPANDED), expanded, true)
    }

    if (selection && !expanded) {
      // check whether the selection is still visible and not collapsed
      if (isSelectionInsidePath(selection, path)) {
        // remove selection when not visible anymore
        selection = null
        debug('deselect')
      }
    }
  }

  /**
   * @param {SelectionSchema} selectionSchema
   */
  function handleSelect (selectionSchema) {
    if (selectionSchema) {
      selection = createSelection(doc, state, selectionSchema)
      debug('select', selection)
    } else {
      selection = null
      debug('deselect')
    }

    // set focus to the hidden input, so we can capture quick keys like Ctrl+X, Ctrl+C, Ctrl+V
    setTimeout(() => domHiddenInput.focus())
  }

  function handleExpandSection (path, section) {
    debug('handleExpandSection', path, section)

    state = expandSection(state, path, section)
  }

  function handleKeyDown (event) {
    const combo = keyComboFromEvent(event)
    const keepAnchorPath = event.shiftKey

    if (combo === 'Ctrl+X' || combo === 'Command+X') {
      event.preventDefault()
      handleCut()
    }
    if (combo === 'Ctrl+C' || combo === 'Command+C') {
      event.preventDefault()
      handleCopy()
    }
    // Ctrl+V (paste) is handled by the on:paste event

    if (combo === 'Ctrl+D' || combo === 'Command+D') {
      event.preventDefault()
      handleDuplicate()
    }
    if (combo === 'Delete') {
      event.preventDefault()
      handleRemove()
    }
    if (combo === 'Insert' || combo === 'Insert') {
      event.preventDefault()
      handleInsert('structure')
    }

    if (combo === 'Up' || combo === 'Shift+Up') {
      event.preventDefault()
      selection = selection
        ? getSelectionUp(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
      debug('selection', selection)

      scrollIntoView(selection.focusPath)
    }
    if (combo === 'Down' || combo === 'Shift+Down') {
      event.preventDefault()
      selection = selection
        ? getSelectionDown(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
      debug('selection', selection)

      scrollIntoView(selection.focusPath)
    }
    if (combo === 'Left' || combo === 'Shift+Left') {
      event.preventDefault()
      selection = selection
        ? getSelectionLeft(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
      debug('selection', selection)
    }
    if (combo === 'Right' || combo === 'Shift+Right') {
      event.preventDefault()
      selection = selection
        ? getSelectionRight(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
      debug('selection', selection)
    }

    // TODO: implement Shift+Arrows to select multiple entries

    if (combo === 'Enter' && selection) {
      // when the selection consists of one Array item, change selection to editing its value
      // TODO: this is a bit hacky
      if (selection.paths && selection.paths.length === 1) {
        const path = selection.focusPath
        const parent = getIn(doc, initial(path))
        if (Array.isArray(parent)) {
          // change into selection of the value
          selection = createSelection(doc, state, { valuePath: path })
        }
      }

      if (selection.keyPath) {
        // go to key edit mode
        event.preventDefault()
        selection = {
          ...selection,
          edit: true
        }
      }

      if (selection.valuePath) {
        event.preventDefault()

        const value = getIn(doc, selection.valuePath)
        if (isObjectOrArray(value)) {
          // expand object/array
          handleExpand(selection.valuePath, true)
        } else {
          // go to value edit mode
          selection = {
            ...selection,
            edit: true
          }
        }
      }
    }

    if (combo === 'Ctrl+Enter' && selection && selection.valuePath) {
      const value = getIn(doc, selection.valuePath)

      if (isUrl(value)) {
        // open url in new page
        window.open(value, '_blank')
      }
    }

    if (combo === 'Escape' && selection) {
      event.preventDefault()
      selection = null
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
  <Menu 
    historyState={historyState}
    searchText={searchText}
    searching={searching}
    searchResult={searchResult}
    bind:showSearch

    selection={selection}
    
    onCut={handleCut}
    onCopy={handleCopy}
    onPaste={handlePasteFromMenu}
    onRemove={handleRemove}
    onDuplicate={handleDuplicate}
    onInsert={handleInsert}
    onUndo={handleUndo}
    onRedo={handleRedo}
    onSort={handleSort}
    onTransform={handleTransform}

    onSearchText={handleSearchText}
    onNextSearchResult={handleNextSearchResult}
    onPreviousSearchResult={handlePreviousSearchResult}
  />
  <label class="hidden-input-label">
    <input
      class="hidden-input"
      tabindex="-1"
      bind:this={domHiddenInput}
      on:paste={handlePaste}
    />
  </label>
  <div class="contents" bind:this={divContents}>
    <JSONNode
      value={doc}
      path={[]}
      state={state}
      searchResult={searchResult && searchResult.itemsWithActive}
      validationErrors={validationErrors}
      onPatch={handlePatch}
      onUpdateKey={handleUpdateKey}
      onExpand={handleExpand}
      onSelect={handleSelect}
      onExpandSection={handleExpandSection}
      selection={selection}
    />
  </div>
</div>

<style src="./JSONEditor.scss"></style>

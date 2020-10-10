<svelte:options immutable={true} />

<script>
  import { getContext, tick } from 'svelte'
  import {
    duplicate,
    insert,
    createNewValue,
    removeAll
  } from '../../logic/operations.js'
  import {
    STATE_EXPANDED,
    STATE_LIMIT,
    SCROLL_DURATION,
    SIMPLE_MODAL_OPTIONS,
    SEARCH_PROGRESS_THROTTLE,
    MAX_SEARCH_RESULTS
  } from '../../constants.js'
  import { createHistory } from '../../logic/history.js'
  import JSONNode from './JSONNode.svelte'
  import {
    createPathsMap,
    createSelectionFromOperations,
    expandSelection,
findRootPath
  } from '../../logic/selection.js'
  import { isContentEditableDiv, isTextInput } from '../../utils/domUtils.js'
  import {
    getIn,
    setIn,
    updateIn
  } from '../../utils/immutabilityHelpers.js'
  import { compileJSONPointer, parseJSONPointer } from '../../utils/jsonPointer.js'
  import { keyComboFromEvent } from '../../utils/keyBindings.js'
  import { searchAsync, searchNext, searchPrevious, updateSearchResult } from '../../logic/search.js'
  import { immutableJSONPatch } from '../../utils/immutableJSONPatch'
  import { last, initial, cloneDeep, uniqueId, throttle } from 'lodash-es'
  import jump from '../../assets/jump.js/src/jump.js'
  import { expandPath, syncState, patchProps } from '../../logic/documentState.js'
  import Menu from './Menu.svelte'
  import { isObjectOrArray } from '../../utils/typeUtils.js'
  import { mapValidationErrors } from '../../logic/validation.js'
  import SortModal from '../modals/SortModal.svelte'
  import TransformModal from '../modals/TransformModal.svelte'

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
  let state = undefined

  let selection = null
  let clipboard = null

  $: state = syncState(doc, state, [], (path) => path.length < 1)
  $: validationErrorsList = validate ? validate(doc) : []
  $: validationErrors = mapValidationErrors(validationErrorsList)

  let showSearch = false
  let searching = false
  let searchText = ''
  let searchResult = undefined
  let searchHandler = undefined

  function handleSearchProgress (results) {
    searchResult = updateSearchResult(doc, results, searchResult)
  }

  const handleSearchProgressDebounced = throttle(handleSearchProgress, SEARCH_PROGRESS_THROTTLE)
  
  function handleSearchDone (results) {
    searchResult = updateSearchResult(doc, results, searchResult)
    searching = false
    console.log('finished search')
  }

  async function handleSearchText (text) {
    searchText = text
    await tick() // await for the search results to be updated
    focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  async function handleNextSearchResult () {
    searchResult = searchNext(searchResult)
    focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  function handlePreviousSearchResult () {
    searchResult = searchPrevious(searchResult)
    focusActiveSearchResult(searchResult && searchResult.activeItem)
  }

  async function focusActiveSearchResult (activeItem) {
    if (activeItem) {
      state = expandPath(state, initial(activeItem))
      await tick()
      scrollTo(activeItem)
    }
  }

  $: {
    // cancel previous search when still running
    if (searchHandler && searchHandler.cancel) {
      console.log('cancel previous search')
      searchHandler.cancel()
    }

    console.log('start search', searchText)
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

  export function get() {
    return doc
  }

  export function set(newDocument) {
    doc = newDocument
    searchResult = undefined
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
      console.log('cut', { selection, clipboard })

      clipboard = selectionToClipboard(selection)
      
      const operations = removeAll(selection.paths)
      handlePatch(operations)
      selection = null
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

      const operations = insert(doc, state, selection, clipboard)
      const newSelection = createSelectionFromOperations(operations)

      handlePatch(operations, newSelection)
    }
  }

  function handleRemove() {
    if (selection && selection.paths) {
      console.log('remove', { selection })

      const operations = removeAll(selection.paths)
      handlePatch(operations)
      
      selection = null
    }
  }

  function handleDuplicate() {
    if (selection && selection.paths) {
      console.log('duplicate', { selection })

      const operations = duplicate(doc, state, selection.paths)
      const newSelection = createSelectionFromOperations(operations)

      handlePatch(operations, newSelection)
    }
  }

  /**
   * @param {'value' | 'object' | 'array' | 'structure'} type
   */ 
  function handleInsert(type) {
    if (selection != null) {
      console.log('insert', { type, selection })

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
  }

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

  function handleSort () {
    const rootPath = findRootPath(selection)

    open(SortModal, {
      id: sortModalId,
      json: getIn(doc, rootPath),
      rootPath,
      onSort: async (operations) => {
        console.log('onSort', rootPath, operations)
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
    const rootPath = findRootPath(selection)

    open(TransformModal, {
      id: transformModalId,
      json: getIn(doc, rootPath),
      rootPath,
      onTransform: async (operations) => {
        console.log('onTransform', rootPath, operations)

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
  }

  /**
   * Change limit
   * @param {Path} path
   * @param {boolean} limit
   */
  function handleLimit (path, limit) {
    state = setIn(state, path.concat(STATE_LIMIT), limit, true)
  }

  /**
   * @param {SelectionSchema} selectionSchema
   */
  function handleSelect (selectionSchema) {
    if (selectionSchema) {
      const { anchorPath, focusPath, beforePath, appendPath } = selectionSchema

      if (beforePath) {
        selection = { beforePath }
      } else if (appendPath) {
        selection = { appendPath }
      } else if (anchorPath && focusPath) {
        const paths = expandSelection(doc, state, anchorPath, focusPath)

        selection = {
          paths,
          pathsMap: createPathsMap(paths)
        }
      } else {
        console.error('Unknown type of selection', selectionSchema)
      }

      // set focus to the hidden input, so we can capture quick keys like Ctrl+X, Ctrl+C, Ctrl+V
      setTimeout(() => domHiddenInput.focus())
    } else {
      selection = null
    }
  }

  function handleKeyDown (event) {
    const combo = keyComboFromEvent(event)

    if (!isContentEditableDiv(event.target) && !isTextInput(event.target)) {
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
      if (combo === 'Escape') {
        event.preventDefault()
        selection = null
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
  <Menu 
    historyState={historyState}
    searchText={searchText}
    searching={searching}
    searchResult={searchResult}
    bind:showSearch

    selection={selection}
    clipboard={clipboard}
    
    onCut={handleCut}
    onCopy={handleCopy}
    onPaste={handlePaste}
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
      class:visible={!!selection}
      bind:this={domHiddenInput}
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
      onLimit={handleLimit}
      onSelect={handleSelect}
      selection={selection}
    />
  </div>
</div>

<style src="./TreeMode.scss"></style>

<svelte:options immutable={true} />

<script>
  import createDebug from 'debug'
  import { immutableJSONPatch, revertJSONPatch } from 'immutable-json-patch'
  import { initial, throttle, uniqueId } from 'lodash-es'
  import { getContext, onDestroy, onMount, tick } from 'svelte'
  import jump from '../../assets/jump.js/src/jump.js'
  import {
    MAX_SEARCH_RESULTS,
    SCROLL_DURATION,
    SEARCH_PROGRESS_THROTTLE,
    SIMPLE_MODAL_OPTIONS,
    STATE_EXPANDED, STATE_VISIBLE_SECTIONS
  } from '../../constants.js'
  import {
    documentStatePatch,
    expandPath,
    expandSection,
    syncState
  } from '../../logic/documentState.js'
  import { createHistory } from '../../logic/history.js'
  import {
    createNewValue,
    createRemoveOperations,
    duplicate,
    insert
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
    selectAll,
    SELECTION_TYPE,
    selectionToPartialJson
  } from '../../logic/selection.js'
  import { mapValidationErrors } from '../../logic/validation.js'
  import {
    activeElementIsChildOf,
    getWindow,
    isChildOfNodeName,
    setCursorToEnd
  } from '../../utils/domUtils.js'
  import { getIn, setIn, updateIn } from '../../utils/immutabilityHelpers.js'
  import {
    compileJSONPointer,
    parseJSONPointerWithArrayIndices
  } from '../../utils/jsonPointer.js'
  import { keyComboFromEvent } from '../../utils/keyBindings.js'
  import { isObjectOrArray, isUrl } from '../../utils/typeUtils.js'
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
  let domJsonEditor
  let focus = false

  export let validate = null
  export let onChangeJson = () => {}
  export let onFocus = () => {}
  export let onBlur = () => {}

  onMount(() => {
    debug('register global focus listeners')
    const window = getWindow(domJsonEditor)
    window.addEventListener('focusin', handleFocusIn, true)
    window.addEventListener('focusout', handleFocusOut, true)
  })

  onDestroy(() => {
    debug('unregister global focus listeners')
    const window = getWindow(domJsonEditor)
    window.removeEventListener('focusin', handleFocusIn, true)
    window.removeEventListener('focusout', handleFocusOut, true)
  })

  let blurTimeoutHandle

  function handleFocusIn () {
    const newFocus = activeElementIsChildOf(domJsonEditor)

    if (newFocus) {
      clearTimeout(blurTimeoutHandle)
      if (!focus) {
        debug('focus')
        onFocus()
        focus = newFocus
      }
    }
  }

  function handleFocusOut () {
    if (focus) {
      // We set focus to false after timeout. Often, you get a blur and directly
      // another focus when moving focus from one button to another.
      // The focusIn handler will cancel any pending blur timer in those cases
      clearTimeout(blurTimeoutHandle)
      blurTimeoutHandle = setTimeout(() => {
        debug('blur')
        focus = false
        onBlur()
      })
    }
  }

  export function setValidator (newValidate) {
    validate = newValidate
  }

  export function getValidator () {
    return validate
  }

  export let doc = {}
  let state = syncState(doc, undefined, [], defaultExpand)

  let selection = null

  function defaultExpand (path) {
    return path.length < 1
      ? true
      : (path.length === 1 && path[0] === 0) // first item of an array?
  }

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
      state = expandPath(doc, state, path)
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
    state = syncState(doc, undefined, [], defaultExpand)
    searchResult = undefined
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

    debug('patch', operations, newSelection)

    const undo = revertJSONPatch(doc, operations)
    const update = documentStatePatch(doc, state, operations)
    doc = update.doc
    state = update.state

    if (newSelection) {
      selection = newSelection
    }

    history.add({
      undo,
      redo: operations,
      prevState,
      state,
      prevSelection: removeEditModeFromSelection(prevSelection),
      selection: removeEditModeFromSelection(newSelection || selection)
    })

    return {
      doc,
      undo,
      redo: operations
    }
  }

  // TODO: cleanup logging
  $: debug('doc', doc)
  $: debug('state', state)
  $: debug('selection', selection)

  async function handleCut () {
    if (!selection) {
      return
    }

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

    const { operations, newSelection } = createRemoveOperations(doc, state, selection)
    handlePatch(operations, newSelection)
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
      const clipboardText = event.clipboardData.getData('text/plain')
      const operations = insert(doc, state, selection, clipboardText)

      debug('paste', { clipboardText, operations, selection })

      handlePatch(operations)

      // expand newly inserted object/array
      operations
        .filter(operation => isObjectOrArray(operation.value))
        .forEach(async operation => {
          const path = parseJSONPointerWithArrayIndices(doc, operation.path)
          handleExpand(path, true, false)
        })
    } catch (err) {
      // TODO: report error to user -> onError callback
      console.error(err)
    }
  }

  function handleRemove () {
    if (!selection) {
      return
    }

    const { operations, newSelection } = createRemoveOperations(doc, state, selection)

    debug('remove', { operations, selection, newSelection })

    handlePatch(operations, newSelection)
  }

  function handleDuplicate () {
    if (!selection || selection.type !== SELECTION_TYPE.MULTI) {
      return
    }

    debug('duplicate', { selection })

    const operations = duplicate(doc, state, selection.paths)

    handlePatch(operations)
  }

  /**
   * @param {'value' | 'object' | 'array' | 'structure'} type
   */
  function handleInsert (type) {
    if (!selection) {
      return
    }

    const newValue = createNewValue(doc, selection, type)
    const data = JSON.stringify(newValue)
    const operations = insert(doc, state, selection, data)
    debug('handleInsert', { type, operations, newValue, data })

    handlePatch(operations)

    operations
      .filter(operation => (operation.op === 'add' || operation.op === 'replace'))
      .forEach(async operation => {
        const path = parseJSONPointerWithArrayIndices(doc, operation.path)

        if (isObjectOrArray(newValue)) {
          // expand newly inserted object/array
          handleExpand(path, true, true)
        }

        if (newValue === '') {
          // open the newly inserted value in edit mode
          const parentPath = initial(path)
          const parent = getIn(doc, parentPath)

          selection = createSelection(doc, state, {
            type: Array.isArray(parent) ? SELECTION_TYPE.VALUE : SELECTION_TYPE.KEY,
            path,
            edit: true
          })

          await tick()
          setTimeout(() => replaceActiveElementContents(''))
        }
      })
  }

  function replaceActiveElementContents (char) {
    const activeElement = getWindow(domJsonEditor).document.activeElement
    if (activeElement.isContentEditable) {
      activeElement.textContent = char
      setCursorToEnd(activeElement)
      // FIXME: should trigger an oninput, else the component will not update it's newKey/newValue variable
    }
  }

  async function handleInsertCharacter (char) {
    // a regular key like a, A, _, etc is entered.
    // Replace selected contents with a new value having this first character as text
    if (!selection) {
      return
    }

    if (selection.type === SELECTION_TYPE.KEY) {
      selection = { ...selection, edit: true }
      await tick()
      setTimeout(() => replaceActiveElementContents(char))
      return
    }

    if (char === '{') {
      handleInsert('object')
    } else if (char === '[') {
      handleInsert('array')
    } else {
      if (
        selection.type === SELECTION_TYPE.VALUE &&
        !isObjectOrArray(getIn(doc, selection.focusPath))
      ) {
        selection = { ...selection, edit: true }
        await tick()
        setTimeout(() => replaceActiveElementContents(char))
      } else {
        await handleInsertValueWithCharacter(char)
      }
    }
  }

  async function handleInsertValueWithCharacter (char) {
    // first insert a new value
    handleInsert('value')

    // next, open the new value in edit mode and apply the current character
    const path = selection.focusPath
    const parent = getIn(doc, initial(path))
    selection = createSelection(doc, state, {
      type: (Array.isArray(parent) || selection.type === SELECTION_TYPE.VALUE)
        ? SELECTION_TYPE.VALUE
        : SELECTION_TYPE.KEY,
      path,
      edit: true
    })

    await tick()
    setTimeout(() => replaceActiveElementContents(char))
  }

  function handleUndo () {
    if (!history.getState().canUndo) {
      return
    }

    const item = history.undo()
    if (!item) {
      return
    }

    doc = immutableJSONPatch(doc, item.undo)
    state = item.prevState
    selection = item.prevSelection

    debug('undo', { item, doc, state, selection })

    emitOnChange()

    domHiddenInput.focus()
  }

  function handleRedo () {
    if (!history.getState().canRedo) {
      return
    }

    const item = history.redo()
    if (!item) {
      return
    }

    doc = immutableJSONPatch(doc, item.redo)
    state = item.state
    selection = item.selection

    debug('redo', { item, doc, state, selection })

    emitOnChange()

    domHiddenInput.focus()
  }

  function handleSort () {
    const rootPath = selection ? findRootPath(selection) : []

    open(SortModal, {
      id: sortModalId,
      json: getIn(doc, rootPath),
      rootPath,
      onSort: async (operations) => {
        const visibleSectionsPath = rootPath.concat([STATE_VISIBLE_SECTIONS])
        const visibleSections = getIn(state, visibleSectionsPath)

        debug('onSort', rootPath, operations)
        patch(operations, selection)

        // restore the original visible sections
        state = setIn(state, visibleSectionsPath, visibleSections)
      }
    }, {
      ...SIMPLE_MODAL_OPTIONS,
      styleWindow: {
        ...SIMPLE_MODAL_OPTIONS.styleWindow,
        width: '400px'
      }
    }, {
      onClose: () => domHiddenInput.focus()
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

        patch(operations)

        if (expanded) {
          // keep the root nodes expanded state
          await tick()
          handleExpand(rootPath, true)
          // FIXME: because we apply expand *after* the patch, when doing undo/redo, the expanded state is not restored
        }
      }
    }, {
      ...SIMPLE_MODAL_OPTIONS,
      styleWindow: {
        ...SIMPLE_MODAL_OPTIONS.styleWindow,
        width: '600px'
      },
      styleContent: {
        overflow: 'auto', // TODO: would be more neat if the header is fixed instead of scrolls along
        padding: 0
      }
    }, {
      onClose: () => domHiddenInput.focus()
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
   * @param {Selection} [newSelection] If no new selection is provided,
   *                                   The new selection will be determined
   *                                   based on the operations.
   */
  function handlePatch (
    operations,
    newSelection = createSelectionFromOperations(doc, operations)
  ) {
    debug('handlePatch', operations, newSelection)

    const patchResult = patch(operations, newSelection)

    emitOnChange()

    return patchResult
  }

  /**
   * Toggle expanded state of a node
   * @param {Path} path
   * @param {boolean} expanded  True to expand, false to collapse
   * @param {boolean} [recursive=false]  Only applicable when expanding
   */
  function handleExpand (path, expanded, recursive = false) {
    // TODO: move this function into documentState.js
    if (recursive) {
      state = updateIn(state, path, (childState) => {
        return syncState(getIn(doc, path), childState, [], () => expanded, true)
      })
    } else {
      state = setIn(state, path.concat(STATE_EXPANDED), expanded, true)

      state = updateIn(state, path, (childState) => {
        return syncState(getIn(doc, path), childState, [], defaultExpand, false)
      })
    }

    if (selection && !expanded) {
      // check whether the selection is still visible and not collapsed
      if (isSelectionInsidePath(selection, path)) {
        // remove selection when not visible anymore
        selection = null
      }
    }

    // set focus to the hidden input, so we can capture quick keys like Ctrl+X, Ctrl+C, Ctrl+V
    setTimeout(() => {
      if (!activeElementIsChildOf(domJsonEditor)) {
        domHiddenInput.focus()
      }
    })
  }

  /**
   * @param {SelectionSchema} selectionSchema
   */
  function handleSelect (selectionSchema) {
    if (selectionSchema) {
      selection = createSelection(doc, state, selectionSchema)
    } else {
      selection = null
    }

    // set focus to the hidden input, so we can capture quick keys like Ctrl+X, Ctrl+C, Ctrl+V
    setTimeout(() => domHiddenInput.focus())
  }

  function handleExpandSection (path, section) {
    debug('handleExpandSection', path, section)

    state = expandSection(doc, state, path, section)
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
    if (combo === 'Ctrl+A' || combo === 'Command+A') {
      event.preventDefault()
      selection = selectAll()
    }

    if (combo === 'Up' || combo === 'Shift+Up') {
      event.preventDefault()
      selection = selection
        ? getSelectionUp(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)

      scrollIntoView(selection.focusPath)
    }
    if (combo === 'Down' || combo === 'Shift+Down') {
      event.preventDefault()
      selection = selection
        ? getSelectionDown(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)

      scrollIntoView(selection.focusPath)
    }
    if (combo === 'Left' || combo === 'Shift+Left') {
      event.preventDefault()
      selection = selection
        ? getSelectionLeft(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
    }
    if (combo === 'Right' || combo === 'Shift+Right') {
      event.preventDefault()
      selection = selection
        ? getSelectionRight(doc, state, selection, keepAnchorPath) || selection
        : getInitialSelection(doc, state)
    }

    if (combo === 'Enter' && selection) {
      // when the selection consists of one Array item, change selection to editing its value
      // TODO: this is a bit hacky
      if (selection.type === SELECTION_TYPE.MULTI && selection.paths.length === 1) {
        const path = selection.focusPath
        const parent = getIn(doc, initial(path))
        if (Array.isArray(parent)) {
          // change into selection of the value
          selection = createSelection(doc, state, { type: SELECTION_TYPE.VALUE, path })
        }
      }

      if (selection.type === SELECTION_TYPE.KEY) {
        // go to key edit mode
        event.preventDefault()
        selection = {
          ...selection,
          edit: true
        }
      }

      if (selection.type === SELECTION_TYPE.VALUE) {
        event.preventDefault()

        const value = getIn(doc, selection.focusPath)
        if (isObjectOrArray(value)) {
          // expand object/array
          handleExpand(selection.focusPath, true)
        } else {
          // go to value edit mode
          selection = {
            ...selection,
            edit: true
          }
        }
      }
    }

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && selection) {
      // a regular key like a, A, _, etc is entered.
      // Replace selected contents with a new value having this first character as text
      event.preventDefault()
      handleInsertCharacter(event.key)
    }

    if (combo === 'Enter' && (selection.type === SELECTION_TYPE.AFTER || selection.type === SELECTION_TYPE.INSIDE)) {
      // Enter on an insert area -> open the area in edit mode
      event.preventDefault()
      handleInsertCharacter('')
    }

    if (combo === 'Ctrl+Enter' && selection && selection.type === SELECTION_TYPE.VALUE) {
      const value = getIn(doc, selection.focusPath)

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

  function handleMouseDown (event) {
    setTimeout(() => {
      if (!focus && !isChildOfNodeName(event.target, 'BUTTON')) {
        // for example when clicking on the empty area in the main menu
        domHiddenInput.focus()
      }
    })
  }
</script>

<div
  class="jsoneditor"
  on:keydown={handleKeyDown}
  on:mousedown={handleMouseDown}
  bind:this={domJsonEditor}
  class:focus
>
  <Menu 
    historyState={historyState}
    searchText={searchText}
    searching={searching}
    searchResult={searchResult}
    bind:showSearch

    selection={selection}
    
    onCut={handleCut}
    onCopy={handleCopy}
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
      onInsert={handleInsert}
      onExpand={handleExpand}
      onSelect={handleSelect}
      onExpandSection={handleExpandSection}
      selection={selection}
    />
  </div>
</div>

<style src="./JSONEditor.scss"></style>

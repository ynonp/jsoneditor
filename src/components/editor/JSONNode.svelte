<svelte:options immutable={true} />

<script>
  import {
    faCaretDown,
    faCaretRight,
    faExclamationTriangle
  } from '@fortawesome/free-solid-svg-icons'
  import classnames from 'classnames'
  import { first, isEmpty, isEqual } from 'lodash-es'
  import { onDestroy, tick } from 'svelte'
  import Icon from 'svelte-awesome'
  import {
    ACTIVE_SEARCH_RESULT,
    INDENTATION_WIDTH,
    STATE_EXPANDED,
    STATE_ID,
    STATE_KEYS,
    STATE_SEARCH_PROPERTY,
    STATE_SEARCH_VALUE,
    STATE_VISIBLE_SECTIONS,
    VALIDATION_ERROR,
    INSERT_EXPLANATION
  } from '../../constants.js'
  import { rename } from '../../logic/operations.js'
  import { SELECTION_TYPE } from '../../logic/selection.js'
  import {
    getPlainText,
    isChildOfAttribute,
    isChildOfNodeName,
    isContentEditableDiv,
    setCursorToEnd,
    setPlainText
  } from '../../utils/domUtils.js'
  import { compileJSONPointer } from '../../utils/jsonPointer'
  import { findUniqueName } from '../../utils/stringUtils.js'
  import { isUrl, stringConvert, valueType } from '../../utils/typeUtils'
  import CollapsedItems from './CollapsedItems.svelte'
  import { singleton } from './singleton.js'

  // eslint-disable-next-line no-undef-init
  export let key = undefined // only applicable for object properties
  export let value
  export let path
  export let state
  export let searchResult
  export let validationErrors
  export let onPatch
  export let onInsert
  export let onUpdateKey
  export let onExpand
  export let onSelect

  /** @type {function (path: Path, section: Section)} */
  export let onExpandSection

  export let selection

  // FIXME: this is not efficient. Create a nested object with the selection and pass that
  $: selected = (selection && selection.pathsMap)
    ? selection.pathsMap[compileJSONPointer(path)] === true
    : false

  $: selectedBefore = (selection && selection.type === SELECTION_TYPE.BEFORE)
    ? isEqual(selection.path, path)
    : false

  $: selectedAppend = (selection && selection.type === SELECTION_TYPE.APPEND)
    ? isEqual(selection.path, path)
    : false

  $: selectedKey = (selection && selection.type === SELECTION_TYPE.KEY)
    ? isEqual(selection.path, path)
    : false

  $: selectedValue = (selection && selection.type === SELECTION_TYPE.VALUE)
    ? isEqual(selection.path, path)
    : false

  $: editKey = selectedKey && selection && selection.edit === true
  $: editValue = selectedValue && selection && selection.edit === true

  $: expanded = state[STATE_EXPANDED]
  $: expanded = state[STATE_EXPANDED]
  $: visibleSections = state[STATE_VISIBLE_SECTIONS]
  $: keys = state[STATE_KEYS]
  $: validationError = validationErrors && validationErrors[VALIDATION_ERROR]

  onDestroy(() => {
    updateKey()
    updateValue()
  })

  function focusKey () {
    hovered = false

    // TODO: this timeout is ugly
    setTimeout(() => {
      if (domKey) {
        setCursorToEnd(domKey)
      }
    })
  }

  function focusValue () {
    hovered = false

    // TODO: this timeout is ugly
    setTimeout(() => {
      if (domValue) {
        setCursorToEnd(domValue)
      }
    })
  }

  let newKey = key
  let newValue = value

  let domKey
  let domValue
  let hovered = false

  $: type = valueType(value)
  $: valueIsUrl = isUrl(value)

  let keyClass
  $: keyClass = getKeyClass(key, searchResult)

  let valueClass
  $: valueClass = getValueClass(value, searchResult)

  $: if (editKey === true) {
    // edit changed to true -> set focus to end of input
    focusKey()
  }

  $: if (editValue === true) {
    focusValue()
  }

  $: if (domKey) {
    setDomKeyIfNotEditing(key)
  }

  $: if (domValue) {
    setDomValueIfNotEditing(value)
  }

  $: if (editKey === false) {
    updateKey()
  }

  $: if (editValue === false) {
    updateValue()
  }

  function getDomKey () {
    if (!domKey) {
      return key
    }

    return getPlainText(domKey)
  }

  function setDomKeyIfNotEditing (updatedKey) {
    if (editKey === false) {
      setDomKey(updatedKey)
    }
  }

  function setDomValueIfNotEditing (updatedValue) {
    if (editValue === false) {
      setDomValue(updatedValue)
    }
  }

  function setDomKey (updatedKey) {
    if (domKey) {
      setPlainText(domKey, updatedKey)
    }
  }

  function setDomValue (updatedValue) {
    if (domValue) {
      setPlainText(domValue, updatedValue)
    }
  }

  function getDomValue () {
    if (!domValue) {
      return value
    }

    const valueText = getPlainText(domValue)
    return stringConvert(valueText) // TODO: implement support for type "string"
  }

  function getIndentationStyle (level) {
    return `margin-left: ${level * INDENTATION_WIDTH}px`
  }

  function getValueClass (value, searchResult) {
    const type = valueType(value)

    return classnames(SELECTION_TYPE.VALUE, type, {
      search: searchResult && searchResult[STATE_SEARCH_VALUE],
      active: searchResult && searchResult[STATE_SEARCH_VALUE] === ACTIVE_SEARCH_RESULT,
      url: isUrl(value),
      empty: typeof value === 'string' && value.length === 0
    })
  }

  function getKeyClass (key, searchResult) {
    return classnames('key', {
      search: searchResult && searchResult[STATE_SEARCH_PROPERTY],
      active: searchResult && searchResult[STATE_SEARCH_PROPERTY] === ACTIVE_SEARCH_RESULT,
      empty: key === ''
    })
  }

  function toggleExpand (event) {
    event.stopPropagation()

    const recursive = event.ctrlKey
    onExpand(path, !expanded, recursive)
  }

  function handleExpand (event) {
    event.stopPropagation()

    onExpand(path, true)
  }

  function updateKey () {
    if (type === 'object' && key !== newKey) {
      // must be handled by the parent which has knowledge about the other keys
      const uniqueKey = onUpdateKey(key, newKey)
      if (uniqueKey !== newKey) {
        setDomKey(uniqueKey)
      }
    }
  }

  function handleUpdateKey (oldKey, newKey) {
    const newKeyUnique = findUniqueName(newKey, value)

    onPatch(rename(path, keys, oldKey, newKeyUnique))

    return newKeyUnique
  }

  function handleKeyInput () {
    newKey = getDomKey()
    if (newKey === '') {
      // immediately update to cleanup any left over <br/>
      setDomKey('')
    }
  }

  async function handleKeyKeyDown (event) {
    event.stopPropagation()

    if (event.key === 'Escape') {
      // cancel changes
      setDomKey(key)
      onSelect({ type: SELECTION_TYPE.KEY, path })
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      updateKey()

      // we apply selection on next tick, since the actual path will change
      await tick()
      onSelect({ type: SELECTION_TYPE.KEY, path, next: true })
    }
  }

  function handleKeyDoubleClick (event) {
    if (!editKey) {
      event.preventDefault()
      onSelect({ type: SELECTION_TYPE.KEY, path, edit: true })
    }
  }

  function updateValue () {
    if (newValue !== value) {
      onPatch([{
        op: 'replace',
        path: compileJSONPointer(path),
        value: newValue
      }])
    }
  }

  function handleValueInput () {
    newValue = getDomValue()
    if (newValue === '') {
      // immediately update to cleanup any left over <br/>
      setDomValue('')
    }
  }

  function handleValueDoubleClick (event) {
    if (!editValue) {
      event.preventDefault()
      onSelect({ type: SELECTION_TYPE.VALUE, path, edit: true })
    }
  }

  function handleValueClick (event) {
    if (valueIsUrl && event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()

      window.open(value, '_blank')
    }
  }

  function handleValueKeyDown (event) {
    event.stopPropagation()

    if (event.key === 'Escape') {
      // cancel changes
      setDomValue(value)
      onSelect({ type: SELECTION_TYPE.VALUE, path })
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      // apply changes
      updateValue()

      onSelect({ type: SELECTION_TYPE.VALUE, path, next: true })
    }
  }

  function handleMouseDown (event) {
    // check if the mouse down is not happening in the key or value input fields or on a button
    if (isContentEditableDiv(event.target) || isChildOfNodeName(event.target, 'BUTTON')) {
      return
    }

    singleton.mousedown = true
    singleton.selectionAnchor = path
    singleton.selectionFocus = null

    if (event.shiftKey) {
      // Shift+Click will select multiple entries
      onSelect({
        anchorPath: selection.anchorPath,
        focusPath: path
      })
    } else if (event.target === domKey) {
      onSelect({ type: SELECTION_TYPE.KEY, path })
    } else if (event.target === domValue) {
      onSelect({ type: SELECTION_TYPE.VALUE, path })
    } else if (isChildOfAttribute(event.target, 'data-type', 'selectable-value')) {
      onSelect({ type: SELECTION_TYPE.VALUE, path })
    } else if (
      isChildOfAttribute(event.target, 'data-type', 'insert-button-area') ||
      isChildOfAttribute(event.target, 'data-type', 'insert-area')
    ) {
      // do nothing: event already handled by event listener on the element itself
    } else {
      onSelect(null)
    }

    event.stopPropagation()
    event.preventDefault()

    // we attache the mouse up event listener to the global document,
    // so we will not miss if the mouse up is happening outside of the editor
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove (event) {
    if (singleton.mousedown) {
      event.preventDefault()
      event.stopPropagation()

      if (singleton.selectionFocus == null) {
        // First move event, no selection yet.
        // Clear the default selection of the browser
        if (window.getSelection) {
          window.getSelection().empty()
        }
      }

      if (!isEqual(path, singleton.selectionFocus)) {
        singleton.selectionFocus = path

        onSelect({
          anchorPath: singleton.selectionAnchor,
          focusPath: singleton.selectionFocus
        })
      }
    }
  }

  function handleMouseUp (event) {
    if (singleton.mousedown) {
      event.stopPropagation()

      singleton.mousedown = false
    }

    document.removeEventListener('mouseup', handleMouseUp)
  }

  function handleMouseOver (event) {
    event.stopPropagation()

    if (!editKey && !editValue) {
      hovered = true
    }
  }

  function handleMouseOut (event) {
    event.stopPropagation()
    hovered = false
  }
  
  function handleInsertInside () {
    console.log('handleInsertInside', path)
    if (type === 'array') {
      if (value.length > 0) {
        // insert before the first item
        console.log('BEFORE', path)
        onSelect({ type: SELECTION_TYPE.BEFORE, path: path.concat([0]) })
      } else {
        // empty array -> append to the array
        onSelect({ type: SELECTION_TYPE.APPEND, path })
      }
    } else {
      const keys = state[STATE_KEYS]
      if (!isEmpty(keys)) {
        // insert before the first key
        const firstKey = first(keys)
        onSelect({ type: SELECTION_TYPE.BEFORE, path: path.concat([firstKey]) })
      } else {
        // empty object -> append to the object
        onSelect({ type: SELECTION_TYPE.APPEND, path })
      }
    }
  }

  function handleInsertAfter (keyOrIndex) {
    if (type === 'array') {
      // +1 because we want to insert *after* the current item,
      // which is *before* the next item

      if (keyOrIndex < value.length - 1) {
        onSelect({ type: SELECTION_TYPE.BEFORE, path: path.concat(keyOrIndex + 1) })
      } else {
        onSelect({ type: SELECTION_TYPE.APPEND, path })
      }
    } else {
      // find the next key, so we can insert before this next key
      const keys = state[STATE_KEYS]
      const index = keys.indexOf(keyOrIndex)
      const nextKey = keys[index + 1]

      if (typeof nextKey === 'string') {
        onSelect({ type: SELECTION_TYPE.BEFORE, path: path.concat(nextKey) })
      } else {
        onSelect({ type: SELECTION_TYPE.APPEND, path })
      }
    }
  }

  $: indentationStyle = getIndentationStyle(path.length)
</script>

<div
  class='json-node'
  data-path={compileJSONPointer(path)}
  class:root={path.length === 0}
  class:selected={selected}
  class:selected-key={selectedKey}
  class:selected-value={selectedValue}
  class:hovered={hovered}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseover={handleMouseOver}
  on:mouseout={handleMouseOut}
>
  {#if selectedBefore}
    <div
      class="insert-area before"
      data-type="insert-area"
      style={indentationStyle}
      title={INSERT_EXPLANATION}
    ></div>
  {/if}
  {#if type === 'array'}
    <div class='header-outer' style={indentationStyle} >
      <div class='header'>
        <button
          class='expand'
          on:click={toggleExpand}
          title='Expand or collapse this array (Ctrl+Click to expand/collapse recursively)'
        >
          {#if expanded}
            <Icon data={faCaretDown} />
          {:else}
            <Icon data={faCaretRight} />
          {/if}
        </button>
        {#if typeof key === 'string'}
          <div
            class={keyClass}
            contenteditable={editKey}
            spellcheck="false"
            on:input={handleKeyInput}
            on:dblclick={handleKeyDoubleClick}
            on:keydown={handleKeyKeyDown}
            bind:this={domKey}
          ></div>
          <div class="separator">:</div>
        {/if}
        <div class="meta">
          <div class="meta-inner" data-type="selectable-value">
            {#if expanded}
              <div class="bracket expanded">
                [
              </div>
            {:else}
              <div class="bracket">[</div>
              <button class="tag" on:click={handleExpand}>{value.length} items</button>
              <div class="bracket">]</div>
            {/if}
          </div>
        </div>
      </div>
      {#if expanded}
        <div
          class="insert-button-area inside"
          data-type="insert-button-area"
          on:mousedown|preventDefault={() => handleInsertInside(key)}
        >
          <button class="insert-button">&#8617;</button>
        </div>
      {:else}
        {#if validationError}
          <!-- FIXME: implement proper tooltip -->
          <button
            class='validation-error'
            title={validationError.isChildError ? 'Contains invalid items' : validationError.message}
            on:click={handleExpand}
          >
            <Icon data={faExclamationTriangle} />
          </button>
        {/if}
        <slot name="insert-after" />
      {/if}
    </div>
    {#if expanded}
      <div class="items">
        {#each visibleSections as visibleSection, sectionIndex (sectionIndex)}
            {#each value.slice(visibleSection.start, Math.min(visibleSection.end, value.length)) as item, itemIndex (state[itemIndex][STATE_ID])}
            <svelte:self
              key={visibleSection.start + itemIndex}
              value={item}
              path={path.concat(visibleSection.start + itemIndex)}
              state={state[visibleSection.start + itemIndex]}
              searchResult={searchResult ? searchResult[visibleSection.start + itemIndex] : undefined}
              validationErrors={validationErrors ? validationErrors[visibleSection.start + itemIndex] : undefined}
              onPatch={onPatch}
              onInsert={onInsert}
              onUpdateKey={handleUpdateKey}
              onExpand={onExpand}
              onSelect={onSelect}
              onExpandSection={onExpandSection}
              selection={selection}
            >
              <div
                slot="insert-after"
                class="insert-button-area after"
                data-type="insert-button-area"
                on:mousedown|preventDefault={() => handleInsertAfter(visibleSection.start + itemIndex)}
              >
                <button class="insert-button">&#8617;</button>
              </div>
            </svelte:self>
          {/each}
          {#if visibleSection.end < value.length}
            <CollapsedItems
              visibleSections={visibleSections}
              sectionIndex={sectionIndex}
              total={value.length}
              path={path}
              onExpandSection={onExpandSection}
            />
          {/if}
        {/each}
        {#if selectedAppend}
          <div
            class="insert-area append"
            data-type="insert-area"
            style={getIndentationStyle(path.length + 1)}
            title={INSERT_EXPLANATION}
          ></div>
        {/if}
      </div>
      <div class="footer-outer" style={indentationStyle} >
        <div data-type="selectable-value" class="footer">
          <span class="bracket">]</span>
        </div>
        <slot name="insert-after" />
      </div>
    {/if}
  {:else if type === 'object'}
    <div class='header-outer' style={indentationStyle} >
      <div class="header">
        <button
          class='expand'
          on:click={toggleExpand}
          title='Expand or collapse this object (Ctrl+Click to expand/collapse recursively)'
        >
          {#if expanded}
            <Icon data={faCaretDown} />
          {:else}
            <Icon data={faCaretRight} />
          {/if}
        </button>
        {#if typeof key === 'string'}
          <div
            class={keyClass}
            contenteditable={editKey}
            spellcheck="false"
            on:input={handleKeyInput}
            on:dblclick={handleKeyDoubleClick}
            on:keydown={handleKeyKeyDown}
            bind:this={domKey}
          ></div>
          <div class="separator">:</div>
        {/if}
        <div class="meta" data-type="selectable-value" >
          <div class="meta-inner">
            {#if expanded}
              <div class="bracket expanded">
                &lbrace;
              </div>
            {:else}
              <div class="bracket"> &lbrace;</div>
              <button class="tag" on:click={handleExpand}>{Object.keys(value).length} props</button>
              <div class="bracket">&rbrace;</div>
            {/if}
          </div>
        </div>
      </div>
      {#if expanded}
        <div
          class="insert-button-area inside"
          data-type="insert-button-area"
          on:mousedown|preventDefault={() => handleInsertInside(key)}
        >
          <button class="insert-button">&#8617;</button>
        </div>
      {:else}
        {#if validationError}
          <!-- FIXME: implement proper tooltip -->
          <button
            class='validation-error'
            title={validationError.isChildError ? 'Contains invalid properties' : validationError.message}
            on:click={handleExpand}
          >
            <Icon data={faExclamationTriangle} />
          </button>
        {/if}
        <slot name="insert-after" />
      {/if}
    </div>
    {#if expanded}
      <div class="props">
        {#each keys as key (state[key][STATE_ID])}
          <svelte:self
            key={key}
            value={value[key]}
            path={path.concat(key)}
            state={state[key]}
            searchResult={searchResult ? searchResult[key] : undefined}
            validationErrors={validationErrors ? validationErrors[key] : undefined}
            onPatch={onPatch}
            onInsert={onInsert}
            onUpdateKey={handleUpdateKey}
            onExpand={onExpand}
            onSelect={onSelect}
            onExpandSection={onExpandSection}
            selection={selection}
          >
            <div
              slot="insert-after"
              class="insert-button-area after"
              data-type="insert-button-area"
              on:mousedown|preventDefault={() => handleInsertAfter(key)}
            >
              <button class="insert-button">&#8617;</button>
            </div>
          </svelte:self>
        {/each}
        {#if selectedAppend}
          <div
            class="insert-area append"
            data-type="insert-area"
            style={getIndentationStyle(path.length + 1)}
            title={INSERT_EXPLANATION}
          ></div>
        {/if}
      </div>
      <div class="footer-outer" style={indentationStyle} >
        <div data-type="selectable-value" class="footer">
          <div class="bracket">&rbrace;</div>
        </div>
        <slot name="insert-after" />
      </div>
    {/if}
  {:else}
    <div class="contents-outer" style={indentationStyle} >
      <div class="contents" >
        {#if typeof key === 'string'}
          <div
            class={keyClass}
            contenteditable={editKey}
            spellcheck="false"
            on:input={handleKeyInput}
            on:dblclick={handleKeyDoubleClick}
            on:keydown={handleKeyKeyDown}
            bind:this={domKey}
          ></div>
          <div class="separator">:</div>
        {/if}
        <div
          class={valueClass}
          contenteditable={editValue}
          spellcheck="false"
          on:input={handleValueInput}
          on:click={handleValueClick}
          on:dblclick={handleValueDoubleClick}
          on:keydown={handleValueKeyDown}
          bind:this={domValue}
          title={valueIsUrl ? 'Ctrl+Click or Ctrl+Enter to open url in new window' : null}
        ></div>
      </div>
      {#if validationError}
        <!-- FIXME: implement proper tooltip -->
        <button class='validation-error' title={validationError.message}>
          <Icon data={faExclamationTriangle} />
        </button>
      {/if}
      <slot name="insert-after" />
    </div>
  {/if}
</div>

<style src="./JSONNode.scss"></style>

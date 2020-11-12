<svelte:options immutable={true} />

<script>
  import {
    faCaretDown,
    faCaretRight,
    faExclamationTriangle
  } from '@fortawesome/free-solid-svg-icons'
  import classnames from 'classnames'
  import { isEqual } from 'lodash-es'
  import { onDestroy, tick } from 'svelte'
  import Icon from 'svelte-awesome'
  import {
    ACTIVE_SEARCH_RESULT,
    INDENTATION_WIDTH,
    STATE_EXPANDED,
    STATE_PROPS,
    STATE_SEARCH_PROPERTY,
    STATE_SEARCH_VALUE,
    STATE_VISIBLE_SECTIONS,
    VALIDATION_ERROR
  } from '../../constants.js'
  import { getNextKeys } from '../../logic/documentState.js'
  import { rename } from '../../logic/operations.js'
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

  export let key = undefined // only applicable for object properties
  export let value
  export let path
  export let state
  export let searchResult
  export let validationErrors
  export let onPatch
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

  $: selectedBefore = (selection && selection.beforePath)
    ? isEqual(selection.beforePath, path)
    : false

  $: selectedAppend = (selection && selection.appendPath)
    ? isEqual(selection.appendPath, path)
    : false

  $: selectedKey = (selection && selection.keyPath)
    ? isEqual(selection.keyPath, path)
    : false

  $: selectedValue = (selection && selection.valuePath)
    ? isEqual(selection.valuePath, path)
    : false

  $: editKey = selectedKey && selection && selection.edit === true
  $: editValue = selectedValue && selection && selection.edit === true

  $: expanded = state && state[STATE_EXPANDED]
  $: expanded = state && state[STATE_EXPANDED]
  $: visibleSections = state && state[STATE_VISIBLE_SECTIONS]
  $: props = state && state[STATE_PROPS]
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

  const escapeUnicode = false // TODO: pass via options

  let domKey
  let domValue
  let hovered = false

  $: type = valueType (value)
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

  function getIndentationStyle(level) {
    return `margin-left: ${level * INDENTATION_WIDTH}px`
  }

  function getValueClass (value, searchResult) {
    const type = valueType (value)

    return classnames('value', type, {
      search: searchResult && searchResult[STATE_SEARCH_VALUE],
      active: searchResult && searchResult[STATE_SEARCH_VALUE] === ACTIVE_SEARCH_RESULT,
      url: isUrl(value),
      empty: typeof value === 'string' && value.length === 0
    })
  }

  function getKeyClass(key, searchResult) {
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
    const newKey = getDomKey()
    if (key !== newKey) {
      // must be handled by the parent which has knowledge about the other keys
      const uniqueKey = onUpdateKey(key, newKey)
      if (uniqueKey !== newKey) {
        setDomKey(uniqueKey)
      }
    }
  }

  function handleUpdateKey (oldKey, newKey) {
    const newKeyUnique = findUniqueName(newKey, value)
    const nextKeys = getNextKeys(props, key, false)

    onPatch(rename(path, oldKey, newKeyUnique, nextKeys))

    return newKeyUnique
  }

  function handleKeyInput () {
    const newKey = getDomKey()
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
      onSelect({ keyPath: path })
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      updateKey()

      // TODO: move selection to next value (if any) on Enter
      // we apply selection on next tick, since the actual path will change
      await tick()
      onSelect({ keyPath: path })
    }
  }

  function handleKeyDoubleClick (event) {
    if (!editKey) {
      event.preventDefault()
      onSelect({ keyPath: path, edit: true })
    }
  }

  function updateValue () {
    const newValue = getDomValue()
    if (newValue !== value) {
      onPatch([{
        op: 'replace',
        path: compileJSONPointer(path),
        value: newValue
      }])
    }
  }

  function handleValueInput () {
    const newValue = getDomValue()
    if (newValue === '') {
      // immediately update to cleanup any left over <br/>
      setDomValue('')
    }
  }

  function handleValueDoubleClick (event) {
    if (!editValue) {
      event.preventDefault()
      onSelect({ valuePath: path, edit: true })
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
      onSelect({ valuePath: path })
    }

    if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      // apply changes
      updateValue()

      // TODO: move selection to next value (if any) on Enter
      onSelect({ valuePath: path })
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

    if (event.target === domKey) {
      onSelect({ keyPath: path })
    } else if (event.target === domValue) {
      onSelect({ valuePath: path })
    } else if (isChildOfAttribute(event.target, 'data-type', 'before-node-selector')) {
      onSelect({ beforePath: path })
    } else if (isChildOfAttribute(event.target, 'data-type', 'append-node-selector')) {
      onSelect({ appendPath: path })
    } else  if (isChildOfAttribute(event.target, 'data-type', 'selectable-value')) {
      onSelect({ valuePath: path })
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
  <div
    data-type="before-node-selector"
    class="before-node-selector"
    class:selected={selectedBefore}
    style={indentationStyle}
  >
    <div class="selector"></div>
  </div>
  {#if type === 'array'}
    <div class='header' style={indentationStyle} >
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
      <div class="meta" data-type="selectable-value">
        <div class="meta-inner">
          {#if expanded}
            <div class="delimiter">[</div>
          {:else}
            <div class="delimiter">[</div>
            <button class="tag" on:click={handleExpand}>{value.length} items</button>
            <div class="delimiter">]</div>
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
          {/if}
        </div>
      </div>
    </div>
    {#if expanded}
      <div class="items">
        {#each visibleSections as visibleSection, sectionIndex (sectionIndex)}
          {#each value.slice(visibleSection.start, Math.min(visibleSection.end, value.length)) as item, itemIndex (itemIndex)}
            <svelte:self
              key={visibleSection.start + itemIndex}
              value={item}
              path={path.concat(visibleSection.start + itemIndex)}
              state={state && state[visibleSection.start + itemIndex]}
              searchResult={searchResult ? searchResult[visibleSection.start + itemIndex] : undefined}
              validationErrors={validationErrors ? validationErrors[visibleSection.start + itemIndex] : undefined}
              onPatch={onPatch}
              onUpdateKey={handleUpdateKey}
              onExpand={onExpand}
              onSelect={onSelect}
              onExpandSection={onExpandSection}
              selection={selection}
            />
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
        <div
          data-type="append-node-selector"
          class="append-node-selector"
          class:selected={selectedAppend}
          style={getIndentationStyle(path.length + 1)}
        >
          <div class="selector"></div>
        </div>
      </div>
      <div data-type="selectable-value" class="footer" style={indentationStyle} >
        <span class="delimiter">]</span>
      </div>
    {/if}
  {:else if type === 'object'}
    <div class="header" style={indentationStyle} >
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
        <span class="separator">:</span>
      {/if}
      <div class="meta" data-type="selectable-value" >
        <div class="meta-inner">
          {#if expanded}
            <span class="delimiter">&#123;</span>
          {:else}
            <span class="delimiter"> &#123;</span>
            <button class="tag" on:click={handleExpand}>{Object.keys(value).length} props</button>
            <span class="delimiter">&rbrace;</span>
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
          {/if}
        </div>
      </div>
    </div>
    {#if expanded}
      <div class="props">
        {#each props as prop (prop.id)}
          <svelte:self
            key={prop.key}
            value={value[prop.key]}
            path={path.concat(prop.key)}
            state={state && state[prop.key]}
            searchResult={searchResult ? searchResult[prop.key] : undefined}
            validationErrors={validationErrors ? validationErrors[prop.key] : undefined}
            onPatch={onPatch}
            onUpdateKey={handleUpdateKey}
            onExpand={onExpand}
            onSelect={onSelect}
            onExpandSection={onExpandSection}
            selection={selection}
          />
        {/each}
        <div
          data-type="append-node-selector"
          class="append-node-selector"
          class:selected={selectedAppend}
          style={getIndentationStyle(path.length + 1)}
        >
          <div class="selector"></div>
        </div>
      </div>
      <div data-type="selectable-value" class="footer" style={indentationStyle} >
        <span class="delimiter">&rbrace;</span>
      </div>
    {/if}
  {:else}
    <div class="contents" style={indentationStyle} >
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
        <span class="separator">:</span>
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
      {#if validationError}
        <!-- FIXME: implement proper tooltip -->
        <button class='validation-error' title={validationError.message}>
          <Icon data={faExclamationTriangle} />
        </button>
      {/if}
    </div>
  {/if}
</div>

<style src="./JSONNode.scss"></style>

<svelte:options immutable={true} />

<script>
  import {
    faCaretDown,
    faCaretRight,
    faExclamationTriangle
  } from '@fortawesome/free-solid-svg-icons'
  import classnames from 'classnames'
  import { isEqual } from 'lodash-es'
  import { tick } from 'svelte'
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

  function focusKey () {
    // TODO: this timeout is ugly
    setTimeout(() => setCursorToEnd(domKey))
  }

  function focusValue () {
    // TODO: this timeout is ugly
    setTimeout(() => setCursorToEnd(domValue))
  }

  $: {
    if (domKey) {
      if (editKey === true) {
        // edit changed to true -> set focus to end of input
        focusKey()
      } else {
        // edit changed to false -> apply actual key (cancel changes on Escape)
        setPlainText(domKey, key)
      }
    }
  }

  $: {
    if (domValue) {
      if (editValue === true) {
        focusValue()
      } else {
        // edit changed to false -> apply actual value (cancel changes on Escape)
        setPlainText(domValue, value)
      }
    }
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

  $: if (domKey) {
    if (document.activeElement !== domKey) {
      // synchronize the innerText of the editable div with the escaped value,
      // but only when the domValue does not have focus else we will ruin 
      // the cursor position.
      setPlainText(domKey, key)
    }
  }

  $: if (domValue) {
    if (document.activeElement !== domValue) {
      // synchronize the innerText of the editable div with the escaped value,
      // but only when the domValue does not have focus else we will ruin 
      // the cursor position.
      setPlainText(domValue, value)
    }
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
    const newKey = getPlainText(domKey)

    // must be handled by the parent which has knowledge about the other keys
    onUpdateKey(key, newKey)
  }

  function handleUpdateKey (oldKey, newKey) {
    const newKeyUnique = findUniqueName(newKey, value)
    const nextKeys = getNextKeys(props, key, false)

    onPatch(rename(path, oldKey, newKeyUnique, nextKeys))
  }

  function handleKeyInput (event) {
    const newKey = getPlainText(event.target)
    if (newKey === '') {
      // immediately update to cleanup any left over <br/>
      setPlainText(domKey, '')
    }
  }

  async function handleKeyKeyDown (event) {
    event.stopPropagation()

    if (event.key === 'Escape') {
      // cancel changes
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

  // get the value from the DOM
  function getValue () {
    const valueText = getPlainText(domValue)
    return stringConvert(valueText) // TODO: implement support for type "string"
  }

  function updateValue () {
    const newValue = getValue()

    onPatch([{
      op: 'replace',
      path: compileJSONPointer(path),
      value: newValue
    }])
  }

  function handleValueInput () {
    const newValue = getValue()
    if (newValue === '') {
      // immediately update to cleanup any left over <br/>
      setPlainText(domValue, '')
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

    // FIXME: this quickkey only works when in edit mode
    if (valueIsUrl && event.ctrlKey && event.key === 'Enter') {
      event.stopPropagation()
      window.open(value, '_blank')
    }

    if (event.key === 'Escape') {
      // cancel changes
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

    // unselect existing selection on mouse down if any
    if (selection) {
      onSelect(null)
    }

    if (event.target === domKey) {
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      onSelect({
        keyPath: path
      })
    } else if (event.target === domValue) {
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      onSelect({
        valuePath: path
      })
    } else if (isChildOfAttribute(event.target, 'data-type', 'before-node-selector')) {
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      onSelect({
        beforePath: path
      })
    } else if (isChildOfAttribute(event.target, 'data-type', 'append-node-selector')) {
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      onSelect({
        appendPath: path
      })
    } else {
      // initialize dragging a selection
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      if (isChildOfAttribute(event.target, 'data-type', 'selectable-area')) {
        // select current node
        onSelect({
          anchorPath: path,
          focusPath: path
        })
      }
    }

    event.stopPropagation()
    // IMPORTANT: do not use event.preventDefault() here,
    //  else the :active style doesn't work!

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

    if (
      isChildOfAttribute(event.target, 'data-type', 'selectable-area') && 
      !isContentEditableDiv(event.target)
    ) {
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
    <div data-type="selectable-area" class='header' style={indentationStyle} >
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
          data-path={compileJSONPointer(path.concat(STATE_SEARCH_PROPERTY))}
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
      <div data-type="selectable-area" class="footer" style={indentationStyle} >
        <span class="delimiter">]</span>
      </div>
    {/if}
  {:else if type === 'object'}
    <div data-type="selectable-area" class="header" style={indentationStyle} >
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
          data-path={compileJSONPointer(path.concat(STATE_SEARCH_PROPERTY))}
          contenteditable={editKey}
          spellcheck="false"
          on:input={handleKeyInput}
          on:dblclick={handleKeyDoubleClick}
          on:keydown={handleKeyKeyDown}
          bind:this={domKey}
        ></div>
        <span class="separator">:</span>
      {/if}
      <div class="meta">
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
      <div data-type="selectable-area" class="footer" style={indentationStyle} >
        <span class="delimiter">&rbrace;</span>
      </div>
    {/if}
  {:else}
    <div data-type="selectable-area" class="contents" style={indentationStyle} >
      {#if typeof key === 'string'}
        <div
          class={keyClass}
          data-path={compileJSONPointer(path.concat(STATE_SEARCH_PROPERTY))}
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
        data-path={compileJSONPointer(path.concat(STATE_SEARCH_VALUE))}
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

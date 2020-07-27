<script>
  import { debounce, isEqual } from 'lodash-es'
  import { rename } from '../logic/operations.js'
  import {
    DEBOUNCE_DELAY,
    DEFAULT_LIMIT,
    STATE_EXPANDED,
    STATE_LIMIT,
    STATE_PROPS,
    STATE_SEARCH_PROPERTY,
    STATE_SEARCH_VALUE,
    INDENTATION_WIDTH
  } from '../constants.js'
  import { singleton } from '../singleton.js'
  import {
    getPlainText,
    isAppendNodeSelector,
    isBeforeNodeSelector,
    isChildOfButton,
    isContentEditableDiv,
    setPlainText
  } from '../utils/domUtils.js'
  import Icon from 'svelte-awesome'
  import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
  import classnames from 'classnames'
  import { findUniqueName } from '../utils/stringUtils.js'
  import { isUrl, stringConvert, valueType } from '../utils/typeUtils'
  import { compileJSONPointer } from '../utils/jsonPointer'
  import { getNextKeys } from '../logic/documentState.js'

  export let key = undefined // only applicable for object properties
  export let value
  export let path
  export let state
  export let searchResult
  export let onPatch
  export let onUpdateKey
  export let onExpand
  export let onLimit
  export let onSelect
  export let selection

  $: expanded = state && state[STATE_EXPANDED]
  $: limit = state && state[STATE_LIMIT]
  $: props = state && state[STATE_PROPS]

  const escapeUnicode = false // TODO: pass via options

  let domKey 
  let domValue

  $: type = valueType (value)

  $: limited = type === 'array' && value.length > limit

  $: items = type === 'array'
    ? limited ? value.slice(0, limit) : value
    : undefined

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

    return classnames('value', type, searchResult && searchResult[STATE_SEARCH_VALUE], {
      url: isUrl(value),
      empty: typeof value === 'string' && value.length === 0,
    })
  }

  function getKeyClass(key, searchResult) {
    return classnames('key', searchResult && searchResult[STATE_SEARCH_PROPERTY], {
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
  const updateKeyDebounced = debounce(updateKey, DEBOUNCE_DELAY)

  function handleUpdateKey (oldKey, newKey) {
    const newKeyUnique = findUniqueName(newKey, value)
    const nextKeys = getNextKeys(props, key, false)

    onPatch(rename(path, oldKey, newKeyUnique, nextKeys))
  }

  function handleKeyInput (event) {
    const newKey = getPlainText(event.target)
    keyClass = getKeyClass(newKey, searchResult)
    if (newKey === '') {
      // immediately update to cleanup any left over <br/>
      setPlainText(domKey, '')
    }

    // fire a change event only after a delay
    updateKeyDebounced()
  }

  function handleKeyBlur (event) {
    // handle any pending changes still waiting in the debounce function
    updateKeyDebounced.flush()

    // make sure differences in escaped text like with new lines is updated
    setPlainText(domKey, key)
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
  const debouncedUpdateValue = debounce(updateValue, DEBOUNCE_DELAY)

  function handleValueInput () {
    // do not await the debounced update to apply styles
    const newValue = getValue()
    valueClass = getValueClass(newValue, searchResult)
    if (newValue === '') {
      // immediately update to cleanup any left over <br/>
      setPlainText(domValue, '')
    }

    // fire a change event only after a delay
    debouncedUpdateValue()
  }

  function handleValueBlur () {
    // handle any pending changes still waiting in the debounce function
    debouncedUpdateValue.flush()

    // make sure differences in escaped text like with new lines is updated
    setPlainText(domValue, value)
  }

  function handleValueClick (event) {
    if (valueIsUrl && event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()

      window.open(value, '_blank')
    }
  }

  function handleValueKeyDown (event) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      window.open(value, '_blank')
    }
  }

  function handleShowAll () {
    onLimit(path, Infinity)
  }

  function handleShowMore () {
    onLimit(path, (Math.round(limit / DEFAULT_LIMIT) + 1) * DEFAULT_LIMIT)
  }

  function handleMouseDown (event) {
    // unselect existing selection on mouse down if any
    if (selection) {
      onSelect(null)
    }

    // check if the mouse down is not happening in the key or value input fields or on a button
    if (isContentEditableDiv(event.target) || isChildOfButton(event.target)) {
      return
    }

    if (isBeforeNodeSelector(event.target)) {
      singleton.mousedown = true
      singleton.selectionAnchor = path
      singleton.selectionFocus = null

      onSelect({
        beforePath: path
      })
    } else if (isAppendNodeSelector(event.target)) {
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
      singleton.selectionFocus = path

      onSelect({
        anchorPath: singleton.selectionAnchor,
        focusPath: singleton.selectionFocus
      })
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

  function handleSelectBefore (event) {
    event.stopPropagation()

    onSelect({
      beforePath: path
    })
  }

  function handleSelectAfter (event) {
    event.preventDefault()
    event.stopPropagation()

    onSelect({
      appendPath: path
    })
  }

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

  $: indentationStyle = getIndentationStyle(path.length)
</script>

<div
  class='json-node'
  class:root={path.length === 0}
  class:selected={selected}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
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
    <div class='header' style={indentationStyle}>
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
          contenteditable="true"
          spellcheck="false"
          on:input={handleKeyInput}
          on:blur={handleKeyBlur}
          bind:this={domKey}
        ></div>
        <div class="separator">:</div>
      {/if}
      {#if expanded}
        <div class="delimiter">[</div>
      {:else}
        <div class="delimiter">[</div>
        <button class="tag" on:click={handleExpand}>{value.length} items</button>
        <div class="delimiter">]</div>
      {/if}
    </div>
    {#if expanded}
      <div class="items">
        {#each items as item, index (index)}
          <svelte:self
            key={index}
            value={item}
            path={path.concat(index)}
            state={state && state[index]}
            searchResult={searchResult ? searchResult[index] : undefined}
            onPatch={onPatch}
            onUpdateKey={handleUpdateKey}
            onExpand={onExpand}
            onLimit={onLimit}
            onSelect={onSelect}
            selection={selection}
          />
        {/each}
        <div
          data-type="append-node-selector"
          class="append-node-selector"
          class:selected={selectedAppend}
          style={indentationStyle}
        >
          <div class="selector"></div>
        </div>
        {#if limited}
          <div class="limit" style={getIndentationStyle(path.length + 2)}>
            (showing {limit} of {value.length} items <button on:click={handleShowMore}>show more</button> <button on:click={handleShowAll}>show all</button>)
          </div>
        {/if}
      </div>
      <div class="footer" style={indentationStyle}>
        <span class="delimiter">]</span>
      </div>
    {/if}
  {:else if type === 'object'}
    <div class='header' style={indentationStyle}>
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
          contenteditable="true"
          spellcheck="false"
          on:input={handleKeyInput}
          on:blur={handleKeyBlur}
          bind:this={domKey}
        ></div>
        <span class="separator">:</span>
      {/if}
      {#if expanded}
        <span class="delimiter">&#123;</span>
      {:else}
        <span class="delimiter"> &#123;</span>
        <button class="tag" on:click={handleExpand}>{Object.keys(value).length} props</button>
        <span class="delimiter">&rbrace;</span>
      {/if}
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
            onPatch={onPatch}
            onUpdateKey={handleUpdateKey}
            onExpand={onExpand}
            onLimit={onLimit}
            onSelect={onSelect}
            selection={selection}
          />
        {/each}
        <div
          data-type="append-node-selector"
          class="append-node-selector"
          class:selected={selectedAppend}
          style={indentationStyle}
        >
          <div class="selector"></div>
        </div>
      </div>
      <div class="footer" style={indentationStyle}>
        <span class="delimiter">&rbrace;</span>
      </div>
    {/if}
  {:else}
    <div class="contents" style={indentationStyle}>
      {#if typeof key === 'string'}
        <div
          class={keyClass}
          data-path={compileJSONPointer(path.concat(STATE_SEARCH_PROPERTY))}
          contenteditable="true"
          spellcheck="false"
          on:input={handleKeyInput}
          on:blur={handleKeyBlur}
          bind:this={domKey}
        ></div>
        <span class="separator">:</span>
      {/if}
      <div
        class={valueClass}
        data-path={compileJSONPointer(path.concat(STATE_SEARCH_VALUE))}
        contenteditable="true"
        spellcheck="false"
        on:input={handleValueInput}
        on:blur={handleValueBlur}
        on:click={handleValueClick}
        on:keydown={handleValueKeyDown}
        bind:this={domValue}
        title={valueIsUrl ? 'Ctrl+Click or Ctrl+Enter to open url in new window' : null}
      ></div>
    </div>
  {/if}
</div>

<style src="./JSONNode.scss"></style>

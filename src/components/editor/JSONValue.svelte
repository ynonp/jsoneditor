<script>
  import classnames from 'classnames'
  import { isEqual } from 'lodash-es'
  import { onDestroy } from 'svelte'
  import { ACTIVE_SEARCH_RESULT, STATE_SEARCH_VALUE } from '../../constants.js'
  import { SELECTION_TYPE } from '../../logic/selection.js'
  import {
    getPlainText,
    setCursorToEnd,
    setPlainText
  } from '../../utils/domUtils.js'
  import { compileJSONPointer } from '../../utils/jsonPointer.js'
  import { isUrl, stringConvert, valueType } from '../../utils/typeUtils.js'

  export let path
  export let value
  export let onPatch
  export let selection
  export let onSelect
  export let searchResult

  onDestroy(() => {
    updateValue()
  })

  let domValue
  let newValue = value
  let valueClass

  $: selectedValue = (selection && selection.type === SELECTION_TYPE.VALUE)
    ? isEqual(selection.path, path)
    : false
  $: valueClass = getValueClass(newValue, searchResult)
  $: editValue = selectedValue && selection && selection.edit === true
  $: valueIsUrl = isUrl(value)

  $: if (editValue === true) {
    focusValue()
  }

  $: if (editValue === false) {
    updateValue()
  }

  $: if (domValue) {
    setDomValueIfNotEditing(value)
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

  function getDomValue () {
    if (!domValue) {
      return value
    }

    const valueText = getPlainText(domValue)
    return stringConvert(valueText) // TODO: implement support for type "string"
  }

  function setDomValue (updatedValue) {
    if (domValue) {
      setPlainText(domValue, updatedValue)
    }
  }

  function setDomValueIfNotEditing (updatedValue) {
    if (editValue === false) {
      setDomValue(updatedValue)
    }
  }

  function focusValue () {
    // TODO: this timeout is ugly
    setTimeout(() => {
      if (domValue) {
        setCursorToEnd(domValue)
      }
    })
  }

  function getValueClass (value, searchResult) {
    const type = valueType(value)

    return classnames('editable-div', SELECTION_TYPE.VALUE, type, {
      search: searchResult && searchResult[STATE_SEARCH_VALUE],
      active: searchResult && searchResult[STATE_SEARCH_VALUE] === ACTIVE_SEARCH_RESULT,
      url: isUrl(value),
      empty: typeof value === 'string' && value.length === 0
    })
  }

  function handleValueInput () {
    newValue = getDomValue()
    if (newValue === '') {
      // immediately update to cleanup any left over <br/>
      setDomValue('')
    }
  }

  function handleValueClick (event) {
    if (valueIsUrl && event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()

      window.open(value, '_blank')
    }
  }

  function handleValueDoubleClick (event) {
    if (!editValue) {
      event.preventDefault()
      onSelect({ type: SELECTION_TYPE.VALUE, path, edit: true })
    }
  }

  function handleMouseDown (event) {
    if (!editValue && !event.shiftKey) {
      event.preventDefault()

      onSelect({ type: SELECTION_TYPE.VALUE, path })
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
</script>

<div
  data-type="editable-div"
  class={valueClass}
  contenteditable={editValue}
  spellcheck="false"
  on:input={handleValueInput}
  on:click={handleValueClick}
  on:dblclick={handleValueDoubleClick}
  on:mousedown={handleMouseDown}
  on:keydown={handleValueKeyDown}
  bind:this={domValue}
  title={valueIsUrl ? 'Ctrl+Click or Ctrl+Enter to open url in new window' : null}
></div>

<style src="./JSONValue.scss"></style>

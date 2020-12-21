<script>
  import {
    faExclamationTriangle,
    faCheck,
    faTrash,
    faWrench,
    faArrowDown
  } from '@fortawesome/free-solid-svg-icons'
  import createDebug from 'debug'
  import { normalizeJsonParseError } from '../../utils/jsonUtils.js'
  import Icon from 'svelte-awesome'
  import simpleJsonRepair from 'simple-json-repair'

  export let text = ''
  export let onChange = null
  export let onApply

  const debug = createDebug('jsoneditor:JSONRepair')

  let domTextArea

  $: error = getErrorMessage(text)

  $: debug('text changed', { text })
  $: debug('error', error)

  function getErrorMessage (jsonText) {
    try {
      JSON.parse(jsonText)
      return null
    } catch (err) {
      return normalizeJsonParseError(jsonText, err.message)
    }
  }

  function goToError () {
    if (domTextArea && error && error.position != null) {
      domTextArea.setSelectionRange(error.position, error.position)
      setTimeout(() => {
        domTextArea.focus()
      })
    }
  }

  function handleChange (event) {
    debug('handleChange')

    const value = event.target.value

    if (text === value) {
      return
    }

    text = value

    if (onChange) {
      onChange(text)
    }
  }

  function handleApply () {
    try {
      const repairedDoc = JSON.parse(text)
      onApply(repairedDoc)
    } catch (err) { // does not occur in practice
      console.error(err)
    }
  }

  function handleRepair () {
    try {
      // TODO: simpleJsonRepair should also partially apply fixes. Now it's all or nothing
      text = simpleJsonRepair(text)
    } catch (err) {
      // no need to do something with the error
    }
  }

  function handleCancel () {
    const emptyDoc = {}
    onApply(emptyDoc)
  }
</script>

<div class="json-repair">
  <div class="menu">
    {#if error}
      <button
        class="button"
        on:click={goToError}
        title="Scroll to the error location"
      >
        <Icon data={faArrowDown} />
      </button>
    {:else}
      <button
        class="button"
        title="Apply fixed JSON"
        on:click={() => onApply()}
      >
        <Icon data={faCheck} />
      </button>
    {/if}
    <div class="separator"></div>
    <button
      class="button"
      title="Auto repair JSON"
      on:click={handleRepair}
    >
      <Icon data={faWrench}/>
    </button>
    <div class="separator"></div>
    <button
      class="button"
      title="Cancel repair, open a new empty document instead"
      on:click={handleCancel}
    >
      <Icon data={faTrash} />
    </button>
  </div>
  {#if error}
    <div class="json-repair-error">
      <Icon data={faExclamationTriangle} /> Cannot parse JSON: {error.message}.
      <button
        on:click={goToError}
        class="link-like"
        title="Scroll to the error location"
      >
        show me
      </button>
    </div>
  {:else}
    <div class="json-repair-valid">
      JSON is valid now and can be parsed.
      <button
        on:click={handleApply}
        class="link-like"
        title="Apply fixed JSON"
      >
        apply
      </button>
    </div>
  {/if}
  <textarea
    bind:this={domTextArea}
    value={text}
    on:input={handleChange}
    class="json-text"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
  ></textarea>
</div>

<style src="./JSONRepair.scss"></style>

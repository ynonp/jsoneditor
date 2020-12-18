<svelte:options
  accessors={false}
  immutable={true}
/>

<script>
  import createDebug from 'debug'
  import simpleJsonRepair from 'simple-json-repair'
  import JSONRepair from './editor/JSONRepair.svelte'
  import Modal from 'svelte-simple-modal'
  import JSONEditor from './editor/JSONEditor.svelte'

  // TODO: document how to enable debugging in the readme: localStorage.debug="jsoneditor:*", then reload
  const debug = createDebug('jsoneditor:Main')

  // This Main.svelte wrapper is there purely to be able to wrap JSONEditor inside Modal
  // It would be nice if there is a solution that doesn't require this wrapping.

  export let doc
  export let mode
  export let mainMenuBar
  export let validator
  export let onChangeJson
  export let onClassName
  export let onFocus
  export let onBlur

  let text = null

  $: repairing = (text != null)
  $: docChanged(doc) // this will reset text on change of doc

  let ref

  $: if (ref) {
    debug('update doc')

    ref.update(doc)
  }

  function docChanged (doc) {
    text = null
  }

  export function get() {
    return ref.get()
  }

  export function set(json) {
    debug('set')

    ref.set(json)
  }

  export function update(json) {
    debug('update')

    ref.update(json)
  }

  export function setText(newText) {
    try {
      const newDoc = JSON.parse(newText)
      debug('setText parsing successful')
      set(newDoc)
    } catch (err) {
      // try auto repair
      try {
        const newDoc = JSON.parse(simpleJsonRepair(newText))
        debug('setText parsing successful after auto repair')
        set(newDoc)
      } catch (err) {
        // will open JSONRepair window
        text = newText
        debug('setText parsing failed, could not auto repair')
      }
    }
  }

  export function updateText(newText) {
    try {
      const newDoc = JSON.parse(newText)
      debug('setText parsing successful')
      update(newDoc)
    } catch (err) {
      // try auto repair
      try {
        const newDoc = JSON.parse(simpleJsonRepair(newText))
        debug('setText parsing successful after auto repair')
        update(newDoc)
      } catch (err) {
        // will open JSONRepair window
        text = newText
        // FIXME: must remember to call update when applying fixed text
        debug('setText parsing failed, could not auto repair')
      }
    }
  }

  export function getText() {
    return repairing
      ? text
      : JSON.stringify(doc, null, 2)
  }

  export function patch(operations, newSelection) {
    if (repairing) {
      throw new Error('Cannot apply patch whilst repairing invalid JSON')
    }

    return ref.patch(operations, newSelection)
  }

  export function expand(callback) {
    return ref.expand(callback)
  }

  export function collapse(callback) {
    return ref.collapse(callback)
  }

  export function setValidator(newValidator) {
    validator = newValidator
  }

  export function getValidator() {
    return validator
  }

  export function setMainMenuBar(newMainMenuBar) {
    mainMenuBar = newMainMenuBar
  }

  export function getMainMenuBar() {
    return mainMenuBar
  }

  export function setMode(newMode) {
    mode = newMode
  }

  export function getMode() {
    return mode
  }

  export function destroy() {
    this.$destroy()
  }

  function handleApplyRepair (newDoc) {
    doc = newDoc
  }
</script>

<Modal>
  <div class="jsoneditor-main">
    <JSONEditor
      bind:this={ref}
      bind:mode
      bind:doc
      bind:mainMenuBar
      bind:validator
      bind:onChangeJson
      bind:onClassName
      bind:onFocus
      bind:onBlur
      visible={text == null}
    />
    {#if text}
      <JSONRepair
        bind:text={text}
        onApply={handleApplyRepair}
      />
    {/if}
  </div>
</Modal>

<style src="./Main.scss"></style>
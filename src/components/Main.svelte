<svelte:options
  accessors={false}
  immutable={true}
/>

<script>
  import createDebug from 'debug'
  import simpleJsonRepair from 'simple-json-repair'
  import Modal from 'svelte-simple-modal'
  import { uniqueId } from '../utils/uniqueId.js'
  import JSONEditor from './editor/JSONEditor.svelte'
  import JSONRepair from './editor/JSONRepair.svelte'

  // TODO: document how to enable debugging in the readme: localStorage.debug="jsoneditor:*", then reload
  const debug = createDebug('jsoneditor:Main')

  export let doc
  export let text = null
  export let mode
  export let mainMenuBar
  export let validator
  export let onChangeJson = () => {}
  export let onChangeText = null
  export let onClassName = () => {}
  export let onFocus = () => {}
  export let onBlur = () => {}

  let instanceId = uniqueId()

  $: repairing = (text != null)

  let ref

  export function get() {
    return doc
  }

  export function set(newDoc) {
    debug('set')

    instanceId = uniqueId() // new editor id -> will re-create the editor
    text = null
    doc = newDoc
  }

  export function update(updatedDoc) {
    debug('update')

    doc = updatedDoc
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

  function handleChangeText (updatedText) {
    debug('handleChangeText')

    if (onChangeText) {
      onChangeText(updatedText)
    }
  }

  function handleChangeJson (updatedDoc) {
    debug('handleChangeJson')

    text = null

    if (onChangeJson) {
      onChangeJson(updatedDoc)
    }

    if (onChangeText) {
      onChangeText(JSON.stringify(updatedDoc, null, 2))
    }
  }

</script>

<Modal>
  <div class="jsoneditor-main">
    {#key instanceId}
      <JSONEditor
        bind:this={ref}
        bind:mode
        bind:externalDoc={doc}
        bind:mainMenuBar
        bind:validator
        onChangeJson={handleChangeJson}
        bind:onClassName
        bind:onFocus
        bind:onBlur
        visible={text == null}
      />
      {#if text}
        <JSONRepair
          bind:text={text}
          onChange={handleChangeText}
          onApply={handleApplyRepair}
        />
      {/if}
    {/key}
  </div>
</Modal>

<style src="./Main.scss"></style>
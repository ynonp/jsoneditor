<svelte:options
  accessors={false}
  immutable={true}
/>

<script>
  import Modal from 'svelte-simple-modal'
  import JSONEditor from './editor/JSONEditor.svelte'

  // This Main.svelte wrapper is there purely to be able to wrap JSONEditor inside Modal
  // It would be nice if there is a solution that doesn't require this wrapping.

  export let doc
  export let mode
  export let mainMenuBar
  export let validate
  export let onChangeJson
  export let onClassName
  export let onFocus
  export let onBlur

  let ref

  export function set (json) {
    ref.set(json)
  }

  export function update (json) {
    ref.update(json)
  }

  export function get () {
    return ref.get()
  }

  export function patch (operations, newSelection) {
    return ref.patch(operations, newSelection)
  }

  export function expand (callback) {
    return ref.expand(callback)
  }

  export function collapse (callback) {
    return ref.collapse(callback)
  }

  export function setValidator (newValidate) {
    ref.setValidator(newValidate)
  }

  export function getValidator () {
    return ref.getValidator()
  }

  export function setMainMenuBar (newMainMenuBar) {
    mainMenuBar = newMainMenuBar
  }

  export function getMainMenuBar () {
    return mainMenuBar
  }

  export function setMode (newMode) {
    mode = newMode
  }

  export function getMode () {
    return mode
  }
</script>

<Modal>
  <JSONEditor
    bind:this={ref}
    bind:mode
    bind:doc
    bind:mainMenuBar
    bind:validate
    bind:onChangeJson
    bind:onClassName
    bind:onFocus
    bind:onBlur
  />
</Modal>

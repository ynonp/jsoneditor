<svelte:options immutable={true} />

<script>
  import Modal from 'svelte-simple-modal'
  import TreeMode from './treemode/TreeMode.svelte'

  const DefaultMode = TreeMode

  export let config = {}

  let ref

  export function set (json) {    
    // TODO: check if the method exists for this mode, if not, throw a clear error
    ref.set(json)
  }

  export function update (json) {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    ref.update(json)
  }

  export function get () {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    return ref.get()
  }

  export function expand (callback) {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    return ref.expand(callback)
  }

  export function collapse (callback) {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    return ref.collapse(callback)
  }

  export function setValidator (newValidate) {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    ref.setValidator(newValidate)
  }

  export function getValidator () {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    return ref.getValidator()
  }

  export function patch(operations, newSelection) {
    // TODO: check if the method exists for this mode, if not, throw a clear error
    return ref.patch(operations, newSelection)
  }

  function getRestConfig (config) {
    let { mode, ...restConfig } = config
    return restConfig
  }
</script>

<Modal>
  <!-- TODO: pass the config options explicitly here? -->
  <svelte:component 
    this={config.mode || DefaultMode}
    bind:this={ref}
    {...getRestConfig(config)}
  />
</Modal>

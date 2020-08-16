<script>
  import Modal from 'svelte-simple-modal'
  import TreeMode from './treemode/TreeMode.svelte'

  export let config = {}
  let mode
  let restConfig

  $: {
    let { _mode, ..._restConfig } = config
    mode = _mode
    restConfig = _restConfig
  }
</script>

<Modal>
  <svelte:component this={mode || TreeMode} {...restConfig} />
</Modal>

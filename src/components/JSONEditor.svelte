<script>
  import Modal from 'svelte-simple-modal'
  import TreeMode from './treemode/TreeMode.svelte'

  const DefaultMode = TreeMode

  export let config = {}

  function getRestConfig (config) {
    let { mode, ...restConfig } = config
    return restConfig
  }
</script>

<Modal>
  <svelte:component this={config.mode || DefaultMode} {...getRestConfig(config)} />
</Modal>

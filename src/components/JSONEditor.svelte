<script>
  import Modal from 'svelte-simple-modal'
  import TreeMode from './treemode/TreeMode.svelte'

  export let config = {}
</script>

<Modal>
	<TreeMode {...config} />
</Modal>

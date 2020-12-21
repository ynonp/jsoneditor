<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import JSONRepair from '../editor/JSONRepair.svelte'

  export let text
  export let onParse
  export let onRepair
  export let onApply

  const { close } = getContext('simple-modal')

  function handleApply (repairedText) {
    close()
    onApply(repairedText)
  }

  function handleCancel () {
    close()
  }
</script>

<JSONRepair
  bind:text
  onParse={onParse}
  onRepair={onRepair}
  onApply={handleApply}
  onCancel={handleCancel}
/>

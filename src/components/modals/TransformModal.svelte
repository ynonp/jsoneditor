<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import Header from './Header.svelte'

  const {close} = getContext('simple-modal')
</script>

<div class="jsoneditor-modal transform">
  <Header title='Transform' />
  <div class="contents">
    TODO...
  </div>
</div>

<style src="./TransformModal.scss"></style>

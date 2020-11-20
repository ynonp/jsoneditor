<script>
  export let keyOrIndex
  export let onClick

  function handleClick (event) {
    event.stopPropagation()
    onClick(keyOrIndex)
  }
</script>

<button
  class="insert-menu-button"
  on:click={handleClick}
>
  &#8617;
</button>

<style src="./InsertMenuButton.scss"></style>

<script>
  export let keyOrIndex
  export let onClick

  function handleClick () {
    onClick(keyOrIndex)
  }
</script>

<button
  class="insert-menu-button"
  on:mousedown={handleClick}
>
  &#8617;
</button>

<style src="./InsertMenuButton.scss"></style>

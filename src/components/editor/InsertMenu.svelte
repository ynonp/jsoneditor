<script>
  export let showStructure
  export let onInsert
</script>

<div class="insert-menu">
  Insert new
  <button
    class="insert-button"
    on:click={() => onInsert('object')}
  >
    Object &lbrace;&rbrace;
  </button>
  <button
    class="insert-button"
    on:click={() => onInsert('array')}
  >
    Array []
  </button>
  {#if showStructure }
    <button
      class="insert-button"
      on:click={() => onInsert('structure')}
    >
      Structure &lbrace;...&rbrace;
    </button>
  {/if}
  or{' '}
  <button
    class="insert-button"
    on:click={() => onInsert('value')}
  >
    Value
  </button>
  or just start typing
</div>

<style src="./InsertMenu.scss"></style>

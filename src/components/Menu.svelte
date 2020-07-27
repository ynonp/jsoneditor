<script>
  import Icon from 'svelte-awesome'
  import { faCut, faClone, faCopy, faPaste, faSearch, faUndo, faRedo, faPlus } from '@fortawesome/free-solid-svg-icons'
  import SearchBox from './SearchBox.svelte'
  import DropdownMenu from './DropdownMenu.svelte'

  export let searchText
  export let searchResult
  export let showSearch = false
  export let selection
  export let clipboard
  export let historyState

  export let onCut
  export let onCopy
  export let onPaste
  export let onDuplicate
  export let onUndo
  export let onRedo

  export let onSearchText
  export let onNextSearchResult
  export let onPreviousSearchResult

  $: hasSelection = selection != null
  $: hasSelectionContents = selection != null && selection.paths != null
  $: hasClipboardContents = clipboard != null && selection != null

  function handleToggleSearch() {
    showSearch = !showSearch
  }

  function clearSearchResult () {
    showSearch = false
    onSearchText('')
  }

  function handleInsertValue () {
    console.log('TODO: insert value')
  }

  /** @type {MenuDropdownItem[]} */
  const insertItems = [
    {
      text: "Insert value",
      onClick: handleInsertValue,
      default: true
    },
    {
      text: "Insert object",
      onClick: () => {
        console.log('TODO: insert object')
      }
    },
    {
      text: "Insert array",
      onClick: () => {
        console.log('TODO: insert array')
      }
    },
    {
      text: "Insert structure",
      onClick: () => {
        console.log('TODO: insert structure')
      }
    }
  ]
</script>

<div class="menu">
  <button
    class="button cut"
    on:click={onCut}
    disabled={!hasSelectionContents}
    title="Cut (Ctrl+X)"
  >
    <Icon data={faCut} />
  </button>
  <button
    class="button copy"
    on:click={onCopy}
    disabled={!hasSelectionContents}
    title="Copy (Ctrl+C)"
  >
    <Icon data={faCopy} />
  </button>
  <button
    class="button paste"
    on:click={onPaste}
    disabled={!hasClipboardContents}
    title="Paste (Ctrl+V)"
  >
    <Icon data={faPaste} />
  </button>

  <div class="separator"></div>

  <button
    class="button duplicate"
    on:click={onDuplicate}
    disabled={!hasSelectionContents}
    title="Duplicate (Ctrl+D)"
  >
    <Icon data={faClone} />
  </button>

  <DropdownMenu 
    items={insertItems} 
    title="Insert new value (Ctrl+Insert)"
    disabled={!hasSelection}
  >
    <button 
      class="button insert"
      slot="defaultItem" 
      on:click={handleInsertValue}
      disabled={!hasSelection}
    >
      <Icon data={faPlus} />
    </button>
  </DropdownMenu>

  <div class="separator"></div>

  <button
    class="button search"
    on:click={handleToggleSearch}
    title="Search (Ctrl+F)"
  >
    <Icon data={faSearch} />
  </button>

  <div class="separator"></div>

  <button
    class="button undo"
    disabled={!historyState.canUndo}
    on:click={onUndo}
    title="Undo (Ctrl+Z)"
  >
    <Icon data={faUndo} />
  </button>
  <button
    class="button redo"
    disabled={!historyState.canRedo}
    on:click={onRedo}
    title="Redo (Ctrl+Shift+Z)"
  >
    <Icon data={faRedo} />
  </button>

  <div class="space"></div>

  {#if showSearch}
    <div class="search-box-container">
      <SearchBox
        text={searchText}
        resultCount={searchResult ? searchResult.count : 0}
        activeIndex={searchResult ? searchResult.activeIndex : 0}
        onChange={onSearchText}
        onNext={onNextSearchResult}
        onPrevious={onPreviousSearchResult}
        onClose={clearSearchResult}
      />
    </div>
  {/if}
</div>

<style src="./Menu.scss"></style>

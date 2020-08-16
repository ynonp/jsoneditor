<svelte:options immutable={true} />

<script>
  import { debounce } from 'lodash-es'
  import Icon from 'svelte-awesome'
  import { faSearch, faChevronDown, faChevronUp, faTimes } from '@fortawesome/free-solid-svg-icons'
  import { DEBOUNCE_DELAY } from '../../constants.js'
  import { keyComboFromEvent } from '../../utils/keyBindings.js'

  export let text = ''
  let inputText = ''
  export let resultCount = 0
  export let activeIndex = 0
  export let onChange = () => {}
  export let onPrevious = () => {}
  export let onNext = () => {}
  export let onClose = () => {}

  $: onChangeDebounced = debounce(onChange, DEBOUNCE_DELAY)

  function handleSubmit (event) {
    event.preventDefault()

    const pendingChanges = text !== inputText
    if (pendingChanges) {
      onChangeDebounced.cancel()
      onChange(inputText)
    } else {
      onNext()
    }
  }

  function handleInput (event) {
    inputText = event.target.value

    onChangeDebounced(inputText)
    // TODO: fire debounced onChange
  }

  function handleKeyDown (event) {
    const combo = keyComboFromEvent(event)

    if (combo === 'Ctrl+Enter' || combo === 'Command+Enter') {
      event.preventDefault()
      // TODO: move focus to the active element
    }

    if (combo === 'Escape') {
      event.preventDefault()

      onClose()
    }
  }

  function initSearchInput (element) {
    element.select()
  }
</script>

<div class="search-box">
  <form class="search-form" on:submit={handleSubmit} on:keydown={handleKeyDown}>
    <button class="search-icon">
      <Icon data={faSearch} />
    </button>
    <label about="search input">
      <input
        class="search-input"
        type="text"
        value={text}
        on:input={handleInput}
        use:initSearchInput
      />
    </label>
    <div class="search-count" class:visible={text !== ''}>
      {activeIndex + 1}/{resultCount}
    </div>
    <button class="search-next" on:click={onNext} type="button">
      <Icon data={faChevronDown} />
    </button>
    <button class="search-previous" on:click={onPrevious} type="button">
      <Icon data={faChevronUp} />
    </button>
    <button class="search-clear" on:click={onClose} type="button">
      <Icon data={faTimes} />
    </button>
  </form>
</div>

<style src="./SearchBox.scss"></style>

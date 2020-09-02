<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import { compileJSONPointer } from '../../utils/jsonPointer'
  import Header from './Header.svelte'
  import { transformModalState } from './transformModalState.js'

  export let id
  export let json
  export let rootPath
  export let onTransform

  const DEFAULT_QUERY = 'function query (data) {\n  return data\n}'

  const {close} = getContext('simple-modal')

  let stateId = `${id}:${compileJSONPointer(rootPath)}`

  let query = transformModalState[stateId]?.query || DEFAULT_QUERY
  let previewHasError = false
  let preview = ''

  function evalTransform(json, query) {
    // TODO: replace unsafe eval with a JS based query language 
    const queryFn = eval(`(${query})`)
    return queryFn(json)
  }

  function previewTransform(json, query) {
    try {
      const jsonTransformed = evalTransform(json, query)

      preview = JSON.stringify(jsonTransformed, null, 2) // TODO: limit preview length
      previewHasError = false
    } catch (err) {
      preview = err.toString()
      previewHasError = true
    }
  }

  $: {
    previewTransform(json, query)
  }

  function handleTransform () {
    try {
      const jsonTransformed = evalTransform(json, query)

      onTransform([
        {
          op: 'replace',
          path: compileJSONPointer(rootPath),
          value: jsonTransformed
        }
      ])

      // remember the selected values for the next time we open the SortModal
      // just in memory, not persisted
      transformModalState[stateId] = {
        query
      }

      close()
    } catch (err) {
      // this should never occur since we can only press the Transform 
      // button when creating a preview was succesful
      console.error(err)
      preview = err.toString()
      previewHasError = true
    }

  }

</script>

<div class="jsoneditor-modal transform">
  <Header title='Transform' />
  <div class="contents">
    <div class='description'>
      Enter a JavaScript function to filter, sort, or transform the data.
    </div>

    <label>Query</label>
    <textarea class="query" bind:value={query} />

    <label>Preview</label>
    <textarea
      class="preview" 
      class:error={previewHasError}
      bind:value={preview} 
      readonly 
    />

    <div class="actions">
      <button 
        class="primary"
        on:click={handleTransform} 
        disabled={previewHasError}
      >
        Transform
      </button>
    </div>
  </div>
</div>

<style src="./TransformModal.scss"></style>

<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import { debounce } from 'lodash-es'
  import { compileJSONPointer } from '../../utils/jsonPointer.js'
  import Header from './Header.svelte'
  import { transformModalState } from './transformModalState.js'
  import { DEBOUNCE_DELAY, MAX_PREVIEW_CHARACTERS } from '../../constants.js'
  import { truncate } from '../../utils/stringUtils.js'
  import TransformWizard from './TransformWizard.svelte'
  import * as _ from 'lodash-es'
  import { getIn } from '../../utils/immutabilityHelpers.js'

  export let id
  export let json
  export let rootPath
  export let onTransform

  const DEFAULT_QUERY = 'function query (data) {\n  return data\n}'

  const {close} = getContext('simple-modal')

  let stateId = `${id}:${compileJSONPointer(rootPath)}`

  let query = (transformModalState[stateId] && transformModalState[stateId].query) || DEFAULT_QUERY
  let previewHasError = false
  let preview = ''

  function evalTransform(json, query) {
    // FIXME: replace unsafe new Function with a JS based query language 
    //  As long as we don't persist or fetch queries, there is no security risk.
    // TODO: only import the most relevant subset of lodash instead of the full library?
    const queryFn = new Function('_', `'use strict'; return (${query})`)(_)
    return queryFn(json)
  }

  function updateQuery (newQuery) {
    console.log('updated query by wizard', newQuery)
    query = newQuery
  }

  function previewTransform(json, query) {
    try {
      const jsonTransformed = evalTransform(json, query)

      preview = truncate(JSON.stringify(jsonTransformed, null, 2), MAX_PREVIEW_CHARACTERS)
      previewHasError = false
    } catch (err) {
      preview = err.toString()
      previewHasError = true
    }
  }

  const previewTransformDebounced = debounce(previewTransform, DEBOUNCE_DELAY)

  $: {
    previewTransformDebounced(json, query)
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
    <div class='description'>
      You can use <a href='https://lodash.com' target='_blank' rel='noopener noreferrer'>Lodash</a> 
      functions like <code>_.map</code>, <code>_.filter</code>,
      <code>_.orderBy</code>, <code>_.sortBy</code>, <code>_.groupBy</code>,
      <code>_.pick</code>, <code>_.uniq</code>, <code>_.get</code>, etcetera.
    </div>

    <label>Wizard</label>
    {#if Array.isArray(json)}
      <TransformWizard json={json} onQuery={updateQuery} />
    {:else}
      (Only available for arrays, not for objects)
    {/if}
    
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

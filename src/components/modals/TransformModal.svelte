<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import Icon from 'svelte-awesome'
  import { debounce } from 'lodash-es'
  import { compileJSONPointer } from '../../utils/jsonPointer.js'
  import Header from './Header.svelte'
  import { transformModalState } from './transformModalState.js'
  import { DEBOUNCE_DELAY, MAX_PREVIEW_CHARACTERS } from '../../constants.js'
  import { truncate } from '../../utils/stringUtils.js'
  import TransformWizard from './TransformWizard.svelte'
  import * as _ from 'lodash-es'
  import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'

  export let id
  export let json
  export let rootPath
  export let onTransform

  const DEFAULT_QUERY = 'function query (data) {\n  return data\n}'

  const { close } = getContext('simple-modal')

  const stateId = `${id}:${compileJSONPointer(rootPath)}`

  const state = transformModalState[stateId] || {}

  let query = state.query || DEFAULT_QUERY
  let previewHasError = false
  let preview = ''

  // showWizard is not stored inside a stateId
  let showWizard = transformModalState.showWizard !== false
  
  let filterField = state.filterField
  let filterRelation = state.filterRelation
  let filterValue = state.filterValue
  let sortField = state.sortField
  let sortDirection = state.sortDirection
  let pickFields = state.pickFields

  function evalTransform (json, query) {
    // FIXME: replace unsafe new Function with a JS based query language
    //  As long as we don't persist or fetch queries, there is no security risk.
    // TODO: only import the most relevant subset of lodash instead of the full library?
    // eslint-disable-next-line no-new-func
    const queryFn = new Function('_', `'use strict'; return (${query})`)(_)
    return queryFn(json)
  }

  function updateQuery (newQuery) {
    console.log('updated query by wizard', newQuery)
    query = newQuery
  }

  function previewTransform (json, query) {
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
        query,
        filterField,
        filterRelation,
        filterValue,
        sortField,
        sortDirection,
        pickFields
      }

      close()
    } catch (err) {
      // this should never occur since we can only press the Transform
      // button when creating a preview was successful
      console.error(err)
      preview = err.toString()
      previewHasError = true
    }
  }

  function toggleShowWizard () {
    showWizard = !showWizard

    // not stored inside a stateId
    transformModalState.showWizard = showWizard
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

    <div class="label">
      <button on:click={toggleShowWizard}>
        <Icon data={showWizard ? faCaretDown : faCaretRight} />
        Wizard
      </button>
    </div>
    {#if showWizard}
      {#if Array.isArray(json)}
        <TransformWizard 
          bind:filterField
          bind:filterRelation
          bind:filterValue
          bind:sortField
          bind:sortDirection
          bind:pickFields
          json={json} 
          onQuery={updateQuery}
        />
      {:else}
        (Only available for arrays, not for objects)
      {/if}
    {/if}

    <div class="label">
      Query
    </div>
    <textarea class="query" bind:value={query}></textarea>

    <div class="label">Preview</div>
    <textarea
      class="preview" 
      class:error={previewHasError}
      bind:value={preview} 
      readonly 
    ></textarea>

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

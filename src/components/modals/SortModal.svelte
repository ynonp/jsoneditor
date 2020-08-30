<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import Select from 'svelte-select'
  import Header from './Header.svelte'
  import { getNestedPaths } from '../../utils/arrayUtils.js'
  import { isObject } from '../../utils/typeUtils.js'
  import { stringifyPath } from '../../utils/pathUtils.js'
  import { sortArray, sortObjectKeys } from '../../logic/sort.js'

  export let json
  export let rootPath
  export let onSort

  const {close} = getContext('simple-modal')

  $: json
  $: jsonIsArray = Array.isArray(json)
  $: paths = jsonIsArray ? getNestedPaths(json) : undefined
  $: properties = paths?.map(pathToOption)

  const asc = {
    value: 1,
    label: 'ascending'
  }
  const desc = {
    value: -1,
    label: 'descending'
  }
  const directions = [ asc, desc ]

  let selectedProperty = undefined
  let selectedDirection = asc

  $: {
    // if there is only one option, select it and do not render the select box
    if (selectedProperty === undefined && properties && properties.length === 1) {
      selectedProperty = properties[0]
    }
  }

  function pathToOption (path) {
    return { 
        value: path, 
        label: stringifyPath(path) 
    }
  }

  function handleSort () {
    // TODO: create a sortBy which returns a JSONPatch document containing move operations

    if (jsonIsArray) {
      if (!selectedProperty) {
        return
      }

      const property = selectedProperty.value
      const direction = selectedDirection.value
      const operations = sortArray(json, rootPath, property, direction)

      onSort(operations)
    } else if (isObject(json)) {
      const direction = selectedDirection.value
      const operations = sortObjectKeys(json, rootPath, direction)
      
      onSort(operations)
    } else {
      console.error('Cannot sort: no array or object')
    }

    close()
  }
</script>

<div class="jsoneditor-modal sort">
  <Header title={jsonIsArray ? 'Sort array items' : 'Sort object keys'} />

  <div class="contents">
    <table>
      <colgroup>
        <col width="25%">
        <col width="75%">
      </colgroup>
      <tbody>
        {#if rootPath.length > 0}
          <tr>
            <th>Path</th>
            <td>
              <input 
                class="path"
                type="text" 
                readonly 
                value={stringifyPath(rootPath)} 
              />
            </td>
          </tr>
        {/if}
        {#if jsonIsArray && (properties.length > 1 || selectedProperty === undefined) }
          <tr>
            <th>Property</th>
            <td>
              <Select 
                items={properties} 
                bind:selectedValue={selectedProperty} 
              />
            </td>
          </tr>
        {/if}
        <tr>
          <th>Direction</th>
          <td>
            <Select 
              items={directions} 
              containerClasses='test-class'
              bind:selectedValue={selectedDirection} 
              isClearable={false}
            />
          </td>
        </tr>
      </tbody>
    </table>
  
    <div class="actions">
      <button 
        class="primary" 
        on:click={handleSort} 
        disabled={jsonIsArray ? !selectedProperty : false}
      >
        Sort
      </button>
    </div>
  </div>
</div>

<style src="./SortModal.scss"></style>

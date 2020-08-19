<svelte:options immutable={true} />

<script>
  import { getContext } from 'svelte'
  import naturalSort from 'javascript-natural-sort'
  import Select from 'svelte-select'
  import Header from './Header.svelte'
  import { getNestedPaths } from '../../utils/arrayUtils.js'
  import { getIn, setIn } from '../../utils/immutabilityHelpers.js'
  import { isObject } from '../../utils/typeUtils.js'

  export let json
  export let path
  export let onSort

  const {close} = getContext('simple-modal')

  $: root = getIn(json, path) 
  $: isArray = Array.isArray(root)
  $: paths = isArray ? getNestedPaths(root) : undefined
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

  function pathToOption (path) {
    return { 
        value: path, 
        label: path.join('.') 
    }
  }

  function sortArray (array, property, direction) {
    function comparator (a, b) {
      const valueA = getIn(a, property)
      const valueB = getIn(b, property)

      if (valueA === undefined) {
        return direction
      }
      if (valueB === undefined) {
        return -direction
      }

      if (typeof valueA !== 'string' && typeof valueB !== 'string') {
        // both values are a number, boolean, or null -> use simple, fast sorting
        return valueA > valueB 
          ? direction 
          : valueA < valueB 
            ? -direction 
            : 0
      }

      return direction * naturalSort(valueA, valueB)
    }

    // TODO: use lodash orderBy, split comparator and direction?
    const sortedArray = array.slice()
    sortedArray.sort(comparator)

    return sortedArray
  }

  function sortObjectKeys (object, direction) {
    const keys = Object.keys(object)
    keys.sort((keyA, keyB) => {
      return direction * naturalSort(keyA, keyB)
    })
    
    const sortedObject = {}
    keys.forEach(key => sortedObject[key] = object[key])

    return sortedObject
  }

  function handleSort () {
    // TODO: create a sortBy which returns a JSONPatch document containing move operations

    if (Array.isArray(root)) {
      if (!selectedProperty) {
        return
      }

      const property = selectedProperty.value
      const direction = selectedDirection.value
      const sorted = sortArray(root, property, direction)

      onSort(setIn(json, path, sorted))
    } else if (isObject(root)) {
      const direction = selectedDirection.value
      const sorted = sortObjectKeys(root, direction)

      // FIXME: the keys are now sorted, but the JSONEditor refuses to reorder when already rendered -> need to do a JSONPatch 
      console.log('sorted object keys:', Object.keys(sorted))

      onSort(setIn(json, path, sorted))
    } else {
      console.error('Cannot sort: no array or object')
    }

    close()
  }
</script>

<div class="jsoneditor-modal sort">
  <Header title={isArray ? 'Sort array items' : 'Sort object keys'} />

  <div class="contents">
    <table>
      <colgroup>
        <col width="25%">
        <col width="75%">
      </colgroup>
      <tbody>
        {#if path.length > 0}
          <tr>
            <th>Path</th>
            <td>{path.join('.')}</td>
          </tr>
        {/if}
        {#if isArray}
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
        disabled={isArray ? !selectedProperty : false}
      >
        Sort
      </button>
    </div>
  </div>
</div>

<style src="./SortModal.scss"></style>

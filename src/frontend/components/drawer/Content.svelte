<script lang="ts">
  import type { Show } from "../../../types/Show"

  import { drawerTabsData, shows } from "../../stores"
  import ShowButton from "../inputs/ShowButton.svelte"

  export let id: string
  export let searchValue: string
  $: active = $drawerTabsData[id].activeSubTab

  $: sva = searchValue
    .toLowerCase()
    // .replace(/[^\w\s,]/g, "")
    .replace(/[.\/#!$%\^&\*;:{}=\-_`~() ]/g, "")
    .split(",")
  const searchIncludes = (s: string, sv: string): boolean =>
    s
      ?.toLowerCase()
      // .replace(/[^\w\s]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~() ]/g, "")
      .includes(sv)
  const searchEquals = (s: string, sv: string): boolean =>
    s
      ?.toLowerCase()
      // .replace(/[^\w\s]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~() ]/g, "") === sv

  let totalMatch: number = 0
  $: totalMatch = searchValue ? 0 : 0
  function search(obj: Show): number {
    let match: any[] = []

    sva.forEach((sv, i) => {
      if (sv.length > 1) {
        match[i] = 0
        if (searchEquals(obj.name, sv)) match[i] = 100
        else if (searchIncludes(obj.name, sv)) match[i] += 25
        // if (obj.category !== null && searchIncludes($categories[obj.category].name, sv)) match[i] += 10

        Object.values(obj.slides).forEach((slide) => {
          slide.items.forEach((item) => {
            item.text?.forEach((box) => {
              if (searchIncludes(box.value, sv)) match[i] += 5
            })
          })
        })
      }
    })

    let sum = 0
    let hasZero = match.some((m) => {
      sum += m
      return m === 0
    })

    if (hasZero) sum = 0

    totalMatch += sum
    return Math.min(sum, 100)
  }
</script>

<!-- TODO: sort by percentage -->
<!-- TODO: go to first on input enter -->

<div>
  {#if id === "shows"}
    {#if Object.entries($shows).length}
      {#each Object.entries($shows) as show}
        <!-- {#key searchValue} -->
        {#if (active === "all" || active === show[1].category || (active === "unlabeled" && show[1].category === null)) && (searchValue.length <= 1 || search(show[1]))}
          <ShowButton id={show[0]} name={show[1].name} match={[search(show[1]), searchValue]} />
        {/if}
        <!-- {/key} -->
      {/each}
      <!-- TODO: not updating values on activeSubTab change -->
      {#if searchValue.length > 1 && totalMatch === 0}
        No match
      {/if}
    {:else}
      No shows
    {/if}
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    /* width: 100%; */
    flex-grow: 1;
    /* height: 50%; */
    overflow-y: auto;
    background-color: var(--primary-darker);
    /* height: 100%; */
  }
</style>

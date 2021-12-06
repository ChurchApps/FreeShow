<script lang="ts">
  import { FOLDER_READ } from "../../../types/Channels"

  import type { Show } from "../../../types/Show"

  import { drawerTabsData, mediaFolders, shows } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import ShowButton from "../inputs/ShowButton.svelte"
  import Media from "./Media.svelte"
  import Cameras from "./live/Cameras.svelte"
  import Microphones from "./live/Microphones.svelte"
  import Windows from "./live/Windows.svelte"
  import Overlays from "./Overlays.svelte"
  import Scripture from "./bible/Scripture.svelte"
  import Draggable from "../system/Draggable.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import { keysToID, sortObject, removeValues } from "../helpers/array"

  export let id: string
  export let bible: any
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

  // get list of files
  interface Files {
    [key: string]: string
  }
  let files: Files = {}
  mediaFolders.subscribe((mf) => {
    Object.entries(mf).forEach((folder) => {
      window.api.send(FOLDER_READ, { id: folder[0], url: folder[1].url, filters: ["png", "jpg", "jpeg", "mp4", "mov"] })
    })
  })
  window.api.receive(FOLDER_READ, (message: any) => {
    files[message.id] = message.data || []
  })
  $: console.log(files)

  // sort shows in alphabeticly order
  let showsSorted: any
  shows.subscribe((s) => {
    showsSorted = removeValues(sortObject(keysToID(s), "name"), "private", true)
  })
</script>

<!-- TODO: sort by percentage -->
<!-- TODO: go to first on input enter -->

<div>
  {#if id === "shows"}
    {#if Object.entries($shows).length}
      <div class="column">
        {#each showsSorted as show, index}
          <Draggable id="show_drawer" {index}>
            <SelectElem id="show_drawer" data={{ id: show.id, index }}>
              <!-- {#key searchValue} -->
              {#if (active === "all" || active === show.category || (active === "unlabeled" && show.category === null)) && (searchValue.length <= 1 || search(show))}
                <ShowButton id={show.id} name={show.name} match={[search(show), searchValue]} />
              {/if}
              <!-- {/key} -->
            </SelectElem>
          </Draggable>
        {/each}
        <!-- TODO: not updating values on activeSubTab change -->
        {#if searchValue.length > 1 && totalMatch === 0}
          No match
        {/if}
      </div>
    {:else}
      <div class="center">No shows</div>
    {/if}
  {:else if id === "backgrounds"}
    <div class="grid">
      {#if active === "all"}
        {#key $mediaFolders}
          {#each Object.entries(files) as fileList}
            {#each fileList[1] as name}
              <Media {name} id={fileList[0]} />
            {/each}
          {/each}
        {/key}
      {:else if active && files[active].length}
        {#key active}
          {#each files[active] as name}
            <Media {name} id={active} />
          {/each}
        {/key}
      {:else}
        <div class="center">
          <Icon id="noImage" size={5} />
        </div>
      {/if}
    </div>
  {:else if id === "overlays"}
    <div class="grid">
      <Overlays />
    </div>
  {:else if id === "scripture"}
    <Scripture {active} bind:bible />
  {:else if id === "live"}
    <div class="grid">
      <!-- live -->
      <!-- screens -->
      {#if active === "windows"}
        <Windows />
      {:else if active === "cameras"}
        <Cameras />
      {:else if active === "microphones"}
        <Microphones />
      {/if}
    </div>
  {/if}
</div>

<style>
  div {
    display: flex;
    /* flex-direction: column; */
    flex: 1;
    overflow-y: auto;
    background-color: var(--primary-darker);
  }

  .column {
    flex-direction: column;
  }

  .center {
    justify-content: center;
    align-items: center;
    font-size: 1.5em;
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px;
  }
</style>

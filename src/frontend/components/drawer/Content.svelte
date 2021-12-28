<script lang="ts">
  import { FOLDER_READ } from "../../../types/Channels"
  import type { Show } from "../../../types/Show"
  import { activeShow, dictionary, drawerTabsData, mediaFolders, shows } from "../../stores"
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
  import { keysToID, sortObject, sortObjectNumbers, removeValues } from "../helpers/array"
  import Center from "../system/Center.svelte"
  import { history } from "../helpers/history"
  import Button from "../inputs/Button.svelte"
  import T from "../helpers/T.svelte"
  import { dateToString } from "../helpers/time"
  import Autoscroll from "../system/Autoscroll.svelte"

  export let id: string
  export let bible: any
  export let searchValue: string
  $: active = $drawerTabsData[id].activeSubTab

  $: sva = searchValue
    .toLowerCase()
    // .replace(/[^\w\s,]/g, "")
    .replace(/[.\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    .split(",")
  // .replace(/[^\w\s]/g, "")
  const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
  const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
  const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

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
            let text = ""
            item.text?.forEach((box) => {
              text += box.value
            })
            if (text.length) {
              if (searchEquals(text, sv)) match[i] += 20
              else if (searchIncludes(text, sv)) {
                // TODO: more specific match
                // console.log(sv, filter(text))
                // match[i] += (10 * (sv.length / filter(text).length)).toFixed()
                match[i] += 10
              }
            }
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
  interface ShowId extends Show {
    id: string
    match?: number
  }
  let filteredShows: ShowId[]
  $: {
    filteredStored = filteredShows = showsSorted.filter((s: any) => active === "all" || active === s.category || (active === "unlabeled" && s.category === null))
  }

  let filteredStored: any
  export let firstMatch: null | string = null
  $: {
    if (searchValue.length > 1) {
      filteredShows = []
      filteredStored.forEach((s: any) => {
        let match = search(s)
        if (match) filteredShows.push({ ...s, match })
      })
      filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowId[]
      firstMatch = filteredShows[0]?.id || null
    } else {
      filteredShows = filteredStored
      firstMatch = null
    }
  }

  let scrollElem: any
  let offset: number = -1
  $: {
    if (id && $activeShow !== null) {
      if (id === "shows" && $activeShow.type === null && scrollElem !== undefined) offset = scrollElem.querySelector("#" + $activeShow.id)?.offsetTop - scrollElem.offsetTop
    }
  }
</script>

<!-- TODO: sort by percentage -->
<!-- TODO: go to first on input enter -->
<div class="main">
  {#if id === "shows"}
    <Autoscroll {offset} bind:scrollElem style="overflow-y: auto;flex: 1;">
      <div class="column context #drawer_show">
        {#if filteredShows.length}
          {#each filteredShows as show, index}
            <Draggable id="show_drawer" {index}>
              <SelectElem id="show_drawer" data={{ id: show.id, index }}>
                {#if searchValue.length <= 1 || show.match}
                  <ShowButton
                    id={show.id}
                    name={show.name}
                    data={dateToString(show.timestamps.created, true)}
                    class="#drawer_show_button__drawer_show"
                    match={show.match || null}
                  />
                {/if}
              </SelectElem>
            </Draggable>
          {/each}
          <!-- TODO: not updating values on activeSubTab change -->
          {#if searchValue.length > 1 && totalMatch === 0}
            <Center size={1.5} faded>[[[No match]]]</Center>
          {/if}
        {:else}
          <Center size={1.5} faded>[[[No shows]]]</Center>
        {/if}
      </div>
    </Autoscroll>
    <div class="tabs">
      <Button style="flex: 1;" on:click={() => history({ id: "newShowDrawer" })} center title={$dictionary.new?.show}>
        <Icon id="showIcon" style="padding-right: 10px;" />
        <span style="color: var(--secondary);">
          <T id="new.show" />
        </span>
      </Button>
    </div>
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
        <Center>
          <Icon id="noImage" size={5} />
        </Center>
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
  .main,
  .column {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-darker);
    flex: 1;
  }

  .tabs {
    display: flex;
    background-color: var(--primary-darkest);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    gap: 10px;
    padding: 10px;
  }
</style>

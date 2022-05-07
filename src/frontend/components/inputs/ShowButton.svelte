<script lang="ts">
  import { activeProject, activeShow, categories, notFound, outBackground, outLocked, outSlide, playerVideos, projects, shows, showsCache } from "../../stores"
  import { historyAwait } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { checkName } from "../helpers/show"
  import Button from "./Button.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let id: string
  export let show: any = {}
  export let data: null | string = null
  export let index: null | number = null
  $: type = show.type || "show"
  $: name = type === "show" ? $shows[show.id]?.name : type === "player" ? ($playerVideos[id] ? $playerVideos[id].name : setNotFound(id)) : show.name
  // export let page: "side" | "drawer" = "drawer"
  export let match: null | number = null
  // TODO: svelte animate
  // search
  $: style = match !== null ? `background: linear-gradient(to right, var(--secondary-opacity) ${match}%, transparent ${match}%);` : ""

  function setNotFound(id: string) {
    notFound.update((a) => {
      a.show.push(id)
      return a
    })
    return id
  }

  $: newName = name === null && (type === "image" || type === "video") ? getPathName(id) : name || ""

  const getPathName = (path: string) => {
    let name = path.substring(path.lastIndexOf("\\") + 1)
    return name.slice(0, name.lastIndexOf(".")) || path
  }

  // export let location;
  // export let access;

  export let icon: boolean = false
  let iconID: null | string = null
  let custom: boolean = false
  $: {
    if (icon) {
      custom = false
      if (type === "show") {
        if ($shows[show.id]?.private) iconID = "private"
        else if ($shows[show.id]?.category && $categories[$shows[show.id].category || ""]) {
          custom = true
          iconID = $categories[$shows[show.id].category || ""].icon || null
        } else iconID = "noIcon"
      }
      // else if (type === "player") iconID = "live"
      else iconID = type
    }
  }
  // export let category: string
  // const check = () => {
  //   if (!category[1]) return category[0]
  //   // else if (category[0].toLowerCase().includes('song') || category[0].toLowerCase().includes('music')) return 'song';
  //   else if (category[0].toLowerCase().includes("info") || category[0].toLowerCase().includes("presentation")) return "presentation"
  //   else return "song"
  // }
  // $: icon = check()
  $: active = index !== null ? $activeShow?.index === index : $activeShow?.id === id

  let editActive: boolean = false
  function click(e: any) {
    if (editActive) return

    // set active show
    let pos = index
    if (index === null && $activeProject !== null) {
      let i = $projects[$activeProject].shows.findIndex((p) => p.id === id)
      if (i > -1) pos = i
    }

    if (!e.ctrlKey && !e.metaKey && !active && !e.target.closest("input")) {
      let show: any = { id, type }
      if (pos !== null) {
        show.index = pos

        if ($showsCache[id]) {
          // set active layout from project
          if ($projects[$activeProject!].shows[pos].layout) {
            showsCache.update((a) => {
              a[id].settings.activeLayout = $projects[$activeProject!].shows[pos!].layout!
              return a
            })
          }

          // set project layout
          projects.update((a) => {
            a[$activeProject!].shows[pos!].layout = $showsCache[id].settings.activeLayout
            return a
          })
        }
      }
      activeShow.set(show)
    }
  }

  function doubleClick(e: any) {
    if (editActive || $outLocked || e.target.closest("input")) return

    if (type === "show" && $showsCache[id] && $showsCache[id].layouts[$showsCache[id].settings.activeLayout].slides.length)
      outSlide.set({ id, layout: $showsCache[id].settings.activeLayout, index: 0 })
    else if (type === "image" || type === "video") {
      let out: any = { path: id, muted: show.muted || false, loop: show.loop || false, type: "media" }
      if (index && $activeProject && $projects[$activeProject].shows[index].filter) out.filter = $projects[$activeProject].shows[index].filter
      outBackground.set(out)
    } else if (type === "player") outBackground.set({ id, type: "player" })
  }

  function edit(e: any) {
    historyAwait([id], { id: "updateShow", newData: { key: "name", values: [checkName(e.detail.value)] }, location: { page: index === null ? "drawer" : "show", shows: [{ id }] } })
  }
</script>

<div {id} class="main">
  <!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{newName}</span> -->
  <!-- WIP padding-left: 0.8em; -->
  <Button on:click={click} on:dblclick={doubleClick} {active} class="context {$$props.class}" {style} bold={false} border red={$notFound.show?.includes(id)}>
    <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
      {#if iconID}
        <Icon id={iconID} {custom} right />
      {/if}
      <!-- <p style="margin: 5px;">{newName}</p> -->
      <HiddenInput value={newName} id={index !== null ? "show_" + id + "#" + index : "show_drawer_" + id} on:edit={edit} bind:edit={editActive} allowEmpty={false} />
    </span>

    {#if match}
      <span style="opacity: 0.8;padding-left: 10px;">
        {match}%
      </span>
    {/if}

    {#if data}
      <span style="opacity: 0.5;padding-left: 10px;">{data}</span>
    {/if}
  </Button>
</div>

<style>
  .main :global(button) {
    width: 100%;
    justify-content: space-between;
  }
</style>

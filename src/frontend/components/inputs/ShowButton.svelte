<script lang="ts">
  import { activeProject, activeShow, categories, outBackground, outLocked, outSlide, projects, shows } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let id: string
  export let show: any = {}
  export let data: null | string = null
  export let index: null | number = null
  $: type = show.type || "show"
  $: name = type === "show" || type === "private" ? $shows[show.id].name : show.name
  // export let page: "side" | "drawer" = "drawer"
  export let match: null | number = null
  // TODO: svelte animate
  // search
  $: style = match !== null ? `background: linear-gradient(to right, var(--secondary-opacity) ${match}%, transparent ${match}%);` : ""

  $: newName = name === null && (type === "image" || type === "video") ? getPathName(id) : name
  $: console.log(type, id, newName)

  const getPathName = (path: string) => {
    let name = path.substring(path.lastIndexOf("\\") + 1)
    console.log(name.slice(0, name.lastIndexOf(".")) || path)

    return name.slice(0, name.lastIndexOf(".")) || path
  }

  // export let location;
  // export let access;

  export let icon: boolean = false
  let iconID: null | string = null
  $: {
    if (icon) {
      if (type === "show" || type === "private") {
        if ($shows[show.id]?.private) iconID = "private"
        else if ($shows[show.id].category) iconID = $categories[$shows[show.id].category || ""].icon || null
        else iconID = "noIcon"
      } else iconID = type
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
  $: console.log(index, $activeShow?.index)

  function click(e: any) {
    // set active show
    let pos = index
    if (index === null && $activeProject !== null) {
      let i = $projects[$activeProject].shows.findIndex((p) => p.id === id)
      if (i > -1) pos = i
    }

    if (!e.ctrlKey && !active && !e.target.closest("input")) {
      let show: any = { id, type }
      if (pos !== null) show.index = pos
      activeShow.set(show)
    }
  }

  function doubleClick() {
    if (!$outLocked) {
      if ((type === "show" || type === "private") && $shows[id]) outSlide.set({ id, layout: $shows[id].settings.activeLayout, index: 0 })
      else if (type === "image" || type === "video") {
        let out: any = { path: id, muted: show.muted || true, loop: show.loop || false, type: "media" }
        if (index && $activeProject && $projects[$activeProject].shows[index].filter) out.filter = $projects[$activeProject].shows[index].filter
        outBackground.set(out)
      }
    }
  }

  function edit(event: any) {
    shows.update((s: any) => {
      s[id].name = event.detail.value
      return s
    })
  }
</script>

<div {id} class="main">
  <!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{newName}</span> -->
  <!-- WIP padding-left: 0.8em; -->
  <Button on:click={click} on:dblclick={doubleClick} {active} class="context {$$props.class}" {style} bold={false} border>
    <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
      {#if iconID}
        <Icon id={iconID} />
      {/if}
      <!-- <p style="margin: 5px;">{newName}</p> -->
      <HiddenInput value={newName} on:edit={edit} />
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

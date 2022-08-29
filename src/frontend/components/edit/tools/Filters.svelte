<script lang="ts">
  import { activeEdit, activeShow, media, outputs } from "../../../stores"
  import { getActiveOutputs, setOutput } from "../../helpers/output"
  import T from "../../helpers/T.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"

  export let resetFilters: boolean
  $: mediaId = $activeEdit.id || $activeShow?.id

  function updateFilters(id: string, value: number) {
    if (!mediaId) return

    filters[id].value = Number(value)
    let styles: string = getFilter()

    // TODO: edit in project
    // $: project = $activeProject && $activeShow?.index ? $projects[$activeProject].shows[$activeShow!.index] : null
    // projects.update((a: any) => {
    //   let show = a[$activeProject!].shows[$activeShow!.index!]
    //   if (!show.filter) show.filter = []
    //   show.filter[id] = value + (filters[id].suffix || "")
    //   return a
    // })

    media.update((a: any) => {
      if (!a[mediaId!]) a[mediaId!] = { filter: {} }
      // if (!a[mediaId].filter) a[mediaId].filter = {}
      a[mediaId!].filter[id] = value + (filters[id].suffix || "")
      return a
    })

    let currentOutput: any = $outputs[getActiveOutputs()[0]]
    if (currentOutput.out?.background && currentOutput.out?.background.path === mediaId) {
      let bg = currentOutput.out.background
      bg.filter = styles
      setOutput("background", bg)
    }
  }

  function getFilter(): string {
    let style = ""
    Object.entries(filters).forEach(([id, a]: any) => {
      if (a.value !== a.default) style += ` ${id}(${a.value}${a.suffix || ""})`
    })
    return style
  }

  $: {
    if (mediaId && $media[mediaId]) {
      let temp: any = {}
      Object.entries(filters).forEach(([id, a]: any) => {
        a.value = $media[mediaId!].filter?.[id]?.replace(/[^0-9.]/g, "") || a.default
        temp[id] = a
      })
      filters = temp
    } else resetFilters = true
  }

  $: if (resetFilters) {
    let temp: any = {}
    Object.entries(filters).forEach(([id, a]: any) => {
      a.value = a.default
      temp[id] = a
    })
    filters = temp

    resetFilters = false
  }

  let filters: any = {
    "hue-rotate": { value: 0, default: 0, max: 360, suffix: "deg" },
    invert: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    blur: { value: 0, default: 0, max: 100, suffix: "px" },
    grayscale: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    sepia: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    brightness: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    contrast: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    saturate: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    opacity: { value: 1, default: 1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
  }
</script>

<div class="main border">
  <!-- <h2 style="text-align: center;">
    <T id="filter.filters" />
  </h2> -->
  {#each Object.keys(filters) as id}
    <span style="display: flex;align-items: center;margin: 2px 0;">
      <span style="flex: 1;"><T id="edit.{id}" /></span>
      <NumberInput {...filters[id]} on:change={(e) => updateFilters(id, e.detail)} />
    </span>
  {/each}
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: auto;
    height: 100%;
    padding: 10px;
  }

  .main :global(.numberInput) {
    flex: 1;
  }
</style>

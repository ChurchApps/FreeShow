<script lang="ts">
  import { activeProject, activeShow, outBackground, projects } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"

  let project: any = null
  $: project = $activeProject && $activeShow?.index ? $projects[$activeProject].shows[$activeShow!.index] : null
  // $: type = $activeShow!.type

  let index: number = -1
  function updateProject(id: string, value: number) {
    filters[id].value = Number(value)
    let styles: string = getFilter()

    projects.update((a: any) => {
      let show = a[$activeProject!].shows[$activeShow!.index!]
      if (!show.filter) show.filter = []
      show.filter[id] = value + (filters[id].suffix || "")
      return a
    })

    if ($outBackground && $outBackground.path === project.id) {
      outBackground.update((a: any) => {
        a.filter = styles
        return a
      })
    }

    if ($activeShow?.index) index = $activeShow.index
  }

  function getFilter(): string {
    let style = ""
    Object.entries(filters).forEach(([id, a]: any) => {
      if (a.value !== a.default) style += ` ${id}(${a.value}${a.suffix || ""})`
    })
    return style
  }

  $: {
    if ($activeShow?.index && $activeShow.index !== index) {
      let temp: any = {}
      Object.entries(filters).forEach(([id, a]: any) => {
        a.value = project.filter?.[id]?.replace(/[^0-9.]/g, "") || a.default
        temp[id] = a
      })
      filters = temp
      index = $activeShow!.index
    }
  }
  function reset() {
    let temp: any = {}
    Object.entries(filters).forEach(([id, a]: any) => {
      a.value = a.default
      temp[id] = a
    })
    filters = temp

    projects.update((a: any) => {
      let show = a[$activeProject!].shows[$activeShow!.index!]
      if (show.filter) delete show.filter
      return a
    })

    if ($outBackground) {
      outBackground.update((a) => {
        delete a?.filter
        return a
      })
    }
  }

  let filters: any = {
    blur: { value: 0, default: 0, max: 100, suffix: "px" },
    brightness: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    contrast: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    grayscale: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    "hue-rotate": { value: 0, default: 0, max: 360, suffix: "deg" },
    invert: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    opacity: { value: 1, default: 1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
    saturate: { value: 1, default: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 },
    sepia: { value: 0, default: 0, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 },
  }
</script>

<div class="main">
  <!-- {type} -->
  {#if project === null}
    <!-- TODO: edit any media -->
    (((Add to a project to make edits!)))
  {:else}
    <h2 style="text-align: center;">
      <T id="filter.filters" />
    </h2>
    <!-- {#if type === "video"}
      <Button style="flex: 0" center title={project.muted ? "Unmute" : "Mute"} on:click={() => updateProject("muted", !project.muted)}>
        <Icon id={project.muted ? "muted" : "volume"} size={1.2} />
      </Button>
      <Button style="flex: 0" center title="[[[Loop]]]" on:click={() => updateProject("loop", !project.loop)}>
        <Icon id="loop" white={!project.loop} size={1.2} />
      </Button>
    {/if} -->
    {#each Object.keys(filters) as id}
      <span style="display: flex;">
        <span style="flex: 1;"><T id="filter.{id}" /></span>
        <NumberInput {...filters[id]} on:change={(e) => updateProject(id, e.detail)} />
      </span>
    {/each}
    <Button on:click={reset} center>
      <T id="actions.reset" />
    </Button>
  {/if}
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: auto;
    height: 100%;
    padding: 10px;
    border-top: 2px solid var(--primary-lighter);
  }

  .main :global(.numberInput) {
    flex: 1;
  }
</style>

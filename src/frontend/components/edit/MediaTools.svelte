<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow, media, outBackground } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Tabs from "../main/Tabs.svelte"
  import Filters from "./tools/Filters.svelte"
  import MediaOptions from "./tools/MediaOptions.svelte"

  let tabs: TabsObj = {
    filters: { name: "", icon: "filter" },
    options: { name: "", icon: "options" },
  }
  let active: string = Object.keys(tabs)[0]

  let resetFilters: boolean = false
  function reset() {
    let mediaId = $activeEdit.id || $activeShow!.id
    if (active === "filters") {
      resetFilters = true

      // $: project = $activeProject && $activeShow?.index ? $projects[$activeProject].shows[$activeShow!.index] : null
      // projects.update((a: any) => {
      //   let show = a[$activeProject!].shows[$activeShow!.index!]
      //   if (show.filter) delete show.filter
      //   return a
      // })

      media.update((a: any) => {
        if (a[mediaId]) a[mediaId].filter = {}
        return a
      })

      if ($outBackground) {
        outBackground.update((a) => {
          delete a?.filter
          return a
        })
      }
    } else if (active === "options") {
      media.update((a: any) => {
        if (a[mediaId]) a[mediaId].flipped = false
        return a
      })

      if ($outBackground) {
        outBackground.update((a) => {
          delete a?.flipped
          return a
        })
      }
    }

    // TODO: delete if reset to default
  }
</script>

<div class="main border editTools">
  <Tabs {tabs} bind:active labels={false} />
  {#if active === "filters"}
    <Filters bind:resetFilters />
  {:else if active === "options"}
    <MediaOptions />
  {/if}

  <span style="display: flex;">
    <Button style="flex: 1;" on:click={reset} dark center>
      <Icon id="reset" right />
      <T id={"actions.reset"} />
    </Button>
  </span>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }
</style>

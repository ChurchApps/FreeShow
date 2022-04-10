<script lang="ts">
  import { activeEdit, activePage, activeProject, activeShow, dictionary, outBackground, outLocked, outSlide, projects, showsCache } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import { nextSlide, previousSlide } from "../helpers/showActions"
  import Button from "../inputs/Button.svelte"

  function previousShow() {
    if ($activeProject) {
      let index = typeof $activeShow?.index === "number" ? $activeShow?.index : $projects[$activeProject].shows.length
      if (index > 0) index--
      if (index !== $activeShow?.index) activeShow.set({ ...$projects[$activeProject].shows[index], index })
    }
  }
  function nextShow() {
    if ($activeProject) {
      let index = typeof $activeShow?.index === "number" ? $activeShow?.index : -1
      if (index + 1 < $projects[$activeProject].shows.length) index++
      if (index > -1 && index !== $activeShow?.index) activeShow.set({ ...$projects[$activeProject].shows[index], index })
    }
  }

  let length: number = 0
  $: {
    if ($outSlide?.id) {
      length = 0
      $showsCache[$outSlide.id]?.layouts[$outSlide.layout]?.slides.forEach((s: any) => {
        length++
        if ($showsCache[$outSlide!.id].slides[s.id].children) length += $showsCache[$outSlide!.id].slides[s.id].children!.length
      })
    }
  }
</script>

<span class="group">
  <Button
    on:click={previousShow}
    title={$dictionary.preview?._previous_show}
    disabled={!Object.keys($projects).length ||
      !$activeProject ||
      !$projects[$activeProject].shows.length ||
      (typeof $activeShow?.index === "number" ? $activeShow.index < 1 : false)}
    center
  >
    <Icon id="previousFull" size={1.2} />
  </Button>
  <Button
    on:click={previousSlide}
    title={$dictionary.preview?._previous_slide}
    disabled={$outLocked || !$activeShow || ($outSlide ? $outSlide.index < 1 : !GetLayout(null, $showsCache[$activeShow.id]?.settings?.activeLayout || null).length)}
    center
  >
    <Icon id="previous" size={1.2} />
  </Button>
  <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={$outLocked ? $dictionary.preview?._unlock : $dictionary.preview?._lock} center>
    <Icon id={$outLocked ? "locked" : "unlocked"} size={1.2} />
  </Button>
  {#if ($activePage === "edit" && $outSlide?.index !== $activeEdit.slide) || !$outSlide || $outSlide.id !== $activeShow?.id || $outSlide.layout !== $showsCache[$activeShow.id].settings.activeLayout}
    <Button
      on:click={() => {
        if ($activePage === "edit" && $activeShow && $activeEdit.slide !== null && $activeEdit.slide !== undefined)
          outSlide.set({ id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: $activeEdit.slide })
        else if ($activeShow && GetLayout().length) {
          outSlide.set({ id: $activeShow.id, layout: $showsCache[$activeShow.id].settings.activeLayout, index: 0 })
          // TODO: nextSlide(null)
        }
        // TODO: activeEdit && play media
      }}
      title={$dictionary.preview?._start}
      disabled={$outLocked || !$activeShow || !GetLayout(null, $showsCache[$activeShow.id]?.settings?.activeLayout || null).length}
      center
    >
      <Icon id="play" size={1.2} />
    </Button>
  {:else}
    <Button
      on:click={() => {
        outBackground.set($outBackground)
        outSlide.set($outSlide)
      }}
      title={$dictionary.preview?._update}
      disabled={!$outSlide || $outLocked}
      center
    >
      <Icon id="refresh" size={1.2} />
    </Button>
  {/if}
  <Button
    on:click={nextSlide}
    title={$dictionary.preview?._next_slide}
    disabled={$outLocked || !$activeShow || ($outSlide ? $outSlide.index + 1 >= length : !GetLayout(null, $showsCache[$activeShow.id]?.settings?.activeLayout || null).length)}
    center
  >
    <Icon id="next" size={1.2} />
  </Button>
  <Button
    on:click={nextShow}
    title={$dictionary.preview?._next_show}
    disabled={!Object.keys($projects).length ||
      !$activeProject ||
      !$projects[$activeProject].shows.length ||
      ($activeShow !== null && $activeShow.index !== undefined && $activeShow.index + 1 >= $projects[$activeProject].shows.length)}
    center
  >
    <Icon id="nextFull" size={1.2} />
  </Button>
</span>

<style>
  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .group :global(button) {
    flex-grow: 1;
    /* height: 40px; */
  }
</style>

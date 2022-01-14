<script lang="ts">
  import { activeShow, dictionary, groups, selected, shows } from "../../../stores"
  import SelectElem from "../../system/SelectElem.svelte"
  import { ondrop } from "../../helpers/drop"
  import Center from "../../system/Center.svelte"
  import { history } from "../../helpers/history"

  let slides: any[] = []
  $: {
    let added: any = {}
    slides = Object.entries(JSON.parse(JSON.stringify($shows[$activeShow!.id].slides))).map(([id, slide]: any) => {
      // add global group
      if (slide.globalGroup && $groups[slide.globalGroup]) {
        let old = { group: slide.group, color: slide.color }
        if ($groups[slide.globalGroup].default) slide.group = $dictionary.groups[$groups[slide.globalGroup].name]
        else slide.group = $groups[slide.globalGroup].name
        slide.color = $groups[slide.globalGroup].color

        // update local group
        if (JSON.stringify(old) !== JSON.stringify({ group: slide.group, color: slide.color })) {
          shows.update((a) => {
            a[$activeShow!.id].slides[id].group = slide.group
            a[$activeShow!.id].slides[id].color = slide.color
            return a
          })
        }
      }
      // check count
      if (slide.group) {
        if (added[slide.group]) {
          added[slide.group]++
          slide.group += " #" + added[slide.group]
        } else added[slide.group] = 1
      }
      return { id, ...slide }
    })
  }

  $: sortedSlides = slides.filter((a) => a.group !== null).sort((a: any, b: any) => a.group.localeCompare(b.group))
  // $: sortedSlides = slides.filter((a) => a.group !== null).sort((a: any, b: any) => (a.group > b.group ? 1 : b.group > a.group ? -1 : 0))

  $: globalGroups = Object.entries($groups).map(([id, group]: any) => {
    let name = group.name
    if (group.default) name = $dictionary.groups[group.name]
    return { group: name, color: group.color || null, globalGroup: id, settings: {}, notes: "", items: [] }
  })

  // $: sortedGroups = globalGroups.sort((a: any, b: any) => a.group.localeCompare(b.group))
  $: sortedGroups = globalGroups
</script>

<!-- TODO: tooltips... (Click or drag to add groups) -->

<div style="display: flex;padding: 10px;height: 100%;">
  <div class="main">
    <h4>[[[Local]]]</h4>
    {#if sortedSlides.length}
      {#each sortedSlides as slide}
        <SelectElem id="group" data={{ id: slide.id }} draggable>
          <div
            class="slide context #slide_group"
            style="background-color: {slide.color};"
            on:click={(e) => {
              if (!e.ctrlKey) {
                selected.set({ id: "group", elems: [{ id: slide.id }] })
                ondrop(null, "slide")
                selected.set({ id: null, elems: [] })
              }
            }}
          >
            {slide.group || "—"}
          </div>
        </SelectElem>
      {/each}
    {:else}
      <Center faded>[[[No slides]]]</Center>
    {/if}
  </div>

  <div class="seperator" />

  <div class="main">
    <h4>[[[Global]]]</h4>
    {#if sortedGroups.length}
      {#each sortedGroups as slide}
        <SelectElem id="global_group" data={slide} draggable>
          <div
            class="slide"
            style="background-color: {slide.color};"
            on:click={(e) => {
              if (!e.ctrlKey && $activeShow) {
                history({ id: "newSlide", newData: { slides: [slide] }, location: { page: "show", show: $activeShow, layout: $shows[$activeShow.id].settings.activeLayout } })
              }
            }}
          >
            {slide.group || "—"}
          </div>
        </SelectElem>
      {/each}
    {:else}
      <Center faded>[[[No slides]]]</Center>
    {/if}
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
  }

  .slide {
    /* padding: 5px; */
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    font-weight: bold;
    background-color: var(--primary-lighter);
    cursor: pointer;
  }
  .slide:hover {
    filter: brightness(1.1);
  }

  h4 {
    text-align: center;
  }

  .seperator {
    width: 1px;
    height: 100%;
    margin: 0 10px;
    background-color: var(--primary-lighter);
  }
</style>

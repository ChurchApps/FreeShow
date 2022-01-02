<script lang="ts">
  import Textbox from "./Textbox.svelte"
  import Zoomed from "./Zoomed.svelte"

  export let slide: any
  export let color: string | null = slide.color
  export let index: number
  export let columns: number = 1
  export let active: boolean = false
  export let resolution: any
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" style="width: {100 / columns}%">
  <div class="slide context #slide" class:active style="background-color: {color};" tabindex={0} data-index={index} on:click>
    <Zoomed {resolution} background={slide.items.length ? "black" : "transparent"}>
      <!-- TODO: check if showid exists in shows -->
      {#each slide.items as item}
        <Textbox {item} />
      {/each}
    </Zoomed>
    <!-- TODO: BG: white, color: black -->
    <!-- style="width: {resolution.width * zoom}px;" -->
    <div class="label" title={slide.label || ""}>
      <!-- font-size: 0.8em; -->
      <span style="position: absolute;display: contents;">{index + 1}</span>
      <span class="text">{slide.label || ""}</span>
    </div>
  </div>
</div>

<style>
  .main {
    display: flex;
    position: relative;
    padding: 5px;
  }

  .slide {
    /* padding: 3px; */
    background-color: var(--primary);
    z-index: 0;
    outline-offset: 0;
    width: 100%;
    /* height: fit-content; */
    /* border: 2px solid var(--primary-lighter); */
  }
  .slide.active {
    /* outline: 2px solid var(--secondary);
    outline-offset: 4px; */
    outline: 3px solid var(--secondary);
    outline-offset: 4px;
  }

  .label {
    display: flex;
    padding: 0 5px;
    padding-bottom: 2px;
    font-size: 0.8em;
    /* font-weight: bold; */
    align-items: center;
  }

  .label .text {
    width: 100%;
    margin: 0 20px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

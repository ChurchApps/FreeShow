<script lang="ts">
  import { activeShow, activeStage, stageShows } from "../../stores"
  import T from "../helpers/T.svelte"
  import Movebox from "../system/Movebox.svelte"

  export let id: string
  export let item: any
  export let show: any = $activeShow?.id ? $stageShows[$activeShow.id] : null
  export let ratio: number
  export let edit: boolean = false

  export let mouse: any = null
  function mousedown(e: any) {
    if (edit) {
      activeStage.update((ae) => {
        if (e.ctrlKey) {
          // if (ae.items.includes(id)) ae.items.splice(ae.items.indexOf(id), 1)
          // else ae.items.push(id)
          if (!ae.items.includes(id)) ae.items.push(id)
        } else ae.items = [id]
        return ae
      })
      // if ((e.target.closest(".line") && !e.ctrlKey) || e.target.closest(".square") || (e.ctrlKey && !e.target.closest(".line")) || !e.target.closest(".edit") || e.altKey) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offset: {
          x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - e.target.closest(".item").offsetLeft,
          y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetTop,
          width: e.clientX / ratio - e.target.closest(".item").offsetWidth,
          height: e.clientY / ratio - e.target.closest(".item").offsetHeight,
        },
        // offsetX: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - e.target.closest(".item").offsetLeft,
        // offsetY: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetTop,
        // offsetWidth: (e.clientX - e.target.closest(".slide").offsetLeft + 125) / ratio - e.target.closest(".item").offsetWidth + e.target.offsetWidth,
        // offsetHeight: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetHeight + e.target.offsetHeight,
        // offsetWidth: e.target.offsetParent.offsetWidth - e.clientX,
        // offsetHeight: e.target.offsetParent.offsetHeight - e.clientY,
        e: e,
      }
      // }
    }
  }

  function keydown(e: any) {
    if (edit) {
      if (e.key === "Backspace" && $activeStage.items.includes(id) && !document.activeElement?.closest(".item") && !document.activeElement?.closest("input")) {
        // TODO: history??
        $stageShows[$activeStage.id!].items[id].enabled = false
      }
    }
  }

  function deselect(e: any) {
    if (edit && !e.ctrlKey && e.target.closest(".item")?.id !== id && !e.target.closest(".stageTools")) {
      if ($activeStage.items.includes(id)) {
        if (!e.target.closest(".item")) {
          activeStage.update((ae) => {
            ae.items = []
            return ae
          })
        }
      }
    }
  }
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
  {id}
  class="item"
  class:outline={edit}
  class:selected={edit && $activeStage.items.includes(id)}
  style="{item.style};{edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ''}"
  on:mousedown={mousedown}
>
  {#if $activeStage.id && show?.settings.labels}
    <div class="label">
      <T id="stage.{id.split('#')[1]}" />
    </div>
  {/if}
  {#if edit}
    <Movebox {ratio} active={$activeStage.items.includes(id)} />
  {/if}
  <div class="align" style={item.align}>
    <div>
      {#if id === "slide#current_slide_text"}
        <span>text</span>
      {:else}
        {id}
      {/if}
    </div>
  </div>
</div>

<style>
  .item.outline {
    outline: 5px solid rgb(255 255 255 / 0.2);
  }
  .item.selected {
    outline: 5px solid var(--secondary);
    overflow: visible;
  }

  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  .align div {
    width: 100%;
    overflow-wrap: break-word;
  }
</style>

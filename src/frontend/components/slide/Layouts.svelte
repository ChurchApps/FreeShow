<script>
  import { activeShow, shows } from "../../stores"
  import Button from "../inputs/Button.svelte"
  import Layout from "../../classes/Layout"
  import { uid } from "uid"

  $: layouts = $shows[$activeShow.id].layouts
  $: activeLayout = $shows[$activeShow.id].settings.activeLayout

  $: console.log(activeLayout)
  // function createLayout() {
  //   let layout = new Layout("unnamed");
  //   return []
  //   // uid(16);
  // }
</script>

<div>
  {#if layouts}
    <span style="display: flex;">
      {#each Object.entries(layouts) as layout}
        <Button
          on:click={() =>
            shows.update((s) => {
              s[$activeShow.id].settings.activeLayout = layout[0]
              return s
            })}
          active={activeLayout === layout[0]}>{layout[1].name || "test"}</Button
        >
      {/each}
    </span>
    <Button
      on:click={() => {
        shows.update((s) => {
          let newLayout = new Layout("unnamed")
          let id = uid(16)
          s[$activeShow.id].layouts[id] = newLayout
          s[$activeShow.id].settings.activeLayout = id
          return s
        })
      }}>+</Button
    >
  {:else}
    Could not find any layouts...
  {/if}
</div>

<style>
  div {
    display: flex;
    justify-content: space-between;
    /* position: absolute;
    bottom: 0; */
    width: 100%;
    /* height: 50px; */
    background-color: var(--primary);
    border-top: 3px solid var(--primary-lighter);
    /* box-shadow: 0px -2px 2px rgb(0 0 0 / 40%); */
  }
</style>

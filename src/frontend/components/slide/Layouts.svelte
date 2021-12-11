<script lang="ts">
  import { activeShow, shows, slidesOptions } from "../../stores"
  import Button from "../inputs/Button.svelte"
  import Layout from "../../classes/Layout"
  import { uid } from "uid"
  import Center from "../system/Center.svelte"
  import Icon from "../helpers/Icon.svelte"

  $: active = $activeShow!.id
  $: layouts = $shows[active].layouts
  $: activeLayout = $shows[active].settings.activeLayout

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
              s[active].settings.activeLayout = layout[0]
              return s
            })}
          active={activeLayout === layout[0]}>{layout[1].name || "test"}</Button
        >
      {/each}
    </span>
    <span style="display: flex; align-items: center;">
      <Button
        on:click={() => {
          shows.update((s) => {
            // TODO: copy active layout
            // TODO: ctrl click = create empty
            let newLayout = new Layout("unnamed")
            let id = uid(16)
            s[active].layouts[id] = newLayout
            s[active].settings.activeLayout = id
            return s
          })
        }}
        title="[[[Add Layout]]]"
      >
        <Icon size={1.3} id="add" />
      </Button>
      <div class="seperator" />
      <Button on:click={() => slidesOptions.set({ ...$slidesOptions, grid: !$slidesOptions.grid })} title={$slidesOptions.grid ? "[[[Set List View]]]" : "[[[Set Grid View]]]"}>
        {#if $slidesOptions.grid}
          <Icon size={1.3} id="grid" white />
        {:else}
          <Icon size={1.3} id="list" white />
        {/if}
      </Button>
      <Button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, $slidesOptions.columns + 1) })} title="[[[Zoom out]]]">
        <Icon size={1.3} id="remove" white />
      </Button>
      <Button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(1, $slidesOptions.columns - 1) })} title="[[[Zoom in]]]">
        <Icon size={1.3} id="add" white />
      </Button>
      <p class="text">{(100 / $slidesOptions.columns).toFixed()}%</p>
    </span>
  {:else}
    <Center faded>[[[Could not find any layouts...]]]</Center>
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

  .text {
    opacity: 0.8;
    text-align: right;
    width: 50px;
    margin-right: 10px;
  }

  .seperator {
    width: 3px;
    height: 100%;
    background-color: var(--primary-lighter);
    /* margin: 0 10px; */
  }
</style>

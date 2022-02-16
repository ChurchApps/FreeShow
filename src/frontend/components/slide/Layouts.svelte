<script lang="ts">
  import { uid } from "uid"
  import { activeShow, showsCache, slidesOptions } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import HiddenInput from "../inputs/HiddenInput.svelte"
  import Center from "../system/Center.svelte"

  $: active = $activeShow!.id
  $: layouts = $showsCache[active]?.layouts
  $: activeLayout = $showsCache[active]?.settings.activeLayout

  function addLayout(e: any) {
    let newData: any = { id: uid(), layout: { name: "", notes: "", slides: [] } }
    if (e.ctrlKey) {
      newData.layout = { ...$showsCache[$activeShow!.id].layouts[$showsCache[$activeShow!.id].settings.activeLayout] }
    }
    history({ id: "addLayout", oldData: null, newData, location: { page: "show", show: $activeShow! } })
  }
</script>

<div>
  {#if layouts}
    <span style="display: flex;">
      {#each Object.entries(layouts) as layout}
        <Button
          on:click={() =>
            showsCache.update((s) => {
              s[active].settings.activeLayout = layout[0]
              return s
            })}
          active={activeLayout === layout[0]}
        >
          <HiddenInput value={layout[1].name} on:edit={(e) => console.log("layout NAME: ", e.detail)} />
        </Button>
      {/each}
    </span>
    <span style="display: flex; align-items: center;">
      <Button on:click={addLayout} title="[[[Add Layout. ctrlclick=copy current]]]">
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
      <Button
        disabled={$slidesOptions.columns >= 10}
        on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, $slidesOptions.columns + 1) })}
        title="[[[Zoom out]]]"
      >
        <Icon size={1.3} id="remove" white />
      </Button>
      <Button
        disabled={$slidesOptions.columns <= 2}
        on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, $slidesOptions.columns - 1) })}
        title="[[[Zoom in]]]"
      >
        <Icon size={1.3} id="add" white />
      </Button>
      <p class="text">{(100 / $slidesOptions.columns).toFixed()}%</p>
    </span>
  {:else}
    <Center faded>
      <T id="error.no_layouts" />
    </Center>
  {/if}
</div>

<style>
  div {
    display: flex;
    justify-content: space-between;
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

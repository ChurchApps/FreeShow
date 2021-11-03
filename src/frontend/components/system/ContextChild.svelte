<script lang="ts">
  import { drawerTabs } from "../../values/tabs"

  import T from "../helpers/T.svelte"
  import ContextItem from "./ContextItem.svelte"
  import type { ContextMenuItem } from "../../values/contextMenus"
  import { drawerTabsData } from "../../stores"

  export let contextElem: any
  export let label: string
  export let submenus: string[]
  export let side: "right" | "left" = "right"
  $: transform = side === "right" ? "100%" : "-100%"

  let open: boolean = false
  let elem: HTMLDivElement
  let timeout: any = null

  function hover(e: any) {
    if (elem.contains(e.target)) {
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
      if (!open) {
        timeout = setTimeout(() => {
          open = true
          timeout = null
        }, 500)
      }
    } else if (open && e.target?.closest(".contextMenu") !== null) {
      if (timeout === null) {
        timeout = setTimeout(() => {
          open = false
          timeout = null
        }, 500)
      }
    } else if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  function click(e: any) {
    if (e.target?.closest(".submenu") === null) open = !open
  }

  function loadItems(id: string): [string, ContextMenuItem][] {
    let items: [string, ContextMenuItem][] = []
    switch (id) {
      case "enabled_drawer_tabs":
        Object.entries(drawerTabs).forEach((tab, i) => {
          if (i >= 3) items.push([id + "_" + tab[0], { label: tab[1].name, icon: tab[1].icon, enabled: $drawerTabsData[tab[0]].enabled }])
        })
        console.log(items)

        break
    }
    return items
  }
</script>

<svelte:window on:mouseover={hover} />

<div bind:this={elem} class="item" on:click={click}>
  {#key label}
    <T id={label} />
  {/key}
  {#if open}
    <div class="submenu" style="{side}: 0; transform: translate({transform}, -10px);">
      {#each submenus as id}
        {#if id === "SEPERATOR"}
          <hr />
        {:else if id.includes("LOAD_")}
          {#each loadItems(id.slice(5, id.length)) as [id, menu]}
            <ContextItem {id} {contextElem} {menu} />
          {/each}
        {:else}
          <ContextItem {id} {contextElem} />
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .item {
    padding: 5px 20px;
    display: flex;
    justify-content: space-between;
  }
  .item:hover {
    background-color: rgb(0 0 0 / 0.2);
  }
  .item::after {
    content: ">";
    color: var(--secondary);
  }

  hr {
    margin: 5px 10px;
    height: 2px;
    border: none;
    background-color: var(--secondary);
  }

  .submenu {
    min-width: 150px;
    position: absolute;
    /* right: 0; */
    transform: translate(100%, -10px);
    /* transform: translate(100%, -25%); */
    background-color: var(--primary);
    box-shadow: 2px 2px 3px rgb(0 0 0 / 0.2);
    padding: 5px 0;
    z-index: 80;
  }
</style>

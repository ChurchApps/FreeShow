<script lang="ts">
  import { drawerTabs } from "../../values/tabs"
  import T from "../helpers/T.svelte"
  import ContextItem from "./ContextItem.svelte"
  import { ContextMenuItem, contextMenuItems } from "./contextMenus"
  import { activeShow, drawerTabsData, groups, selected, shows } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import { GetLayoutRef } from "../helpers/get"

  export let contextElem: any
  export let contextActive: boolean
  export let id: string
  export let menu: ContextMenuItem = contextMenuItems[id]
  // export let label: string
  // export let submenus: string[]
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
        Object.entries(drawerTabs).forEach(([aID, a], i) => {
          if (i >= 2) items.push([id, { id: aID, label: a.name, icon: a.icon, enabled: $drawerTabsData[aID].enabled }])
        })
        break
      case "slide_groups":
        let currentGroup = $shows[$activeShow!.id].slides[GetLayoutRef()[$selected.data[0].index].id].globalGroup
        Object.entries($groups).forEach(([aID, a]: any) => {
          items.push([id, { id: aID, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: a.default, enabled: aID === currentGroup }])
        })
        break
    }
    return items
  }
</script>

<svelte:window on:mouseover={hover} />

<div bind:this={elem} class="item" on:click={click}>
  <!-- {#key label}
    <T id={label} />
  {/key} -->
  <span style="display: flex;gap: 10px;">
    {#if menu?.icon}<Icon id={menu.icon} />{/if}
    {#key menu}
      <T id={menu?.label || id} />
    {/key}
  </span>
  {#if open}
    <div class="submenu" style="{side}: 0; transform: translate({transform}, -10px);">
      {#if menu.items?.length}
        {#each menu.items as id}
          {#if id === "SEPERATOR"}
            <hr />
          {:else if id.includes("LOAD_")}
            {#each loadItems(id.slice(5, id.length)) as [id, menu]}
              <ContextItem {id} {contextElem} {menu} bind:contextActive />
            {/each}
          {:else}
            <ContextItem {id} {contextElem} bind:contextActive />
          {/if}
        {/each}
      {/if}
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
    background-color: var(--primary-lighter);
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

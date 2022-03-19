<script lang="ts">
  import { activePopup } from "../../stores"
  import ContextChild from "./ContextChild.svelte"
  import ContextItem from "./ContextItem.svelte"
  import { contextMenuItems, contextMenuLayouts } from "./contextMenus"

  let contextElem: any = null
  let contextActive: boolean = false
  let activeMenu: string[]
  let x: number = 0
  let y: number = 0
  let side: "right" | "left" = "right"
  let translate = 0

  function onContextMenu(e: MouseEvent) {
    if (e.target?.closest(".contextMenu") || e.target?.closest(".nocontext") || $activePopup) {
      contextActive = false
      return
    }

    x = e.clientX
    y = e.clientY
    side = "right"
    translate = 0

    contextElem = e.target!.closest(".context") || document.body
    let id: string = contextElem?.classList.length ? [...contextElem?.classList].find((c: string) => c.includes("#")) : null
    activeMenu = getContextMenu(id) || contextMenuLayouts.default

    let contextHeight = Object.keys(activeMenu).length * 30 + 10
    if (x + 250 > window.innerWidth) x -= 250
    if (y + contextHeight > window.innerHeight) translate = 100
    if (x + (250 + 150) > window.innerWidth) side = "left"

    contextActive = true
  }

  function getContextMenu(id: string) {
    if (id?.includes("__")) {
      let menus = id.slice(1, id.length).split("__")
      // if (contextMenuLayouts[menus[1]]) {
      let menu: any[] = []
      menus.forEach((c2: string, i: number) => {
        menu.push(...contextMenuLayouts[c2])
        if (i < menus.length - 1) menu.push("SEPERATOR")
      })
      return menu
      // }
      // return
    }
    if (id && contextMenuLayouts[id.slice(1, id.length)]) return contextMenuLayouts[id.slice(1, id.length)]
    return
  }

  const click = (e: MouseEvent) => {
    if (!e.target?.closest(".contextMenu")) contextActive = false
  }
</script>

<svelte:window on:contextmenu={onContextMenu} on:click={click} />

{#if contextActive}
  <div class="contextMenu" style="left: {x}px; top: {y}px;transform: translateY(-{translate}%);">
    {#key activeMenu}
      {#each activeMenu as id}
        {#if id === "SEPERATOR"}
          <hr />
        {:else if contextMenuItems[id]?.items}
          <ContextChild {id} {contextElem} bind:contextActive {side} />
        {:else}
          <ContextItem {id} {contextElem} bind:contextActive />
        {/if}
      {/each}
    {/key}
  </div>
{/if}

<style>
  .contextMenu {
    position: fixed;
    min-width: 250px;
    background-color: var(--primary);
    box-shadow: 1px 1px 3px 2px rgb(0 0 0 / 0.2);
    padding: 5px 0;
    z-index: 80;
  }

  hr {
    margin: 5px 10px;
    height: 2px;
    border: none;
    background-color: var(--primary-lighter);
  }
</style>

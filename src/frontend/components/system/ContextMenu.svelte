<script lang="ts">
  import ContextChild from "./ContextChild.svelte"

  import ContextItem from "./ContextItem.svelte"
  import { contextMenuItems, contextMenuLayouts } from "../../values/contextMenus"

  let contextElem: any = null
  let contextActive: boolean = false
  let activeMenu: string[]
  let x: number = 0
  let y: number = 0
  let side: "right" | "left" = "right"
  function contextMenu(e: MouseEvent) {
    if (e.target?.closest(".contextMenu") === null && e.target?.closest(".nocontext") === null) {
      contextElem = e.target!.closest(".context")

      x = e.clientX
      y = e.clientY
      activeMenu = contextMenuLayouts.default
      let c = contextElem?.classList.length ? [...contextElem?.classList].find((c: string) => c.includes("#")) : null
      if (c?.includes("__")) {
        activeMenu = []
        let menus = c.slice(1, c.length).split("__")
        menus.forEach((c2: string, i: number) => {
          activeMenu.push(...contextMenuLayouts[c2])
          if (i < menus.length - 1) activeMenu.push("SEPERATOR")
        })
      } else if (c) activeMenu = contextMenuLayouts[c.slice(1, c.length)]
      console.log(activeMenu)

      let contextHeight = Object.keys(activeMenu).length * 30 + 10
      if (x + 250 > window.innerWidth) x -= 250
      if (y + contextHeight > window.innerHeight) y -= contextHeight
      if (x + (250 + 150) > window.innerWidth) side = "left"
      else side = "right"

      contextActive = true
    }
  }

  const click = (e: MouseEvent) => {
    if (e.target?.closest(".contextMenu") === null) contextActive = false
  }
</script>

<svelte:window on:contextmenu={contextMenu} on:click={click} />

{#if contextActive}
  <div class="contextMenu" style="left: {x}px; top: {y}px;">
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

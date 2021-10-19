<script lang="ts">
  import ContextChild from "./ContextChild.svelte"

  import ContextItem from "./ContextItem.svelte"
  import { contextMenuLayouts } from "../../values/contextMenus"

  let contextElem: any = null
  let contextActive: boolean = false
  let activeMenu: string
  let x: number = 0
  let y: number = 0
  let side: "right" | "left" = "right"
  function contextMenu(e: MouseEvent) {
    if (e.target?.closest(".contextMenu") === null) {
      contextElem = e.target!
      x = e.clientX
      y = e.clientY
      activeMenu = "default"
      Object.keys(contextMenuLayouts).map((menu) => {
        if (contextElem.closest(".context_" + menu) !== null) {
          activeMenu = menu
          return
        }
      })
      let contextHeight = Object.keys(contextMenuLayouts[activeMenu]).length * 30 + 10
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
    {#each Object.entries(contextMenuLayouts[activeMenu]) as menu}
      {#if menu[0] === "SEPERATOR"}
        <hr />
      {:else if menu[1] !== null}
        <ContextChild label={menu[0]} submenus={menu[1]} {contextElem} {side} />
      {:else}
        <ContextItem id={menu[0]} {contextElem} />
      {/if}
    {/each}
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
    background-color: var(--secondary);
  }
</style>

<script lang="ts">
  import { MAIN } from "../../../types/Channels"
  import { activePopup, saved } from "../../stores"
  import ContextChild from "../context/ContextChild.svelte"
  import ContextItem from "../context/ContextItem.svelte"
  import { contextMenuItems, contextMenuLayouts } from "../context/contextMenus"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  const menus: string[] = ["file", "edit", "view", "help"]

  let maximized: boolean = false
  let active: boolean = false
  let activeID: null | string = null
  let activeMenu: string[] = []
  let x: number = 0
  let y: number = 30

  window.api.send(MAIN, { channel: "MAXIMIZED" })
  window.api.receive(MAIN, (msg: any) => {
    if (msg.channel === "MAXIMIZED") maximized = msg.data
  })

  function menu(e: any) {
    let id: string = e.target.id
    active = activeID !== id
    activeID = activeID === id ? null : id

    if (activeID === null) return
    x = e.target.offsetLeft
    activeMenu = contextMenuLayouts[id]
  }

  const click = (e: MouseEvent) => {
    if (e.target?.closest(".menu") || e.target?.closest(".menus")) return

    activeID = null
    active = false
  }

  const move = (e: any) => {
    if (!active || activeID === e.target.id) return
    ;(document.activeElement as any)?.blur()
    menu(e)
  }
</script>

<svelte:window on:click={click} on:contextmenu={click} />

<main bind:clientHeight={y}>
  {#if active}
    <div class="contextMenu menu" style="left: {x}px; top: {y}px;">
      {#key activeMenu}
        {#each activeMenu as id}
          {#if id === "SEPERATOR"}
            <hr />
          {:else if contextMenuItems[id]?.items}
            <ContextChild {id} bind:contextActive={active} />
          {:else}
            <ContextItem {id} bind:contextActive={active} />
          {/if}
        {/each}
      {/key}
    </div>
  {/if}

  <div class="nocontext menus" on:mousemove={move} on:click={menu} on:contextmenu={menu}>
    {#each menus as menu}
      <Button id={menu} active={activeID === menu} dark red={menu === "file" && !$saved}>
        <T id="titlebar.{menu}" />
      </Button>
    {/each}
  </div>
  <div class="window">
    <Button on:click={() => window.api.send(MAIN, { channel: "MINIMIZE" })} center>
      <Icon id="remove" size={1.4} white />
    </Button>
    <Button on:click={() => window.api.send(MAIN, { channel: "MAXIMIZE" })} style="transform: rotate(180deg);" center>
      <Icon id={maximized ? "maximized" : "unmaximized"} size={maximized ? 1 : 1.1} white />
    </Button>
    <Button
      id="close"
      on:click={() => {
        if ($saved) window.api.send(MAIN, { channel: "CLOSE" })
        else activePopup.set("unsaved")
      }}
      center
    >
      <Icon id="close" size={1.4} white />
    </Button>
  </div>
</main>

<style>
  main :global(button) {
    opacity: 0.6;
    cursor: default;
  }

  main {
    display: flex;
    justify-content: space-between;
    background-color: var(--primary-darker);
    height: 30px;
    -webkit-app-region: drag;
  }

  div {
    display: flex;
    -webkit-app-region: no-drag;
  }

  .window :global(button) {
    width: 60px;
  }

  /* close */
  .window :global(#close):hover {
    background-color: rgb(255 0 0 / 0.35);
  }
  .window :global(#close):active,
  .window :global(#close):focus {
    background-color: rgb(255 0 0 / 0.3);
  }
  .window :global(#close):hover :global(svg) {
    fill: white;
  }

  /* menu */
  .menu {
    display: flex;
    flex-direction: column;
    position: fixed;
    min-width: 250px;
    background-color: var(--primary);
    box-shadow: 1px 1px 3px 2px rgb(0 0 0 / 0.2);
    padding: 5px 0;
    z-index: 100;
    -webkit-app-region: no-drag;
  }

  hr {
    margin: 5px 10px;
    height: 2px;
    border: none;
    background-color: var(--primary-lighter);
  }
</style>

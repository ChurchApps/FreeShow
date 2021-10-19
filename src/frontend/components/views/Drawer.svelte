<script lang="ts">
  import { enabledDrawerTabs } from "../../stores"

  import { drawerTabs } from "../../values/tabs"
  import Content from "../drawer/Content.svelte"
  import Navigation from "../drawer/Navigation.svelte"

  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  const minHeight = 30
  const maxHeight = window.innerHeight * 0.75
  let height: number = maxHeight / 2

  let activeTab: string = "shows"

  let move: boolean = false
  let mouse: null | { x: number; y: number; offsetY: number } = null
  function mouseDown(e: any) {
    if (e.target.classList.contains("top")) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offsetY: window.innerHeight - height - e.clientY,
      }
    }
    // console.log(e.clientY, e.target.offsetTop)
  }
  function mouseMove(e: any) {
    if (mouse) {
      let newHeight: number = window.innerHeight - e.clientY - mouse.offsetY
      console.log(newHeight)
      if (newHeight < minHeight) newHeight = minHeight
      else if (newHeight > maxHeight) newHeight = maxHeight
      height = newHeight
      storeHeight = null
      move = true
      // if (newHeight >= 50 && newHeight < 500) height = newHeight
    }
  }

  let storeHeight: null | number = null
  function click(e: any) {
    if (!move) {
      if (height > minHeight) {
        if (e.target.classList.contains("top")) {
          storeHeight = height
          height = minHeight
        }
      } else {
        if (storeHeight === null || storeHeight < minHeight * 2) height = maxHeight / 2
        else height = storeHeight
        storeHeight = null
      }
    } else move = false
  }
</script>

<svelte:window on:mouseup={() => (mouse = null)} on:mousemove={mouseMove} />

<section class="drawer" style="height: {height}px">
  <!-- <div class="dragger" on:mousedown={mouseDown} on:click={click} /> -->
  <div class="top context_drawer_top" on:mousedown={mouseDown} on:click={click}>
    {#each Object.entries(drawerTabs) as tab}
      {#if $enabledDrawerTabs[tab[0]]}
        <Button on:click={() => (activeTab = tab[0])} active={activeTab === tab[0]} class="context_drawer_top_button">
          <T id={tab[1].name} />
        </Button>
      {/if}
    {/each}
  </div>
  <div class="content">
    <Navigation id={activeTab} />
    <Content id={activeTab} />
  </div>
</section>

<style>
  section {
    overflow: hidden;
    position: relative;
    width: 100%;
    height: 100px;
    z-index: 20;

    background-color: var(--primary);
  }

  /* .dragger {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
    cursor: ns-resize;

    background: transparent;
    border-top: 5px solid var(--secondary);
  } */

  .top {
    cursor: ns-resize;
    height: 30px;
    display: flex;
    border-top: 5px solid var(--secondary);
  }

  .content {
    display: flex;
    /* height: calc(100% - 30px); */
  }

  .content nav {
    width: var(--navigation-width);
    background-color: red;
  }
</style>

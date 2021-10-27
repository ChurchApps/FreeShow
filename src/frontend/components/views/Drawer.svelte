<script lang="ts">
  import { enabledDrawerTabs } from "../../stores"

  import { drawerTabs } from "../../values/tabs"
  import Content from "../drawer/Content.svelte"
  import Info from "../drawer/Info.svelte"
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
      if (newHeight < minHeight * 2) newHeight = minHeight
      else if (newHeight > maxHeight) newHeight = maxHeight
      else move = true
      height = newHeight
      storeHeight = null
      // if (newHeight >= 50 && newHeight < 500) height = newHeight
    }
  }

  let storeHeight: null | number = null
  function click(e: any) {
    if (!move && !(e?.target instanceof HTMLInputElement)) {
      if (height > minHeight) {
        if (e?.target.classList.contains("top")) {
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

  function mouseup(e: any) {
    mouse = null
    if (!e.target.closest(".top")) move = false
  }

  let searchValue = ""
  function search() {
    if (storeHeight !== null) click(null)
    // if (activeTab === "shows") {
    // }
  }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mouseMove} />

<section class="drawer" style="height: {height}px">
  <!-- <div class="dragger" on:mousedown={mouseDown} on:click={click} /> -->
  <div class="top context_drawer_top" on:mousedown={mouseDown} on:click={click}>
    <span class="tabs">
      {#each Object.entries(drawerTabs) as tab}
        {#if $enabledDrawerTabs[tab[0]]}
          <Button on:click={() => (activeTab = tab[0])} active={activeTab === tab[0]} class="context_drawer_top_button">
            <T id={tab[1].name} />
          </Button>
        {/if}
      {/each}
    </span>
    <!-- TODO: expand drawer on input: -->
    <input class="search" type="text" placeholder="Search keywords... (Seperated by comma)" bind:value={searchValue} on:input={search} />
  </div>
  <div class="content">
    <Navigation id={activeTab} />
    <Content id={activeTab} {searchValue} />
    <Info />
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    /* overflow-y: hidden; */
    /* position: relative; */
    width: 100%;
    height: 100px;
    z-index: 20;

    background-color: var(--primary);
    box-shadow: 0px -2px 4px rgb(0 0 0 / 30%);
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
    /* cursor: ns-resize; */
    height: 30px;
    display: flex;
    justify-content: space-between;
    border-top: 5px solid var(--secondary);
  }

  .top .tabs {
    display: flex;
  }

  .search {
    background-color: rgb(0 0 0 / 0.2);
    color: var(--text);
    /* font-family: inherit; */
    width: 50%;
    padding: 0 8px;
    border: none;
  }
  .search:active,
  .search:focus {
    outline: 2px solid var(--secondary);
    /* background-color: var(--secondary-opacity); */
  }
  .search::placeholder {
    color: rgb(255 255 255 / 0.2);
  }

  .content {
    display: flex;
    /* height: 100%; */
    height: calc(100% - 30px);
    justify-content: space-between;
    /* height: calc(100% - 30px); */
  }
</style>

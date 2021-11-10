<script lang="ts">
  import { selectTextOnFocus, blurOnEscape } from "../helpers/inputActions"
  import { dictionary, drawerTabsData, lablesDisabled } from "../../stores"

  import { drawerTabs } from "../../values/tabs"
  import Content from "../drawer/Content.svelte"
  import Info from "../drawer/Info.svelte"
  import Navigation from "../drawer/Navigation.svelte"
  import Icon from "../helpers/Icon.svelte"

  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Resizeable from "../system/Resizeable.svelte"

  const minHeight = 40
  // const maxHeight = window.innerHeight * 0.75
  const maxHeight = window.innerHeight - 50
  let height: number = 300 // maxHeight / 2

  let activeTab: string = "shows"

  let move: boolean = false
  let mouse: null | { x: number; y: number; offsetY: number } = null
  function mousedown(e: any) {
    if (e.target.classList.contains("top")) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offsetY: window.innerHeight - height - e.clientY,
      }
    }
    // console.log(e.clientY, e.target.offsetTop)
  }
  function mousemove(e: any) {
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

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} />

<section class="drawer" style="height: {height}px">
  <!-- <div class="dragger" on:mousedown={mouseDown} on:click={click} /> -->
  <div class="top context_drawer_top" on:mousedown={mousedown} on:click={click}>
    <span class="tabs">
      {#each Object.entries(drawerTabs) as tab}
        {#if $drawerTabsData[tab[0]].enabled}
          <!-- translate(tab[1].name) -->
          <Button
            on:click={() => (activeTab = tab[0])}
            active={activeTab === tab[0]}
            class="context_drawer_top_button"
            title={$lablesDisabled ? $dictionary[tab[1].name.split(".")[0]]?.[tab[1].name.split(".")[1]] : ""}
          >
            <Icon id={tab[1].icon} size={1.3} />
            {#if !$lablesDisabled}
              <span><T id={tab[1].name} /></span>
            {/if}
          </Button>
        {/if}
      {/each}
    </span>
    <!-- TODO: expand drawer on input: -->
    <input class="search" type="text" placeholder="Search keywords... (Seperated by comma)" bind:value={searchValue} on:input={search} use:selectTextOnFocus use:blurOnEscape />
  </div>
  <div class="content">
    <Resizeable id={"drawerNavigation"}>
      <Navigation id={activeTab} />
    </Resizeable>
    <Content id={activeTab} {searchValue} />
    <Resizeable id={"drawerInfo"} side="right">
      <Info />
    </Resizeable>
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
    /* box-shadow: 0px -2px 4px rgb(0 0 0 / 30%); */
  }

  .top {
    position: relative;
    height: 40px;
    display: flex;
    justify-content: space-between;
    /* border-top: 4px solid var(--secondary); */
    padding-top: 4px;
  }
  .top::after {
    content: "";
    /* background-color: var(--secondary); */
    background-color: var(--primary-lighter);
    position: absolute;
    top: 0;
    width: 100%;
    height: 4px;
    cursor: ns-resize;
  }

  .top .tabs {
    display: flex;
  }
  .top .tabs span {
    /* font-size: 1.1em; */
    padding-left: 8px;
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
    color: inherit;
    opacity: 0.4;
  }

  .content {
    display: flex;
    /* height: 100%; */
    height: calc(100% - 40px);
    justify-content: space-between;
  }
</style>

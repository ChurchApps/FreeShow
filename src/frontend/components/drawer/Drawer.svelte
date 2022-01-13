<script lang="ts">
  import { selectTextOnFocus } from "../helpers/inputActions"
  import { activeProject, activeShow, dictionary, drawer, drawerTabsData, labelsDisabled, projects } from "../../stores"

  import { drawerTabs } from "../../values/tabs"
  import Content from "../drawer/Content.svelte"
  import Info from "./info/Info.svelte"
  import Navigation from "../drawer/Navigation.svelte"
  import Icon from "../helpers/Icon.svelte"

  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Resizeable from "../system/Resizeable.svelte"
  import type { Bible } from "../../../types/Scripture"
  import { history } from "../helpers/history"

  const minHeight = 40
  // const maxHeight = window.innerHeight * 0.75
  let maxHeight = window.innerHeight - 50
  let defaultHeight: number = 300
  // let height: number = defaultHeight // maxHeight / 2
  $: height = $drawer.height

  let activeTab: string = "shows"

  let move: boolean = false
  let mouse: null | { x: number; y: number; offsetY: number } = null
  function mousedown(e: any) {
    if (e.target.classList.contains("top")) {
      maxHeight = window.innerHeight - 50
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
      autoDrawer = false
      let newHeight: number = window.innerHeight - e.clientY - mouse.offsetY
      if (newHeight < minHeight * 2) newHeight = minHeight
      else if (newHeight > maxHeight) newHeight = maxHeight
      else move = true
      drawer.set({ height: newHeight, stored: null })
      // if (newHeight >= 50 && newHeight < 500) height = newHeight
    }
  }

  $: storeHeight = $drawer.stored
  function click(e: any) {
    if (!move && !(e?.target instanceof HTMLInputElement)) {
      if (height > minHeight) {
        if (e === null || e?.target.classList.contains("top")) {
          drawer.set({ height: minHeight, stored: height })
        }
      } else {
        if (storeHeight === null || storeHeight < defaultHeight) height = defaultHeight
        else height = storeHeight
        drawer.set({ height, stored: null })
      }
    } else move = false
  }

  function mouseup(e: any) {
    mouse = null
    if (!e.target.closest(".top")) move = false
  }

  let searchValue = ""
  $: searchValue = searchValue.endsWith(" ") ? removeWhitespace(searchValue) + " " : removeWhitespace(searchValue)
  const removeWhitespace = (v: string) =>
    v
      .split(" ")
      .filter((n) => n)
      .join(" ")
  function search() {
    if (storeHeight !== null) {
      autoDrawer = true
      click(null)
    }
    // if (activeTab === "shows") {
    // }
  }

  let bible: Bible = {
    version: null,
    book: null,
    chapter: null,
    verses: [],
    activeVerses: [],
  }

  let firstMatch: null | any = null
  let searchElem: any
  let autoDrawer: boolean = false
  function keydown(e: any) {
    if (document.activeElement === document.body && !e.ctrlKey && !e.altKey) {
      // Alphabet upper case | Alphabet lower case
      if (/^[A-Z]{1}$/i.test(e.key)) searchElem.focus()
    } else if (e.key === "Enter") {
      // TODO: first match
      if (document.activeElement === searchElem && searchValue.length && firstMatch && $activeProject) {
        console.log(firstMatch)
        searchElem.select()
        history({ id: activeTab === "shows" ? "addShow" : "addShow", newData: firstMatch.id })
        activeShow.set({ ...firstMatch, index: $projects[$activeProject].shows.length - 1 })
        searchValue = ""
        if (autoDrawer && storeHeight === null) {
          click(null)
          autoDrawer = false
        }
      }
    }
  }

  // TODO: on show get activeshow, store n bakcground
  let stored: any = null

  $: {
    if (activeTab === "backgrounds" && ($activeShow?.type === null || $activeShow?.type === "private")) stored = JSON.stringify($activeShow)
    else if (activeTab === "shows" && stored !== null) {
      activeShow.set(JSON.parse(stored))
      stored = null
    }
  }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} on:keydown={keydown} />

<!-- <Resizeable id="drawer" side="bottom" minWidth={50}> -->
<section class="drawer" style="height: {height}px">
  <!-- <div class="dragger" on:mousedown={mouseDown} on:click={click} /> -->
  <div class="top context #drawer_top" on:mousedown={mousedown} on:click={click}>
    <span class="tabs">
      {#each Object.entries(drawerTabs) as tab}
        {#if $drawerTabsData[tab[0]].enabled}
          <!-- translate(tab[1].name) -->
          <Button
            on:click={() => (activeTab = tab[0])}
            active={activeTab === tab[0]}
            class="context #rename__drawer_top"
            title={$labelsDisabled ? $dictionary[tab[1].name.split(".")[0]]?.[tab[1].name.split(".")[1]] : ""}
          >
            <Icon id={tab[1].icon} size={1.3} />
            {#if !$labelsDisabled}
              <span><T id={tab[1].name} /></span>
            {/if}
          </Button>
        {/if}
      {/each}
    </span>
    <!-- TODO: expand drawer on input: -->
    <input
      bind:this={searchElem}
      class="search edit"
      type="text"
      placeholder="Search keywords... (Seperated by comma)"
      bind:value={searchValue}
      on:input={search}
      use:selectTextOnFocus
    />
    <!-- use:blurOnEscape -->
  </div>
  <div class="content">
    <Resizeable id={"drawerNavigation"}>
      <Navigation id={activeTab} />
    </Resizeable>
    <Content id={activeTab} {searchValue} bind:firstMatch bind:bible />
    <Resizeable id={"drawerInfo"} side="right">
      <Info id={activeTab} {bible} />
    </Resizeable>
  </div>
</section>

<!-- </Resizeable> -->
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

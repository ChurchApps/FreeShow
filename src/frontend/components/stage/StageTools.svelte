<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import ItemStyle from "./tools/ItemStyle.svelte"
  import Button from "../inputs/Button.svelte"
  import Tabs from "../main/Tabs.svelte"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Items from "./tools/Items.svelte"
  import SlideStyle from "./tools/SlideStyle.svelte"
  import { activeStage } from "../../stores"

  // $: allSlideItems = $activeStage.id !== null ? $stageShows[$activeStage?.id!].items : []
  // // select active items or all items
  // $: items = $activeStage.items.length ? $activeStage.items : allSlideItems
  // // select last item
  // $: item = items.length ? items[items.length - 1] : null

  const tabs: TabsObj = {
    item: { name: "tools.item", icon: "item" },
    items: { name: "tools.items", icon: "items" },
    slide: { name: "tools.slide", icon: "options" },
  }
  let active: string = $activeStage.items.length ? "item" : "items"

  activeStage.subscribe((as) => {
    if (as.items.length && active !== "item") active = "item"
    else if (!as.items.length && active === "item") active = "items"
  })
</script>

<div class="main border stageTools">
  <Tabs {tabs} bind:active labels={false} />
  {#if active === "item"}
    <div class="content">
      <ItemStyle />
    </div>
  {:else if active === "items"}
    <div class="content">
      <Items />
    </div>
  {:else if active === "slide"}
    <div class="content">
      <SlideStyle />
    </div>
  {/if}

  <span style="display: flex;">
    {#if active !== "items"}
      <Button style="flex: 1;" dark center>
        <Icon id="reset" />
        <T id={"edit.reset"} />
      </Button>
    {/if}
  </span>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }

  .content {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .content :global(section) {
    padding: 10px;
    height: 100%;
    /* flex: 1; */
  }
  /* .content :global(section div) {
    display: flex;
    justify-content: space-between;
  } */
</style>

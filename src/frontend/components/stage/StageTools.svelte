<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeStage } from "../../stores"
    import Tabs from "../main/Tabs.svelte"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import Items from "./tools/Items.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"

    // $: allSlideItems = $activeStage.id !== null ? $stageShows[$activeStage?.id!].items : []
    // // select active items or all items
    // $: items = $activeStage.items.length ? $activeStage.items : allSlideItems
    // // select last item
    // $: item = items.length ? items[items.length - 1] : null

    const tabs: TabsObj = {
        text: { name: "items.text", icon: "text", disabled: true },
        item: { name: "tools.item", icon: "item", disabled: true },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "tools.slide", icon: "options" },
    }

    let active: string = $activeStage.items.length ? "item" : "items"
    $: console.log($activeStage.items)
    $: console.log(active)

    activeStage.subscribe((as) => {
        if (as.items.length && active !== "item" && active !== "text") {
            tabs.text.disabled = tabs.item.disabled = false
            active = "text"
        } else if (!as.items.length && (active === "item" || active === "text")) {
            tabs.text.disabled = tabs.item.disabled = true
            active = "items"
        }
    })
</script>

<div class="main border stageTools">
    <Tabs {tabs} bind:active />
    <!-- labels={false} -->
    {#if active === "text"}
        <div class="content">
            <BoxStyle />
        </div>
    {:else if active === "item"}
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

    <!-- TODO: reset stage -->
    <!-- <span style="display: flex;">
    {#if active !== "items"}
      <Button style="flex: 1;" dark center>
        <Icon id="reset" right />
        <T id={"actions.reset"} />
      </Button>
    {/if}
  </span> -->
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

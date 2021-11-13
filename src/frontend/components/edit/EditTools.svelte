<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow } from "../../stores"
  import Tabs from "../main/Tabs.svelte"
  import Items from "./tools/Items.svelte"
  import ItemStyle from "./tools/ItemStyle.svelte"
  import SlideStyle from "./tools/SlideStyle.svelte"
  import TextStyle from "./tools/TextStyle.svelte"

  const tabs: TabsObj = {
    text: { name: "tools.text", icon: "text" },
    item: { name: "tools.item", icon: "item" },
    items: { name: "tools.items", icon: "items" },
    slide: { name: "tools.slide", icon: "settings" }, // slide
  }
  let active: string = Object.keys(tabs)[0]
</script>

<div class="main editTools">
  {#if $activeShow && $activeEdit.slide !== null}
    <Tabs {tabs} bind:active labels={false} />
    <div class="content">
      {#if active === "text"}
        <TextStyle />
      {/if}
      {#if active === "item"}
        <ItemStyle />
      {/if}
      {#if active === "items"}
        <Items />
      {/if}
      {#if active === "slide"}
        <SlideStyle />
      {/if}
    </div>
    <!-- add shapes, text edit, arrange layers, transitions... -->
  {/if}
</div>

<style>
  .main {
    height: 50%;
    overflow-y: auto;
    overflow-x: hidden;
    border-top: 3px solid var(--secondary);
  }

  .content :global(section) {
    padding: 10px;
  }
  .content :global(section div) {
    display: flex;
    justify-content: space-between;
  }
</style>

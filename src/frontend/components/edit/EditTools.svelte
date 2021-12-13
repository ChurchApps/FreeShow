<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow } from "../../stores"
  import Button from "../inputs/Button.svelte"
  import Tabs from "../main/Tabs.svelte"
  import Resizeable from "../system/Resizeable.svelte"
  import Items from "./tools/Items.svelte"
  import ItemStyle from "./tools/ItemStyle.svelte"
  import SlideStyle from "./tools/SlideStyle.svelte"
  import TextStyle from "./tools/TextStyle.svelte"

  const tabs: TabsObj = {
    text: { name: "tools.text", icon: "text" },
    item: { name: "tools.item", icon: "item" },
    items: { name: "tools.items", icon: "items" },
    slide: { name: "tools.slide", icon: "options" }, // slide
  }
  let active: string = Object.keys(tabs)[0]
</script>

<Resizeable id="editTools" side="bottom" maxWidth={window.innerHeight * 0.75}>
  <div class="main editTools">
    {#if $activeShow && $activeEdit.slide !== null}
      <Tabs {tabs} bind:active labels={false} />
      {#if active === "text"}
        <div class="content">
          <TextStyle />
        </div>
        <span style="display: flex;">
          <Button style="flex: 1;" dark center>[[[Apply to all]]]</Button>
          <Button style="flex: 1;" dark center>[[[Reset]]]</Button>
        </span>
      {/if}
      {#if active === "item"}
        <div class="content">
          <ItemStyle />
        </div>
        <span style="display: flex;">
          <Button style="flex: 1;" dark center>[[[Apply to all]]]</Button>
          <Button style="flex: 1;" dark center>[[[Reset]]]</Button>
        </span>
      {/if}
      {#if active === "items"}
        <div class="content">
          <Items />
        </div>
      {/if}
      {#if active === "slide"}
        <div class="content">
          <SlideStyle />
        </div>
      {/if}
      <!-- add shapes, text edit, arrange layers, transitions... -->
    {/if}
  </div>
</Resizeable>

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
    flex: 1;
  }
  .content :global(section div) {
    display: flex;
    justify-content: space-between;
  }
</style>

<script lang="ts">
  import type { Item } from "../../../types/Show"
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow, showsCache } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Tabs from "../main/Tabs.svelte"
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

  // $: allSlideItems = $activeEdit.slide !== null ? getSlide($activeShow?.id!, $activeEdit.slide).items : []
  $: allSlideItems = $activeEdit.slide !== null ? $showsCache[$activeShow?.id!]?.slides[GetLayout($activeShow?.id!)[$activeEdit.slide]?.id].items : []
  const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])
  $: console.log(JSON.parse(JSON.stringify(allSlideItems)))

  // select active items or all items
  $: items = $activeEdit.items.length ? getItemsByIndex($activeEdit.items.sort((a, b) => a - b)) : allSlideItems
  // select last item
  $: item = items?.length ? items[items.length - 1] : null

  function reset() {
    if (active === "text") {
      let values: any = []
      items.forEach((item) => {
        if (item.lines) {
          let text = item.lines.map((a) => {
            a.text = a.text.map((a) => {
              a.style = ""
              return a
            })
            return a
          })
          values.push(text)
        }
      })

      if (values.length) {
        history({
          id: "textStyle",
          newData: { key: "text", values },
          location: {
            page: "edit",
            show: $activeShow!,
            slide: GetLayout()[$activeEdit.slide!].id,
            items: $activeEdit.items.length ? $activeEdit.items : Object.keys(allSlideItems),
          },
        })
      }
    }
  }
</script>

<!-- <Resizeable id="editTools" side="bottom" maxWidth={window.innerHeight * 0.75}> -->
<div class="main editTools">
  {#if $activeShow && $activeEdit.slide !== null}
    <Tabs {tabs} bind:active labels={false} />
    {#if active === "text"}
      <div class="content">
        <TextStyle bind:allSlideItems bind:item />
      </div>
    {:else if active === "item"}
      <div class="content">
        <ItemStyle bind:allSlideItems bind:item />
      </div>
    {:else if active === "items"}
      <div class="content">
        <Items bind:allSlideItems />
      </div>
    {:else if active === "slide"}
      <div class="content">
        <SlideStyle />
      </div>
    {/if}
    <!-- add shapes, text edit, arrange layers, transitions... -->

    <span style="display: flex;">
      {#if active === "text" || active === "item"}
        <Button style="flex: 1;" dark center disabled title="WIP">
          <Icon id="copy" right />
          <T id={"edit.apply_to_all"} />
        </Button>
      {/if}
      {#if active !== "items"}
        <Button style="flex: 1;" on:click={reset} dark center>
          <Icon id="reset" right />
          <T id={"edit.reset"} />
        </Button>
      {/if}
    </span>
  {/if}
</div>

<!-- </Resizeable> -->
<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    border-top: 2px solid var(--primary-lighter);
  }

  .content {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .content :global(section) {
    padding: 10px;
    /* flex: 1; */
    /* height: 100%; */
  }
  .content :global(section div) {
    display: flex;
    justify-content: space-between;
  }
</style>

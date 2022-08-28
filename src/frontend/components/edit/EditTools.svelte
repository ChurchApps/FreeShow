<script lang="ts">
  import type { Item } from "../../../types/Show"
  import type { TabsObj } from "../../../types/Tabs"
  import { activeEdit, activeShow, overlays, showsCache, templates } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { _show } from "../helpers/shows"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Tabs from "../main/Tabs.svelte"
  import Center from "../system/Center.svelte"
  import BoxStyle from "./tools/BoxStyle.svelte"
  import IconStyle from "./tools/IconStyle.svelte"
  import Items from "./tools/Items.svelte"
  import ItemStyle from "./tools/ItemStyle.svelte"
  import SlideStyle from "./tools/SlideStyle.svelte"
  import TextStyle from "./tools/TextStyle.svelte"
  import TimerStyle from "./tools/TimerStyle.svelte"

  let tabs: TabsObj = {
    text: { name: "tools.text", icon: "text" },
    item: { name: "tools.item", icon: "item" },
    items: { name: "tools.items", icon: "items" },
    slide: { name: "tools.slide", icon: "options" }, // slide
  }
  let active: string = Object.keys(tabs)[0]
  $: tabs.text.icon = item?.type || "text"

  let slides: any[] = []
  $: if (
    allSlideItems &&
    (($activeEdit?.id && $activeEdit.slide !== null && $activeEdit.slide !== undefined) || ($activeShow && ($activeShow.type === undefined || $activeShow.type === "show")))
  )
    slides = _show($activeEdit?.id || $activeShow?.id)
      .slides()
      .get()
  // $: if (!item?.lines && item?.type !== "timer" && item?.type !== "icon" && !tabs.text.disabled) {
  $: if (!item && !tabs.text.disabled) {
    active = "items"
    tabs.text.disabled = true
    // } else if ((item?.lines || item?.type === "timer" || item?.type === "icon") && tabs.text.disabled) {
  } else if (item && tabs.text.disabled) {
    // TODO: false triggers (arranging items)
    // active = "text"
    tabs.text.disabled = false
  }
  $: if (!allSlideItems.length && !tabs.item.disabled) {
    tabs.item.disabled = true
  } else if (allSlideItems.length && tabs.item.disabled) {
    tabs.item.disabled = false
  }

  // $: allSlideItems = $activeEdit.slide !== null ? getSlide($activeShow?.id!, $activeEdit.slide).items : []
  $: if (
    $activeEdit.slide !== null &&
    $activeEdit.slide !== undefined &&
    $activeShow &&
    ($activeShow?.type === undefined || $activeShow?.type === "show") &&
    GetLayout($activeShow.id).length <= $activeEdit.slide &&
    GetLayout($activeShow.id).length > 0
  )
    activeEdit.set({ slide: 0, items: [] })
  $: allSlideItems =
    $activeEdit.slide !== null &&
    $activeEdit.slide !== undefined &&
    $activeShow &&
    ($activeShow?.type === undefined || $activeShow?.type === "show") &&
    GetLayout($activeShow.id).length > $activeEdit.slide
      ? $showsCache[$activeShow?.id!]?.slides[GetLayout($activeShow?.id!)[$activeEdit.slide]?.id].items
      : []
  $: if ($activeEdit.type === "overlay") allSlideItems = $overlays[$activeEdit.id!]?.items
  $: if ($activeEdit.type === "template") allSlideItems = $templates[$activeEdit.id!]?.items
  const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])

  // select active items or all items
  $: items = $activeEdit.items.length ? getItemsByIndex($activeEdit.items.sort((a, b) => a - b)) : allSlideItems
  // select last item
  $: item = items?.length ? items[items.length - 1] : null

  $: index = allSlideItems.findIndex((a) => JSON.stringify(a) === JSON.stringify(item))

  function applyStyleToAllSlides() {
    if (active === "text") {
      // get current text style
      let style = item?.lines?.[0].text?.[0].style
      let isAuto = item?.auto

      _show("active")
        .slides()
        .get()
        .forEach((slide) => {
          let items: any[] = []
          let values: any[] = []
          slide.items.forEach((item: any, i: number) => {
            if (item.lines) {
              items.push(i)
              let text = item.lines.map((a: any) => {
                return a.text.map((a: any) => {
                  a.style = style
                  return a
                })
              })
              values.push(text)
            }
          })

          history({
            id: "textStyle",
            newData: { style: { key: "text", values } },
            location: { page: "edit", show: $activeShow!, slide: slide.id, items },
          })
          history({
            id: "setItems",
            newData: { style: { key: "auto", values: [isAuto] } },
            location: { page: "edit", show: $activeShow!, slide: slide.id, items },
          })
        })
      return
    }

    if (active === "item") {
      // get current item style
      let style = item?.style

      _show("active")
        .slides()
        .get()
        .forEach((slide) => {
          history({
            id: "setStyle",
            newData: { style: { key: "style", values: [style] } },
            location: { page: "edit", show: $activeShow!, slide: slide.id, items: [] },
          })
        })
      return
    }

    if (active === "slide") {
      let ref = _show("active").layouts("active").ref()[0]
      let slideStyle = _show("active").slides([ref[$activeEdit.slide!].id]).get("settings")[0]

      _show("active")
        .slides()
        .get()
        .forEach((slide) => {
          let oldData = { style: slide.settings }

          history({
            id: "slideStyle",
            oldData,
            newData: { style: slideStyle },
            location: { page: "edit", show: $activeShow!, slide: slide.id },
          })
        })
      return
    }
  }

  function reset() {
    let ref = _show("active").layouts("active").ref()[0]
    let slide = _show("active").slides([ref[$activeEdit.slide!].id]).get("id")[0]
    // let slide = GetLayout()[$activeEdit.slide!].id

    if (active === "item") {
      history({
        id: "setStyle",
        newData: { style: { key: "style", values: ["top:120px;left:50px;height:840px;width:1820px;"] } },
        location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items },
      })
      return
    }

    if (active === "slide") {
      history({
        id: "slideStyle",
        oldData: { style: _show("active").slides([slide]).get("settings")[0] },
        newData: { style: {} },
        location: { page: "edit", show: $activeShow!, slide },
      })
      return
    }

    // TODO: reset timer/icon/++ style

    if (active !== "text") return

    let values: any = []
    items.forEach((item) => {
      if (item.lines) {
        let text = item.lines.map((a) => {
          return a.text.map((a) => {
            a.style = ""
            return a
          })
        })
        values.push(text)
      }
    })

    if (!values.length) return

    // let selectedItems = $activeEdit.items.length ? $activeEdit.items : Object.keys(allSlideItems)
    history({
      id: "textStyle",
      newData: { style: { key: "text", values } },
      location: {
        page: "edit",
        show: $activeShow!,
        slide,
        items: $activeEdit.items,
      },
    })
    history({
      id: "setItems",
      newData: { style: { key: "auto", values: [false] } },
      location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items },
    })
  }
</script>

<!-- <Resizeable id="editTools" side="bottom" maxWidth={window.innerHeight * 0.75}> -->
<div class="main border editTools">
  {#if (slides?.length && $activeShow && ($activeShow.type === undefined || $activeShow.type === "show") && $activeEdit.slide !== null) || $activeEdit.id}
    <Tabs {tabs} bind:active labels={false} />
    {#if active === "text"}
      <div class="content">
        {#if false}
          <!-- TODO: deprecated components -->
          <!-- item?.type === "timer" -->
          <TimerStyle bind:item {index} />
          <!-- item?.type === "icon" -->
          <IconStyle bind:item {index} />
          <!-- item?.lines -->
          <TextStyle bind:allSlideItems bind:item />
        {:else if item}
          <BoxStyle id={item?.type || "text"} bind:allSlideItems bind:item />
        {:else}
          <Center faded>
            <T id="empty.items" />
          </Center>
        {/if}
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
      {#if active !== "items"}
        <Button style="flex: 1;" on:click={applyStyleToAllSlides} dark center>
          <Icon id="copy" right />
          <T id={"actions.to_all"} />
        </Button>
        <Button style="flex: 1;" on:click={reset} dark center>
          <Icon id="reset" right />
          <T id={"actions.reset"} />
        </Button>
      {/if}
    </span>
  {:else}
    <Center faded>
      <T id="empty.slides" />
    </Center>
  {/if}
</div>

<!-- </Resizeable> -->
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
    /* flex: 1; */
    /* height: 100%; */
  }
  .content :global(section div) {
    display: flex;
    justify-content: space-between;
  }
</style>

<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import type { Slide, SlideData } from "../../../types/Show"
  import { activeShow, screen, shows, slidesOptions } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Draggable from "../system/Draggable.svelte"
  import Textbox from "./Textbox.svelte"

  export let slide: Slide
  export let color: string | null = slide.color
  export let index: number
  export let zoom: number = 1
  export let active: boolean = false
  export let list: boolean = false

  export let hovering: null | number
  export let selected: number[]

  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  const drop = (e: any) => {
    e.dataTransfer.dropEffect = "move"
    // const start = parseInt(event.dataTransfer.getData("text"))

    let newLayout: SlideData[] = GetLayout()

    console.log([...newLayout])

    // remove selected
    let slides: SlideData[] = []
    selected.sort().forEach((i) => {
      slides.push(newLayout.splice(i - slides.length, 1)[0])
    })
    console.log(selected.sort())

    // remove all children slides
    newLayout.forEach((slideData, i) => {
      if (slideData.childOf) newLayout.splice(i, 1)
    })

    // console.log([...newLayout])
    // console.log(index)

    // add back
    // console.log(newLayout.slice(0, index + 1 - slides.length), slides, newLayout.slice(index + 1 - slides.length, newLayout.length))
    let newIndex = index
    // if (index > selected[0])
    // TODO: new index....
    selected.forEach((s, i) => {
      if (s < index - 1) newIndex--
      if (i === selected.length - 1 && index > s + 1 && selected.length > 1) newIndex++
    })
    if (selected.slice(1, selected.length).includes(index)) newIndex--
    console.log(newIndex)

    newLayout = [...newLayout.slice(0, newIndex), ...slides, ...newLayout.slice(newIndex, newLayout.length)]
    console.log([...newLayout])

    // remove all children slides
    let deleteCount: number = 0
    newLayout.forEach((slideData, i) => {
      if (slideData.childOf && i - deleteCount > newIndex && i - deleteCount + slides.length > newIndex) {
        newLayout.splice(i - deleteCount, 1)
        deleteCount++
      }
    })

    // TODO: moving parent moves whole group
    // TODO: moving child moves all same children (multiple selected = keep numbers...)

    let lastParentID: string = newLayout[0].id
    let idList: string[] = []
    idList.push(lastParentID)
    // let back: number = 1
    // if (newIndex - back > 0) {
    //   while (newIndex - back >= 0 && newLayout[newIndex - back].childOf) {
    //     back++
    //   }
    //   if (newIndex - back === 0 && newLayout[0].childOf) lastParentID = newLayout[0].childOf!
    //   else lastParentID = newLayout[newIndex - back].id
    //   console.log(lastParentID)

    //   // if (newLayout[newIndex - 1].childOf) lastParentID = newLayout[newIndex - 1].childOf!
    //   // else lastParentID = newLayout[newIndex - 1].id
    // }
    // console.log(newIndex - back, lastParentID)

    let newChildren: { [key: string]: SlideData[] } = { [lastParentID]: [] }
    newLayout.forEach((slideData, i) => {
      // if (!newChildren[lastParentID]) newChildren[lastParentID] = []

      // if (i >= newIndex - back && !JSON.stringify(newChildren).includes(slideData.id)) {
      if (i > 0) {
        console.log(slideData.id, slideData.childOf, lastParentID)

        // if (lastParentID && slideData.childOf && i > 0) {
        if (slideData.childOf) {
          newChildren[lastParentID].push(slideData)
          // console.log("child", JSON.stringify(newChildren))
        } else {
          lastParentID = slideData.id
          if (!newChildren[lastParentID]) newChildren[lastParentID] = []
          idList.push(lastParentID)
        }
        console.log(slideData.id, JSON.stringify(newChildren))

        // if (slideData.childOf && i === 0) {
        //   delete slideData.childOf
        // }
      } else if (slideData.childOf) {
        delete slideData.childOf
      }
    })
    console.log(newChildren)

    // update main slides
    shows.update((s) => {
      new Set(idList).forEach((id) => {
        // remove old
        let children = s[$activeShow!.id].slides[id].children
        if (children?.length) {
          // for (let i = 0; i < children.length; i++) {
          //   console.log(newChildren[id], children[i], children, i)

          //   if (JSON.stringify(newChildren[id]).includes(children[i].id)) {
          //     console.log("cccc", children[i])

          //     delete children[i]
          //     i--
          //   }
          // }
          let deleteCount: number = 0
          children.forEach((child, i) => {
            if (JSON.stringify(slides).includes(child.id)) delete children![i - deleteCount]
            // if (JSON.stringify(newChildren[id]).includes(child.id)) delete children![i - deleteCount]
          })
        }
        if (!children?.length) delete s[$activeShow!.id].slides[id].children

        // add new
        if (newChildren[id].length) {
          if (!s[$activeShow!.id].slides[id].children) s[$activeShow!.id].slides[id].children = []
          s[$activeShow!.id].slides[id].children!.push(...newChildren[id])
        }

        // Object.entries(newChildren).forEach((childs) => {
        //   let children = s[$activeShow!.id].slides[childs[0]].children
        //   if (childs[1].length) children?.push(...childs[1])
        // })

        // // if (JSON.stringify(children).includes(selectedSlides))
        // if (newChildren[id]?.length) s[$activeShow!.id].slides[id].children = newChildren[id]
        // // else if (s[$activeShow!.id].slides[id].children?.length) delete s[$activeShow!.id].slides[id].children
        // else delete s[$activeShow!.id].slides[id].children
      })
      return s
    })
    console.log($shows[$activeShow!.id].slides)

    // delete children
    newLayout.forEach((slideData, i) => {
      if (slideData.childOf) {
        if (i === 0) delete newLayout[i].childOf
        else delete newLayout[i]
      }
    })

    // update layout
    shows.update((s) => {
      s[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides = newLayout
      return s
    })

    hovering = null
    selected = []
  }
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<div class="main" class:list>
  <div
    class="slide context_slide"
    class:active
    class:contrast={selected.includes(index) || hovering === index}
    class:hovering={hovering === index}
    class:right={hovering === index && index > selected[0]}
    class:left={hovering === index && index <= selected[0]}
    class:selected={selected.includes(index)}
    style="background-color: {color};"
    tabindex={0}
    data-index={index}
    on:click
    on:mousedown
  >
    <Draggable bind:hovering {index} on:drop={(e) => drop(e)}>
      <!-- TODO: tab select on enter -->
      <div class="slideContent" style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px; {!slide.items.length ? 'background-color: transparent;' : ''}">
        <span style="zoom: {zoom};">
          <!-- TODO: check if showid exists in shows -->
          {#each slide.items as item}
            <Textbox {item} />
          {/each}
        </span>
      </div>
      <!-- TODO: BG: white, color: black -->
      <div class="label" style="width: {resolution.width * zoom}px;" title={slide.label || ""}>
        <!-- font-size: 0.8em; -->
        <span style="position: absolute;display: contents;">{index + 1}</span>
        <span class="text">{slide.label || ""}</span>
      </div>
    </Draggable>
  </div>
  {#if !$slidesOptions.grid}
    <hr />
    <div class="quickEdit edit" tabindex={0} contenteditable={true}>
      {#each slide.items as item}
        {#if item.text}
          {#each item.text as text}
            <p>{text.value}</p>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .main {
    display: flex;
    position: relative;
  }
  .main.list {
    width: 100%;
  }

  .slide {
    /* padding: 3px; */
    background-color: var(--primary);
    z-index: 0;
    outline-offset: 0;
    /* border: 2px solid var(--primary-lighter); */
    /* font-size: 5em; */
  }
  .slide.active {
    /* outline: 2px solid var(--secondary);
    outline-offset: 4px; */
    outline: 3px solid var(--secondary);
    outline-offset: 4px;
  }

  /* .slide.selected {
    outline: 2px solid red;
    outline-offset: 2px;
  } */

  .slide.contrast {
    filter: contrast(0.8);
  }
  .slide.hovering::after {
    content: "";
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    margin: 0 3px;
    pointer-events: none;
    background-color: var(--secondary);
  }
  .slide.hovering.right::after {
    right: -10px;
  }
  .slide.hovering.left::after {
    left: -10px;
  }
  /* TODO: no line on selected slide hover */
  .list .slide.hovering::after {
    left: 0;
    width: 100%;
    height: 4px;
    margin: 3px 0;
  }
  .list .slide.hovering.right::after {
    top: -10px;
  }
  .list .slide.hovering.left::after {
    top: unset;
    bottom: -10px;
  }

  .slideContent {
    position: relative;
    background-color: black;
    z-index: -1;
    /* width: 1920px;
    height: 1080px; */
    font-size: 5em;
  }

  .label {
    display: flex;
    padding: 5px;
    padding-bottom: 3px;
    font-size: 0.8em;
    font-weight: bold;
    align-items: center;
    /* opacity: 0.8; */
  }

  .label .text {
    width: 100%;
    margin: 0 20px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  hr {
    height: 100%;
    width: 3px;
    border: none;
    margin: 0 10px;
    background-color: var(--primary-lighter);
  }

  .quickEdit {
    display: flex;
    background-color: rgb(0 0 0 / 0.8);
    color: white;
    padding: 3px;
    flex: 1;
  }
</style>

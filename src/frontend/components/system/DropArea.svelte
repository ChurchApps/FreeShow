<script lang="ts">
  import { activeProject, drag, projects, selected } from "../../stores"
  import { dataToPos, sortObject } from "../helpers/array"
  import { drop } from "../helpers/dropSlide"
  import { history, HistoryPages } from "../helpers/history"

  // export let id: "slide" | "slidesList" | "projectList"
  export let id: "slides" | "slide" | "shows" | "project" | "projects" | "drawer"
  let active = false
  $: hover = active

  const areas: any = {
    slides: ["slide_group", "media"],
    slide: ["slide_group", "media", "overlay", "sound"],
    project: ["show_drawer"],
    drawer: ["file"],
  }
  $: {
    // TODO: file...
    // TODO: timeout
    if (areas[id].includes($drag.id)) active = true
    else active = false
  }

  let count: number = 0
  function enter(_e: any) {
    if (active) {
      count++
      setTimeout(() => {
        if (count > 0) hover = false
      }, 800)
    }
  }

  function leave(_e: any) {
    if (active) {
      count--
      setTimeout(() => {
        if (count === 0) hover = true
      }, 10)
    }
  }

  function ondrop() {
    if (active) {
      // let data: string = e.dataTransfer.getData("text")
      let oldData: any
      let newData: any
      let page: HistoryPages = "drawer"

      console.log(id)

      if (id === "project") {
        console.log($drag.index)
        // TODO: dragging multiple
        page = "shows"
        newData = []
        let shows = $projects[$activeProject!].shows
        console.log($selected.elems)

        if ($selected.elems.length) {
          let showData: any[] = []
          console.log($drag.id)

          if ($drag.id === "show") {
            $selected.elems.forEach((i: number) => {
              shows = [...shows.slice(0, i), ...shows.slice(i + 1, shows.length)]
              console.log(shows)
              showData.push($projects[$activeProject!].shows[i])
            })
          } else showData = $selected.elems // show_drawer
          // TODO: get index from project!
          console.log(showData)
          showData = sortObject(showData, "index", true)

          newData = [...dataToPos([...shows], showData, $drag.index || shows.length)]
          console.log(newData)
        }
        oldData = [...shows]
      } else if (id === "slides") {
        if ($selected.id === "slide" || $selected.id === "slide_group") {
          drop()
        }
      }
      console.log(newData)

      history({ id, oldData, newData, location: { page } })
      selected.set({ id: null, elems: [] })
      drag.set({ id: null, index: null, side: "left" })
    }
  }
</script>

<svelte:window
  on:mousedown={(_e) => {
    // TODO: find better way of getting index...
    // if (!e.ctrlKey) drag.set({ id: null, index: null, selected: [], side: "left" })
    // if (!e.ctrlKey) selected.set({ id: null, elems: [] })
  }}
  on:dragend={() => {
    selected.set({ id: null, elems: [] })
    drag.set({ id: null, index: null, side: "left" })
  }}
/>

<div class="droparea" class:hover on:drop={ondrop} on:dragover|preventDefault on:dragenter={enter} on:dragleave={leave}>
  <slot />
</div>
{#if hover}
  <span>Drop here</span>
{/if}

<style>
  .droparea {
    flex: 1;
    height: 100%;
    width: 100%;
    align-self: flex-start;
    transition: 0.3s opacity;
  }
  .droparea.hover {
    opacity: 0.3;
    background-color: rgb(0 0 0 / 0.4);
  }

  span {
    pointer-events: none;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>

<script lang="ts">
  import { activeProject, drag, projects, selected } from "../../stores"
  import { dataToPos, sortObject } from "../helpers/array"
  import { drop } from "../helpers/dropSlide"
  import { history, HistoryPages } from "../helpers/history"

  // export let id: "slide" | "slidesList" | "projectList"
  export let id: "slides" | "shows" | "project" | "projects" | "drawer"
  let hover = false
  $: {
    // TODO: file...
    // TODO: timeout
    if ((id === "slides" && $drag.id === "slide_group") || (id === "project" && $drag.id === "show_drawer") || (id === "drawer" && $drag.id === "file")) hover = true
    else hover = false
  }

  function ondrop() {
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

<div style="flex: 1;" class:hover on:drop={ondrop} on:dragover|preventDefault>
  <slot />
</div>
{#if hover}
  <span>Drop here</span>
{/if}

<style>
  .hover {
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

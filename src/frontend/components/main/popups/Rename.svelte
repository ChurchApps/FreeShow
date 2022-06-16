<script lang="ts">
  import { activePopup, activeShow, overlays, selected, showsCache, templates } from "../../../stores"
  import { history } from "../../helpers/history"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  let list: string[] = []
  $: {
    list = []
    if ($selected.id === "overlay") {
      list = [...new Set($selected.data.map((id) => $overlays[id].name))]
    } else if ($selected.id === "template") {
      list = [...new Set($selected.data.map((id) => $templates[id].name))]
    } else if (($activeShow && $selected.id === "slide") || $selected.id === "group") {
      $selected.data.forEach((a, i) => {
        let slide = a.id ? a : _show("active").layouts("active").ref()[0][a.index]
        if (slide.parent) slide = slide.parent.id
        else slide = slide.id
        let name: string = $showsCache[$activeShow!.id].slides[slide].group || ""
        list.push(name || "—")
        if (i === 0) groupName = name
      })
      list = [...new Set(list)]
    }
  }

  const renameAction: any = {
    slide: () => {
      $selected.data.forEach((a) => {
        let newData: any = { key: "group", value: groupName }
        let slide = a.id
        let ref = _show("active").layouts("active").ref()[0][a.index]
        if (!slide) slide = ref.id
        let location: any = { page: "show", show: $activeShow, slide }

        if ($activeShow && $showsCache[$activeShow.id].slides[slide].globalGroup) history({ id: "changeSlide", newData: { key: "globalGroup", value: null }, location })
        history({ id: "changeSlide", newData, location })

        if (!slide && ref?.parent) {
          let children = _show("active").slides([ref.parent.id]).get("children")[0]
          let offsetIndex: number = ref.parent.index - children.indexOf(ref.id)
          history({
            id: "changeSlide",
            newData: { key: "children", value: children.filter((a: string) => a !== ref.id) },
            location: { page: "show", show: $activeShow!, slide: ref.parent.id },
          })
          let currentLayouts = _show("active").layouts().get("slides")
          let newLayouts: any[][] = []
          currentLayouts.forEach((layout) => {
            let l: any[] = []
            let index = -1
            let storedData = {}
            layout.forEach((slide: any) => {
              l.push(slide)
              if (index > -1) index++
              if (slide.id === ref.parent.id) {
                index = 0
                if (slide.children?.[ref.id]) {
                  storedData = slide.children[ref.id]
                  delete slide.children[ref.id]
                }
              }
              if (index === offsetIndex) {
                index = -1
                l.push({ id: ref.id, ...storedData })
              }
            })
            newLayouts.push(l)
          })

          history({
            id: "changeLayoutsSlides",
            newData: newLayouts,
            location: { page: "show", show: $activeShow!, layouts: Object.keys($showsCache[$activeShow!.id].layouts) },
          })
        }
      })
    },
    group: () => renameAction.slide(),
    overlay: () => {
      $selected.data.forEach((id) => {
        history({ id: "updateOverlay", newData: { key: "name", data: groupName }, location: { page: "drawer", id } })
      })
    },
    template: () => {
      $selected.data.forEach((id) => {
        history({ id: "updateTemplate", newData: { key: "name", data: groupName }, location: { page: "drawer", id } })
      })
    },
  }

  function rename() {
    if ($selected.id) renameAction[$selected.id]()
    activePopup.set(null)
    groupName = ""
    selected.set({ id: null, data: [] })
  }

  let groupName: string = ""
  const changeValue = (e: any) => (groupName = e.target.value)

  function keydown(e: any) {
    if (e.key === "Enter") {
      element.querySelector("input").blur()
      rename()
    }
  }

  let element: any
</script>

<svelte:window on:keydown={keydown} />

<p><T id="popup.change_name" />:</p>
<ul style="list-style-position: inside;">
  {#each list as text}
    <li style="font-weight: bold;">{text}</li>
  {/each}
</ul>
<div bind:this={element}>
  <TextInput autofocus value={groupName} {element} on:change={(e) => changeValue(e)} />
</div>
<Button style="height: auto;margin-top: 10px;" on:click={rename} center>
  <T id="actions.rename" />
</Button>

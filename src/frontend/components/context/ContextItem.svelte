<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import { ContextMenuItem, contextMenuItems } from "./contextMenus"
  import { activeEdit, activePage, activePopup, activeProject, activeShow, drawerTabsData, projects, projectView, selected, shows } from "../../stores"
  import { history } from "../helpers/history"
  import { GetLayout, GetLayoutRef } from "../helpers/get"

  export let contextElem: any
  export let contextActive: boolean
  export let id: string
  export let menu: ContextMenuItem = contextMenuItems[id]
  export let disabled: boolean = false
  let enabled: boolean = menu?.enabled ? true : false

  if (id === "private" && $shows[$selected.data[0]?.id]?.private) {
    enabled = $shows[$selected.data[0].id].private!
  } else if (id === "disable") {
    if ($selected.id === "slide" && $activeShow && GetLayout()[$selected.data[0]?.index]?.disabled) {
      enabled = GetLayout()[$selected.data[0].index].disabled!
    } else if ($selected.id === "group") {
      enabled = GetLayout().find((a) => a.id === $selected.data[0].id)?.disabled!
    }
  } else if (id === "remove" && $selected.id === "slide") {
    if ($selected.data.filter((a) => a.index === 0).length || GetLayoutRef()[$selected.data[0].index].type === "child") disabled = true
  }

  function contextItemClick() {
    if (!disabled) {
      let actionItem: null | HTMLElement = contextElem.classList.contains("_" + id) ? contextElem : contextElem.querySelector("._" + id)
      console.log(contextElem)
      // let data: any = JSON.parse(contextElem.getAttribute("data-context") || "{}")
      // console.log(data)
      let sel: any = $selected
      console.log(sel)
      let hide: boolean = true
      console.log(id)

      switch (id) {
        case "rename":
          if (sel.id === "slide" || sel.id === "group") {
            activePopup.set("rename")
          } else {
            if (actionItem instanceof HTMLInputElement) {
              // actionItem.focus()
              console.log(actionItem.value)
              // actionItem!.dispatchEvent(new CustomEvent("doubleclick"))
            } else if (actionItem) {
              // actionItem.click()
              console.log(actionItem.innerHTML)
              // actionItem.dispatchEvent(new CustomEvent("contextmenu"))
            }
          }
          break
        case "remove":
          if (sel.id === "show" && $activeProject) {
            // TODO: don't remove private!!!!
            projects.update((a) => {
              sel.data.forEach((b: any) => {
                a[$activeProject!].shows = a[$activeProject!].shows.filter((a) => a.id !== b.id)

                if ($activeShow?.index === b.index) {
                  activeShow.update((a) => {
                    delete a!.index
                    return a
                  })
                }
              })
              return a
            })
          } else if (sel.id === "slide") {
            sel.data.forEach((a: any) => {
              let slide = GetLayoutRef()[a.index].id
              // TODO: change layout children & slide parent children
              history({ id: "changeSlide", newData: { group: null, color: null, globalGroup: null }, location: { page: "show", show: $activeShow!, slide } })
            })
          }
          break
        case "delete":
          if (sel.id === "show_drawer") {
            activePopup.set("delete_show")
          } else if (sel.id === "category") {
            sel.data.forEach((a: any) => {
              history({ id: "deleteShowsCategory", newData: { id: a } })
            })
          } else if (sel.id === "slide") {
            // TODO: delete slide....
            // shows.update((a) => {
            //   delete a[$activeShow!.id].slides[GetLayoutRef()[sel.data[0].index].id]
            //   return a
            // })
          }
          break
        case "duplicate":
          if (sel.id === "show" || sel.id === "show_drawer") {
            sel.data.forEach((a: any) => {
              let show = { ...$shows[a.id] }
              show.name += " #2"
              show.timestamps.modified = new Date()
              console.log(show)
              history({ id: "newShow", newData: { show }, location: { page: "show", project: sel.id === "show" ? $activeProject : null } })
            })
          } else if (sel.id === "slide") {
            // TODO: duplicate slide....
          }
          break
        // drawer
        case "enabled_drawer_tabs":
          hide = false
          enabled = !enabled
          $drawerTabsData[menu.id!].enabled = enabled
          break
        case "addToProject":
          if ((sel.id === "show" || sel.id === "show_drawer") && $activeProject) {
            projects.update((a) => {
              a[$activeProject!].shows.push(...sel.data)
              // sel.data.forEach((b: any) => {
              //   console.log(b, a[$activeProject!].shows)

              //   a[$activeProject!].shows.push({ id: b.id })
              // })
              return a
            })
          }
          break
        // new
        case "newShowPopup":
          activePopup.set("show")
          break
        case "newShow":
        case "newProject":
        case "newFolder":
        case "newPrivateShow":
          let oldData = null
          if (id === "newProject" || id === "newFolder") oldData = contextElem.getAttribute("data-parent") || contextElem.id
          history({ id, oldData, location: { page: "show", project: $activeProject } })
          break
        // project
        case "close":
          if (contextElem.classList.contains("#projectTab") && $activeProject) {
            activeProject.set(null)
            projectView.set(true)
          }
          break
        case "private":
          shows.update((a) => {
            sel.data.forEach((b: any) => {
              a[b.id].private = !enabled
            })
            return a
          })
          break
        // show
        case "disable":
          if (sel.id === "slide") {
            shows.update((a) => {
              sel.data.forEach((b: any) => {
                let ref = GetLayoutRef()[b.index]
                if (ref.type === "child") a[$activeShow!.id].layouts[a[$activeShow!.id].settings.activeLayout].slides[ref.layoutIndex].children[ref.id].disabled = !enabled
                else a[$activeShow!.id].layouts[a[$activeShow!.id].settings.activeLayout].slides[ref.index].disabled = !enabled
              })
              return a
            })
          } else if (sel.id === "group") {
            shows.update((a) => {
              let ref = GetLayoutRef()
              ref.forEach((b: any) => {
                sel.data.forEach((c: any) => {
                  console.log(b)
                  if (b.type === "child" && b.parent === c.id)
                    a[$activeShow!.id].layouts[a[$activeShow!.id].settings.activeLayout].slides[b.layoutIndex].children[b.id].disabled = !enabled
                  else if (b.id === c.id) a[$activeShow!.id].layouts[a[$activeShow!.id].settings.activeLayout].slides[b.layoutIndex || b.index].disabled = !enabled
                })
              })
              return a
            })
          }
          break
        case "edit":
          if (sel.id === "slide") {
            activeEdit.set({ slide: sel.data[0].index, items: [] })
          }
          activePage.set("edit")
          break
        case "slide_groups":
          sel.data.forEach((a: any) => {
            let slide = GetLayoutRef()[a.index].id
            // TODO: store group/color to redo
            // TODO: change layout children & slide parent children
            history({ id: "changeSlide", newData: { globalGroup: menu.id }, location: { page: "show", show: $activeShow!, slide } })
          })
          break
        // drawer navigation
        case "changeIcon":
          activePopup.set("icon")
          break
        case "selectAll":
          let data: any[] = []
          if (sel.id === "group") {
            let ref = GetLayoutRef()
            sel.data.forEach((a: any) => {
              ref.forEach((b, i) => {
                if (b.type === "child" ? a.id === b.parent : a.id === b.id) data.push({ index: i })
              })
            })
            selected.set({ id: "slide", data })
          } else if ($activeShow) {
            data = GetLayoutRef().map((_a, index) => ({ index }))
          }
          selected.set({ id: "slide", data })
          break

        default:
          console.log("MISSING CONTEXT: ", id)
          break
      }

      if (hide) contextActive = false
    }
  }
</script>

<!-- {$fullColors ? 'background-' : ''} -->
<div on:click={contextItemClick} title={menu?.shortcuts?.join(", ")} class:enabled class:disabled style="color: {menu?.color || 'unset'}">
  {#if menu?.icon}<Icon id={menu.icon} />{/if}
  {#if menu?.translate === false}
    {menu?.label}
  {:else}
    {#key menu}
      <T id={menu?.label || id} />
    {/key}
  {/if}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 20px;
    cursor: pointer;
  }
  div:hover:not(.disabled) {
    background-color: rgb(0 0 0 / 0.2);
  }

  div.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .enabled {
    color: var(--secondary);
    background-color: rgb(255 255 255 / 0.1);
  }
</style>

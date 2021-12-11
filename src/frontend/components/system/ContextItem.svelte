<script lang="ts">
  import Icon from "../helpers/Icon.svelte"

  import T from "../helpers/T.svelte"
  import { ContextMenuItem, contextMenuItems } from "../../values/contextMenus"
  import { drawerTabsData } from "../../stores"
  import { history } from "../helpers/history"

  export let contextElem: any
  export let contextActive: boolean
  export let id: string
  export let menu: ContextMenuItem = contextMenuItems[id]
  export let disabled: boolean = false
  let enabled: boolean = menu?.enabled ? true : false

  function contextItemClick() {
    let actionItem: null | HTMLElement = contextElem.classList.contains("_" + id) ? contextElem : contextElem.querySelector("._" + id)
    let hide: boolean = true

    switch (id) {
      case "rename":
        if (actionItem instanceof HTMLInputElement) {
          // actionItem.focus()
          console.log(actionItem.value)
        } else if (actionItem) {
          // actionItem.click()
          console.log(actionItem.innerHTML)
        }
        break
      case "enabled_drawer_tabs":
        hide = false
        enabled = !enabled
        $drawerTabsData[menu.id!].enabled = enabled
        break
      case "newProject":
      case "newFolder":
      case "newShowDrawer":
      case "newShow":
      case "newPrivateShow":
        let oldData = null
        if (id === "newProject" || id === "newFolder") oldData = contextElem.getAttribute("data-parent") || contextElem.id
        history({ id, oldData })
        break

      default:
        console.log(id)
        break
    }

    if (hide) contextActive = false
    console.log(contextActive)

    // if (id === "test") console.log("test")
    // else if (id === "rename") {
    //   if (actionItem instanceof HTMLInputElement) {
    //     // actionItem.focus()
    //     console.log(actionItem.value)
    //   } else if (actionItem) {
    //     // actionItem.click()
    //     console.log(actionItem.innerHTML)
    //   }
    // } else if (id.includes("enabled_drawer_tabs")) {
    //   let tabID = id.split("_")[3]
    //   enabled = !enabled
    //   $drawerTabsData[tabID].enabled = enabled
    // } else console.log(id)
  }
</script>

<div on:click={contextItemClick} title={menu?.shortcuts?.join(", ")} class:enabled {disabled}>
  {#if menu?.icon}<Icon id={menu.icon} />{/if}
  {#key menu}
    <T id={menu?.label || id} />
  {/key}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 20px;
    cursor: pointer;
  }
  div:hover {
    background-color: rgb(0 0 0 / 0.2);
  }

  div:disabled {
    opacity: 0.5;
  }

  .enabled {
    color: var(--secondary);
    background-color: rgb(255 255 255 / 0.1);
  }
</style>

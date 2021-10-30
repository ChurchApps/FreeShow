<script lang="ts">
  import Icon from "../helpers/Icon.svelte"

  import T from "../helpers/T.svelte"
  import { ContextMenuItem, contextMenuItems } from "../../values/contextMenus"
  import { enabledDrawerTabs } from "../../stores"

  export let contextElem: any
  export let id: string
  export let menu: ContextMenuItem = contextMenuItems[id]
  export let disabled: boolean = false
  let enabled: boolean = menu.enabled ? true : false

  function contextItemClick() {
    let actionItem: null | HTMLElement = contextElem.classList.contains("_context_" + id) ? contextElem : contextElem.querySelector("._context_" + id)

    if (id === "test") console.log("test")
    else if (id === "rename") {
      if (actionItem instanceof HTMLInputElement) {
        // actionItem.focus()
        console.log(actionItem.value)
      } else if (actionItem) {
        // actionItem.click()
        console.log(actionItem.innerHTML)
      }
    } else if (id.includes("enabled_drawer_tabs")) {
      let tabID = id.split("_")[3]
      enabled = !enabled
      $enabledDrawerTabs[tabID] = enabled
    } else console.log(id)
  }
</script>

<div on:click={contextItemClick} title={menu.shortcuts?.join(", ")} class:enabled {disabled}>
  {#if menu.icon}<Icon id={menu.icon} />{/if}
  {#key menu}
    <T id={menu.label} />
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

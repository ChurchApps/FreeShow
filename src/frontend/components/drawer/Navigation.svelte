<script lang="ts">
  import type { Category } from "../../../types/Tabs"

  import { categories, drawerTabsData, mediaFolders } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import FilePicker from "../inputs/FilePicker.svelte"
  import FolderPicker from "../inputs/FolderPicker.svelte"

  export let id: string

  let buttons: Category = {}
  $: {
    if (id === "shows") {
      buttons = {
        all: { name: "category.all", default: true, icon: "all" },
        ...$categories,
        unlabeled: { name: "category.unlabeled", default: true, icon: "unlabeled" },
      }
    } else if (id === "backgrounds") {
      buttons = {
        all: { name: "category.all", default: true, icon: "all" },
        ...$mediaFolders,
      }
    } else buttons = {}
  }

  console.log(buttons)
  $: {
    if ($drawerTabsData[id].activeSubTab === null) {
      // setTab(Object.keys(buttons)[0])
      setTab("all")
    }
  }

  function setTab(tabID: string) {
    drawerTabsData.update((dt) => {
      dt[id].activeSubTab = tabID
      return dt
    })
  }
</script>

<div class="main">
  {#each Object.entries(buttons) as category}
    <Button active={category[0] === $drawerTabsData[id].activeSubTab} on:click={() => setTab(category[0])} bold={false} title={category[1].url ? category[1].url : ""}>
      <Icon id={category[1].icon || "unknown"} />
      <div id={category[0]}>
        {#if category[1].default}
          <T id={category[1].name} />
        {:else}
          {category[1].name}
        {/if}
      </div>
    </Button>
  {/each}
  {#if id === "backgrounds"}
    <FilePicker />
    <FolderPicker />
  {/if}
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  /* button {
    padding: 10px;
    display: flex;
    border: none;
    background-color: inherit;
    color: inherit;
  } */
</style>

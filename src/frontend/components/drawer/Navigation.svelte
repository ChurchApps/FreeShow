<script lang="ts">
  import type { Category } from "../../../types/Tabs"

  import { categories, drawerTabsData } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  export let id: string

  let buttons: Category = {}
  $: {
    if (id === "shows") {
      buttons = {
        all: { name: "category.all", default: true, icon: "all" },
        ...$categories,
        unlabeled: { name: "category.unlabeled", default: true, icon: "unlabeled" },
      }
    } else buttons = {}
  }

  console.log(buttons)
  if ($drawerTabsData[id].activeSubTab === null) {
    // setTab(Object.keys(buttons)[0])
    setTab("all")
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
    <Button active={category[0] === $drawerTabsData[id].activeSubTab} on:click={() => setTab(category[0])} bold={false}>
      <Icon id={category[1].icon || "unknown"} />
      <div id={category[0]}>
        <T id={category[1].name} />
      </div>
    </Button>
  {/each}
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

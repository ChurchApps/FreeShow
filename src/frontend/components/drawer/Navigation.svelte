<script lang="ts">
  import type { Category } from "../../../types/Tabs"

  import { categories } from "../../stores"
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
        unlabeled: { name: "category.unlabeled", default: true, icon: "unknown" },
      }
    } else buttons = {}
  }

  let active = "all"
</script>

<div class="main">
  {#each Object.entries(buttons) as category}
    <Button active={category[0] === active} on:click={() => (active = category[0])} style="justify-content: inherit">
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
    overflow-y: auto;
    flex: 1;
  }

  /* button {
    padding: 10px;
    display: flex;
    border: none;
    background-color: inherit;
    color: inherit;
  } */
</style>

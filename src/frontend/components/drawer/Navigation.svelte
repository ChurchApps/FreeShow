<script lang="ts">
  import type { Category } from "../../../types/Tabs"

  import { categories } from "../../stores"

  export let id: string

  let buttons: Category = {}
  $: {
    if (id === "shows") buttons = { all: { name: "category.all", icon: "all" }, ...$categories, unlabeled: { name: "category.nolabel", icon: "unknown" } }
  }
</script>

<div>
  {#each Object.entries(buttons) as category}
    <div id={category[0]}>{category[1].name}</div>
  {/each}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    width: var(--navigation-width);
  }
</style>

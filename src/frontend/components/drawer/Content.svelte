<script lang="ts">
  import { shows } from "../../stores"
  import ShowButton from "../inputs/ShowButton.svelte"

  export let id: string
</script>

<div>
  {#if id === "shows"}
    {#each Object.entries($shows) as show}
      <ShowButton id={show[0]} name={show[1].name} icon={show[1].category || "unknown"} />
    {/each}
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>

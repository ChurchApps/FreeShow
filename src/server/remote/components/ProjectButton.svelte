<script lang="ts">
  import Button from "./Button.svelte"

  export let name: string
  export let active: boolean
</script>

<Button on:click {active} bold={false} border>
  <span>{name}</span>
</Button>

<style>
  /* button {
    width: 100%;
    padding: 0 0.3em;
    background-color: inherit;
    color: inherit;
    font-size: 0.9em;
    border: 2px solid var(--secondary);
  }
  button.active {
    background-color: var(--secondary-opacity);
    color: var(--secondary-text);
  } */
</style>

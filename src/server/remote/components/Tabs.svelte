<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import Icon from "./Icon.svelte"
  // import T from "../helpers/T.svelte"
  import Button from "./Button.svelte"

  export let tabs: TabsObj
  export let active: string
</script>

<div class="tabs">
  {#each Object.entries(tabs) as tab}
    <Button on:click={() => (active = tab[0])} title={tab[1].name} active={active === tab[0]} center>
      <Icon id={tab[1].icon} size={2} />
      <!-- {#if labels}
        <T id={tab[1].name} />
      {/if} -->
      <span class="label">{tab[1].name}</span>
    </Button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    background-color: var(--primary-darker);
  }

  .tabs :global(button) {
    flex: auto;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  @media screen and (max-width: 1500px) {
    .label {
      font-size: 0.8em;
    }
  }
  @media screen and (max-width: 1200px) {
    .label {
      font-size: 0.5em;
    }
  }
  @media screen and (max-width: 800px) {
    .label {
      display: none;
    }
  }
</style>

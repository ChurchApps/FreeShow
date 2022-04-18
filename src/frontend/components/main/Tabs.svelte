<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { dictionary, labelsDisabled } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  export let tabs: TabsObj
  export let active: string
  export let labels: boolean = $labelsDisabled ? false : true
</script>

<div class="tabs">
  {#each Object.entries(tabs) as tab}
    <Button on:click={() => (active = tab[0])} active={active === tab[0]} title={$dictionary.tooltip?.[tab[0]]} dark center>
      <Icon id={tab[1].icon} />
      {#if labels}
        <span style="padding-left: 10px;">
          <T id={tab[1].name} />
        </span>
      {/if}
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
  }
</style>

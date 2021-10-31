<script lang="ts">
  import type { TabsObj } from "../../../types/Tabs"
  import { lablesDisabled } from "../../stores"
  import { translate } from "../../utils/language"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  export let tabs: TabsObj
  export let active: string
</script>

<div class="tabs">
  {#each Object.entries(tabs) as tab}
    <Button on:click={() => (active = tab[0])} active={active === tab[0]} title={$lablesDisabled ? translate(tab[1].name) : ""}>
      <Icon id={tab[1].icon} />
      {#if !$lablesDisabled}
        <T id={tab[1].name} />
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
</style>

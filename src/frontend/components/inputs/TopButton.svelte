<script lang="ts">
  import type { TopViews } from "../../../types/Views"

  import { activePage, lablesDisabled } from "../../stores"

  import { translate } from "../../utils/language"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"

  import Button from "./Button.svelte"

  export let id: TopViews
</script>

<div>
  <Button title={translate("menu._title_" + id)} active={$activePage === id} on:click={() => activePage.set(id)}>
    <Icon {id} size={2} />
    {#if !$lablesDisabled}
      <T id={"menu." + id} />
    {/if}
  </Button>
</div>

<style>
  div :global(button) {
    padding: 10px;
    display: flex;
    flex-direction: column;
    min-width: 100px;
    /* height: 70px; */
  }
</style>

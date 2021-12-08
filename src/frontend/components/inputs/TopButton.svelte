<script lang="ts">
  import type { TopViews } from "../../../types/Views"

  import { activePage, dictionary, labelsDisabled } from "../../stores"

  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"

  import Button from "./Button.svelte"

  export let id: TopViews

  $: title = $dictionary.menu?.["_title_" + id]
</script>

<div>
  <Button {title} active={$activePage === id} on:click={() => activePage.set(id)}>
    <Icon {id} size={1.8} />
    {#if !$labelsDisabled}
      <span><T id={"menu." + id} /></span>
    {/if}
  </Button>
</div>

<style>
  div :global(button) {
    /* padding: 10px; */
    display: flex;
    /* flex-direction: column; */
    justify-content: center;
    min-width: 100px;
    height: 100%;
  }
  div :global(button) :global(svg) {
    padding: 0 0.8em;
    padding-left: 0;
  }
</style>

<script lang="ts">
  import { webFavorites } from "../../stores"
  import Center from "../system/Center.svelte"

  export let active: null | string
  export let searchValue: null | string
  $: url = searchValue ? searchValue : active ? $webFavorites[active].url : null
  $: console.log(searchValue, url)

  // $: if (!url?.includes("&output=embed")) url += "&output=embed"
</script>

{#if url}
  <iframe src={url} title="Web" frameborder="0" allowfullscreen />
  <!-- https://www.electronjs.org/docs/v14-x-y/api/webview-tag -->
  <!-- <webview id="foo" src={url} style="display:inline-flex; width:640px; height:480px"></webview> -->
{:else}
  <Center faded>[[[Type url into seach area]]]</Center>
{/if}

<style>
  iframe {
    color: var(--text);
    height: 100%;
  }
</style>

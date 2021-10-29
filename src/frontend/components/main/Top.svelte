<script type="ts">
  import T from "../helpers/T.svelte"
  import type { TopViews } from "../../../types/Views"

  export let mode: TopViews

  // let settings = false
</script>

<!-- <button on:click={() => (settings = !settings)}>
  <T id="menus.settings" />
  {translate('menus.settings', $language)}
  {translate(d.menus?.settings)}
</button> -->

<div>
  <span>
    <button title="Switch to live view" on:click={() => (mode = "live")}>Live</button>
    <button title="Go to editor" on:click={() => (mode = "edit")}>Edit</button>
    <button title="Go to stage" on:click={() => (mode = "stage")}>Stage</button>
  </span>
  <span>
    <button title="Settings" on:click={() => (mode = "settings")}><T id="menus.settings" /></button>
  </span>
</div>

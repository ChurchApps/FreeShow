<script lang="ts">
  import T from "../../helpers/T.svelte"
  import Screens from "../Screens.svelte"
</script>

<!-- TODO: display... -->
<div>
  <p><T id="settings.output_screen" /></p>
  <Screens />
</div>

<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }
</style>

<script lang="ts">
  import { autoOutput } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Screens from "../Screens.svelte"

  function setAutoOutput(e: any) {
    autoOutput.set(e.target.checked)
  }
</script>

<div>
  <p><T id="settings.auto_output" /></p>
  <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
</div>
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

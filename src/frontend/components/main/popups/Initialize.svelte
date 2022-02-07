<script lang="ts">
  import { autoOutput } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import LocaleSwitcher from "../../settings/LocaleSwitcher.svelte"

  const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)
</script>

<div class="main">
  <h2><T id="main.welcome" /></h2>
  <p><T id="main.good_luck" /></p>
  <p><T id="main.tips" /></p>

  <div>
    <p><T id="settings.language" /></p>
    <LocaleSwitcher />
  </div>
  <div>
    <div>
      <p><T id="settings.auto_output" /></p>
      <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
    </div>
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
  }

  .main div {
    display: flex;
    justify-content: space-between;
  }
</style>

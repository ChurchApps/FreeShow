<script lang="ts">
  import { activePopup, autoOutput } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import LocaleSwitcher from "../../settings/LocaleSwitcher.svelte"

  const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)
</script>

<div class="main">
  <h2><T id="main.welcome" /></h2>
  <p><T id="setup.good_luck" /></p>
  <p><T id="setup.tips" /></p>

  <br />

  <p><T id="setup.change_later" />:</p>
  <div>
    <p><T id="settings.language" /></p>
    <LocaleSwitcher />
  </div>
  <div>
    <p><T id="settings.auto_output" /></p>
    <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
  </div>

  <br />
  <Button on:click={() => activePopup.set(null)} style="font-size: 2em;" border center>
    <T id="setup.get_started" />
  </Button>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
  }

  .main div {
    padding: 5px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>

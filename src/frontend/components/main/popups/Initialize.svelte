<script lang="ts">
  import { MAIN } from "../../../../types/Channels"
  import { activePopup, autoOutput, showsPath } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import FolderPicker from "../../inputs/FolderPicker.svelte"
  import LocaleSwitcher from "../../settings/LocaleSwitcher.svelte"

  const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)

  function create(e: any) {
    if (e.target.closest(".main") && !e.target.closest(".start")) return
    window.api.send(MAIN, { channel: "GET_PATHS" })
    activePopup.set(null)
  }
</script>

<svelte:window on:click={create} />

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
    <p><T id="settings.show_location" /></p>
    <span>
      {$showsPath}
      <FolderPicker id="shows">[[[Choose another location...]]]</FolderPicker>
    </span>
  </div>
  <div>
    <p><T id="settings.auto_output" /></p>
    <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
  </div>

  <br />
  <Button class="start" on:click={create} style="font-size: 2em;" border center>
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

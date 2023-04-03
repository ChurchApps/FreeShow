<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, showsPath } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import LocaleSwitcher from "../../settings/LocaleSwitcher.svelte"

    // const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)

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
    <div style="background: var(--hover);padding: 10px;">
        <p><strong><T id="settings.language" /></strong></p>
        <LocaleSwitcher />
    </div>
    <div style="background: var(--hover);padding: 10px;">
        <p style="overflow: visible;"><strong><T id="settings.show_location" /></strong></p>
        <span class="showElem">
            <p>{$showsPath || ""}</p>
            <FolderPicker id="SHOWS">
                <T id="inputs.change_folder" />
            </FolderPicker>
        </span>
    </div>
    <!-- <div>
    <p><T id="settings.auto_output" /></p>
    <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
  </div> -->

    <br />
    <Button class="start" on:click={create} style="font-size: 2em;" border center>
        <Icon id="noIcon" size={2} right />
        <T id="setup.get_started" />
    </Button>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .main div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 5px 0;
    }

    .main .showElem {
        display: flex;
        align-items: center;
        gap: 10px;

        overflow: hidden;
        white-space: nowrap;
    }
</style>

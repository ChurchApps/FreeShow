<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, showsPath } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
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
    <p><T id="setup.good_luck" /></p>
    <p><T id="setup.tips" /></p>

    <br />

    <p style="margin-bottom: 10px;"><T id="setup.change_later" />:</p>
    <CombinedInput textWidth={30}>
        <p><T id="settings.language" /></p>
        <LocaleSwitcher />
    </CombinedInput>
    <CombinedInput textWidth={30}>
        <p style="overflow: visible;"><T id="settings.show_location" /></p>
        <span class="showElem">
            <!-- <p>{$showsPath || ""}</p> -->
            <FolderPicker title={$showsPath || ""} id="SHOWS">
                <Icon id="folder" size={1.2} right />
                {#if $showsPath}
                    {$showsPath}
                {:else}
                    <T id="inputs.change_folder" />
                {/if}
            </FolderPicker>
        </span>
    </CombinedInput>
    <!-- <div>
    <p><T id="settings.auto_output" /></p>
    <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
  </div> -->

    <br />

    <Button class="start" on:click={create} style="font-size: 2em;" dark center>
        <Icon id="check" size={2.5} right />
        <T id="setup.get_started" />
    </Button>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;

        width: 50vw;
    }

    .main .showElem {
        display: flex;
        align-items: center;
        gap: 10px;

        overflow: hidden;
        white-space: nowrap;
    }
</style>

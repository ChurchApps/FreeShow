<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, dataPath, guideActive, language, showsPath, timeFormat } from "../../../stores"
    import { createData } from "../../../utils/createData"
    import { getLanguageList, setLanguage } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    // const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)

    onMount(() => {
        if (!$dataPath) sendMain(Main.DATA_PATH)
        if (!$showsPath) sendMain(Main.SHOWS_PATH)

        // check time format (based on browser language)
        const locale = navigator.language
        const use12Hour = Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12
        if (use12Hour === true) timeFormat.set("12")
    })

    function create(e: any) {
        if (e.target.closest(".main") && !e.target.closest(".start")) return

        requestMain(Main.GET_PATHS, undefined, (a) => createData(a))

        if ($showsPath) sendMain(Main.REFRESH_SHOWS, { path: $showsPath })
        else sendMain(Main.SHOWS_PATH)

        guideActive.set(true)
        activePopup.set(null)
    }

    const inputs = {
        timeFormat: (e: any) => timeFormat.set(e.target.checked ? "24" : "12")
    }

    function restore() {
        sendMain(Main.RESTORE, { showsPath: $showsPath! })
    }
</script>

<div class="main">
    <p><T id="setup.good_luck" /></p>
    <p><T id="setup.tips" /></p>

    <!-- <HRule /> -->

    <p style="margin-top: 25px;margin-bottom: 10px;font-style: italic;opacity: 0.7;"><T id="setup.change_later" />:</p>

    <MaterialDropdown label="settings.language" value={$language} options={getLanguageList()} on:change={(e) => setLanguage(e.detail)} flags />

    <CombinedInput textWidth={30}>
        <p><T id="settings.use24hClock" /></p>
        <div class="alignRight">
            <Checkbox checked={$timeFormat === "24"} on:change={inputs.timeFormat} />
        </div>
    </CombinedInput>

    <CombinedInput textWidth={30}>
        <p style="overflow: visible;"><T id="settings.data_location" /></p>
        <span class="showElem">
            <FolderPicker style="width: 100%;" title={$dataPath || ""} id="DATA_SHOWS" center={false} path={$dataPath}>
                <Icon id="folder" size={1.2} right />
                {#if $dataPath}
                    {$dataPath}
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

    <Button class="start" on:click={create} style="font-size: 2em;margin-top: 20px;" dark center>
        <Icon id="check" size={2.5} right />
        <T id="setup.get_started" />
    </Button>

    <HRule title="setup.or" />

    <Button style="padding: 8px !important;" disabled={!$showsPath} on:click={restore} center dark>
        <span style="display: flex;align-items: center;">
            <Icon id="import" style="margin-inline-start: 0.5em;" size={1.3} right />
            <p><T id="setup.restore_data" /></p>
        </span>
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

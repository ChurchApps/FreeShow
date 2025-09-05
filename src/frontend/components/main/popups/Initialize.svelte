<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, dataPath, dictionary, guideActive, language, showsPath, timeFormat } from "../../../stores"
    import { createData } from "../../../utils/createData"
    import { getLanguageList, setLanguage, translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFolderPicker from "../../inputs/MaterialFolderPicker.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

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
        requestMain(Main.GET_PATHS, undefined, (a) => createData(a))

        if ($showsPath) sendMain(Main.REFRESH_SHOWS, { path: $showsPath })
        else sendMain(Main.SHOWS_PATH)

        guideActive.set(true)
        activePopup.set(null)
    }

    function restore() {
        sendMain(Main.RESTORE, { showsPath: $showsPath! })
    }

    $: languageText = translateText("settings.language", $dictionary)
    $: languageLabel = `${languageText}${languageText === "Language" ? "" : "/Language"}`
</script>

<MaterialButton style="inset-inline-end: 0;" class="popup-options" icon="import" iconSize={1.3} title="setup.restore_data" disabled={!$showsPath} on:click={restore} white />

<div class="main">
    <p><T id="setup.good_luck" /></p>
    <p style="opacity: 0.8;"><T id="setup.tips" /></p>

    <HRule />

    <p style="margin-bottom: 10px;font-style: italic;font-size: 0.8em;opacity: 0.5;"><T id="setup.change_later" />:</p>

    <InputRow>
        <MaterialDropdown style="width: 50%;" label={languageLabel} value={$language} options={getLanguageList()} on:change={(e) => setLanguage(e.detail)} flags />
        <MaterialToggleSwitch style="width: 50%;" label="settings.use24hClock" checked={$timeFormat === "24"} on:change={(e) => timeFormat.set(e.detail ? "24" : "12")} />
    </InputRow>

    <MaterialFolderPicker PICK_ID="DATA_SHOWS" label={translateText("settings.data_location", $dictionary)} value={$dataPath} on:change={(e) => dataPath.set(e.detail)} openButton={false} />
    <!-- <div>
    <p><T id="settings.auto_output" /></p>
    <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
  </div> -->

    <MaterialButton variant="outlined" class="start" style="font-size: 1.8em;padding: 15px;margin-top: 20px;" on:click={create} white>
        <Icon id="check" size={2.5} />
        <T id="setup.get_started" />
    </MaterialButton>

    <!-- <HRule title="setup.or" />

    <MaterialButton variant="outlined" style="padding: 8px;" disabled={!$showsPath} on:click={restore} white>
        <Icon id="import" style="margin-inline-start: 0.5em;" size={1.2} white />
        <T id="setup.restore_data" />
    </MaterialButton> -->
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;

        width: 50vw;
    }
</style>

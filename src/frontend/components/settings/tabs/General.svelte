<script lang="ts">
    import { activePopup, autoOutput, autosave, labelsDisabled, special, timeFormat } from "../../../stores"
    import { setLanguage } from "../../../utils/language"
    import { DEFAULT_PROJECT_NAME, projectReplacers } from "../../helpers/historyHelpers"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import LocaleSwitcher from "../LocaleSwitcher.svelte"

    const inputs = {
        defaultProjectName: (e: any) => updateSpecial(e.target.value || "", "default_project_name"),
        timeFormat: (e: any) => timeFormat.set(e.target.checked ? "24" : "12"),
        labels: (e: any) => labelsDisabled.set(e.target.checked),
        autoOutput: (e: any) => autoOutput.set(e.target.checked),
        hideCursor: (e: any) => updateSpecial(e.target.checked, "hideCursor"),
        clearMediaOnFinish: (e: any) => updateSpecial(e.target.checked, "clearMediaOnFinish"),
    }

    function updateSpecial(value, key) {
        special.update((a) => {
            if (key === "hideCursor" && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    const autosaveList = [
        { id: "never", name: "$:settings.never:$" },
        { id: "2min", name: "2 $:settings.minutes:$" },
        { id: "5min", name: "5 $:settings.minutes:$" },
        { id: "10min", name: "10 $:settings.minutes:$" },
        { id: "15min", name: "15 $:settings.minutes:$" },
        { id: "30min", name: "30 $:settings.minutes:$" },
    ]

    function reset() {
        setLanguage()
        timeFormat.set("24")
        labelsDisabled.set(false)

        autoOutput.set(false)

        special.update((a) => {
            delete a.default_project_name
            delete a.hideCursor
            delete a.clearMediaOnFinish
            return a
        })
    }

    /////

    let projectReplacerTitle = getReplacerTitle()
    function getReplacerTitle() {
        let titles: string[] = []
        projectReplacers.forEach((a) => {
            titles.push(`${a.title}: {${a.id}}`)
        })

        return titles.join(", ")
    }

    // WIP set calendar starting day
    // WIP change date format (DD.MM.YYYY, YYYY-MM-DD)
</script>

<CombinedInput>
    <p><T id="settings.language" /></p>
    <LocaleSwitcher />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.autosave" /></p>
    <Dropdown options={autosaveList} value={autosaveList.find((a) => a.id === ($autosave || "never"))?.name || ""} on:click={(e) => autosave.set(e.detail.id)} />
</CombinedInput>

<CombinedInput title={projectReplacerTitle}>
    <p><T id="settings.default_project_name" /></p>
    <TextInput value={$special.default_project_name ?? DEFAULT_PROJECT_NAME} on:change={inputs.defaultProjectName} />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.use24hClock" /></p>
    <div class="alignRight">
        <Checkbox checked={$timeFormat === "24"} on:change={inputs.timeFormat} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.disable_labels" /></p>
    <div class="alignRight">
        <Checkbox checked={$labelsDisabled} on:change={inputs.labels} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.auto_output" /></p>
    <div class="alignRight">
        <Checkbox checked={$autoOutput} on:change={inputs.autoOutput} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.hide_cursor_in_output" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.hideCursor} on:change={inputs.hideCursor} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.clear_media_when_finished" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.clearMediaOnFinish ?? true} on:change={inputs.clearMediaOnFinish} />
    </div>
</CombinedInput>

<CombinedInput>
    <Button style="width: 50%;" on:click={() => activePopup.set("manage_colors")}>
        <Icon id="color" style="margin-left: 0.5em;" right />
        <p><T id="popup.manage_colors" /></p>
    </Button>
    <Button on:click={() => activePopup.set("manage_icons")}>
        <Icon id="star" style="margin-left: 0.5em;" right />
        <p><T id="popup.manage_icons" /></p>
    </Button>
</CombinedInput>

<div class="filler" />
<div class="bottom">
    <Button style="width: 100%;" on:click={reset} center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>

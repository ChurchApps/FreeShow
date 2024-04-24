<script lang="ts">
    import { alertUpdates, autoOutput, autosave, labelsDisabled, special, timeFormat } from "../../../stores"
    import { setLanguage } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import LocaleSwitcher from "../LocaleSwitcher.svelte"

    const inputs: any = {
        timeFormat: (e: any) => timeFormat.set(e.target.checked ? "24" : "12"),
        updates: (e: any) => alertUpdates.set(e.target.checked),
        autoUpdates: (e: any) => updateSpecial(e.target.checked, "autoUpdates"),
        labels: (e: any) => labelsDisabled.set(e.target.checked),
        autoOutput: (e: any) => autoOutput.set(e.target.checked),
        hideCursor: (e: any) => updateSpecial(e.target.checked, "hideCursor"),
    }

    const autosaveList: any = [
        { id: "never", name: "$:settings.never:$" },
        { id: "2min", name: "2 $:settings.minutes:$" },
        { id: "5min", name: "5 $:settings.minutes:$" },
        { id: "10min", name: "10 $:settings.minutes:$" },
        { id: "15min", name: "15 $:settings.minutes:$" },
        { id: "30min", name: "30 $:settings.minutes:$" },
    ]

    function updateSpecial(value, key) {
        special.update((a) => {
            if (key === "hideCursor" && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    function reset() {
        setLanguage()
        timeFormat.set("24")
        alertUpdates.set(true)
        autoOutput.set(false)
        labelsDisabled.set(false)

        special.update((a) => {
            delete a.hideCursor
            delete a.autoUpdates
            return a
        })
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
<CombinedInput>
    <p><T id="settings.use24hClock" /></p>
    <div class="alignRight">
        <Checkbox checked={$timeFormat === "24"} on:change={inputs.timeFormat} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.alert_updates" /></p>
    <div class="alignRight">
        <Checkbox checked={$alertUpdates} on:change={inputs.updates} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.auto_updates" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.autoUpdates !== false} on:change={inputs.autoUpdates} />
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

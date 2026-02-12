<script lang="ts">
    import { activeStage, outputs, stageShows } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    $: currentStage = $stageShows[$activeStage.id || ""]
    $: settings = currentStage.settings

    function updateStageSettings(e: any, key: string) {
        let value = e.target?.value || e
        if (value === settings[key]) return

        history({ id: "UPDATE", newData: { data: value, key: "settings", subkey: key }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage" } })
    }

    // add?:
    // flash on update
    // password

    $: outputsList = sortByName(keysToID($outputs).filter((a) => !a.stageOutput)).map((a) => ({ value: a.id, label: a.name }))
</script>

<div class="tools">
    <div>
        <MaterialDropdown label="stage.source_output" options={outputsList} value={settings.output || ""} on:change={(e) => updateStageSettings(e.detail, "output")} allowEmpty />
    </div>

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="style" white />
                <p>{translateText("edit.style")}</p>
            </span>
        </div>

        <MaterialColorInput label="edit.background_color" value={settings.color || "#000000"} defaultValue="#000000" on:input={(e) => updateStageSettings(e.detail, "color")} />

        <MaterialCheckbox label="stage.labels" checked={settings.labels} on:change={(e) => updateStageSettings(e.detail, "labels")} />
        {#if settings.labels}
            <MaterialColorInput label="stage.label_color" value={settings.labelColor || "#ac9c35"} defaultValue={"#ac9c35"} on:input={(e) => updateStageSettings(e.detail, "labelColor")} />
        {/if}
    </div>
</div>

<!-- probably not needed -->
<!-- <CombinedInput>
    <p><T id="stage.auto_stretch" /></p>
    <div class="alignRight">
        <Checkbox checked={settings.autoStretch ?? true} on:change={(e) => toggleValue(e, "autoStretch")} />
    </div>
</CombinedInput> -->

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }
</style>

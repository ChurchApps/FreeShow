<script lang="ts">
    import { dictionary, fullColors, groups, labelsDisabled, language, special, timeFormat, uiStyle } from "../../../stores"
    import { applyUIStyle } from "../../../utils/interfaceStyle"
    import { getLanguageList, setLanguage, translateText } from "../../../utils/language"
    import { isGroupHidden } from "../../../utils/profile"
    import { sortByName } from "../../helpers/array"
    import Title from "../../input/Title.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    /////

    // WIP set calendar starting day
    // WIP change date format (DD.MM.YYYY, YYYY-MM-DD)

    $: groupsString = updateGroups($groups, $dictionary)
    function updateGroups(groups: any, _updater: any) {
        const groupsList: { label: string; color: string }[] = []
        Object.entries(groups).forEach(([id, a]: [string, any]) => {
            if (isGroupHidden(id)) return
            groupsList.push({ label: a.default ? translateText(`groups.${a.name}`) || a.name : a.name, color: a.color })
        })

        const strings: string[] = []
        sortByName(groupsList, "label").forEach((a) => {
            if (a.label) strings.push(`<span style="color: ${a.color};">${a.label}</span>`)
        })

        return strings.join(`<span style="opacity: 0.4;"> | </span>`)
    }
</script>

<MaterialDropdown label="settings.language" value={$language} options={getLanguageList()} on:change={(e) => setLanguage(e.detail)} flags />
<MaterialToggleSwitch label="settings.use24hClock" checked={$timeFormat === "24"} on:change={(e) => timeFormat.set(e.detail ? "24" : "12")} />
<MaterialToggleSwitch label="settings.disable_labels" checked={$labelsDisabled} defaultValue={false} on:change={(e) => labelsDisabled.set(e.detail)} />
<MaterialToggleSwitch label="settings.full_colors" checked={$fullColors} defaultValue={false} on:change={(e) => fullColors.set(e.detail)} />

<!-- INTERFACE -->

<Title label="settings.interface_style" icon="theme" />

<div class="interfaceStyle">
    <MaterialButton variant={$uiStyle === "classic" ? "contained" : "outlined"} on:click={() => applyUIStyle("classic")}>
        <svg class="layoutIcon" viewBox="0 0 24 16" aria-hidden="true">
            <rect x="1" y="1" width="22" height="14" rx="2.5" />
            <path d="M1 5.5h22M8 5.5v9.5M16 5.5v9.5M1 12.5h22" opacity="0.55" />
        </svg>
        <T id="settings.interface_classic" />
    </MaterialButton>
    <MaterialButton variant={$uiStyle === "modern" ? "contained" : "outlined"} on:click={() => applyUIStyle("modern")}>
        <svg class="layoutIcon" viewBox="0 0 24 16" aria-hidden="true">
            <rect x="1" y="1" width="22" height="14" rx="2.5" />
            <path d="M1 5.5h22" opacity="0.55" />
            <rect x="2.6" y="7.2" width="5.4" height="6.2" rx="1" opacity="0.7" />
            <rect x="16" y="7.2" width="5.4" height="6.2" rx="1" opacity="0.7" />
            <rect x="3.4" y="3" width="4.6" height="1.4" rx="0.7" fill="currentColor" stroke="none" />
        </svg>
        <T id="settings.interface_modern" />
    </MaterialButton>
</div>

<!-- SLIDES -->

<!-- info.slides -->
<Title label="tools.slide" icon="slide" />

<MaterialPopupButton label={translateText("popup.manage_groups", $dictionary)} name={groupsString} value={groupsString ? "." : ""} popupId="manage_groups" icon="groups" />

<!-- shortcuts: -->
<MaterialToggleSwitch label="settings.next_item_on_last_slide" checked={$special.nextItemOnLastSlide !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "nextItemOnLastSlide", true)} />
<MaterialToggleSwitch label="settings.slide_number_keys" checked={$special.numberKeys} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "numberKeys")} />
<MaterialToggleSwitch label="settings.auto_shortcut_first_letter" checked={$special.autoLetterShortcut} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "autoLetterShortcut")} />

<!-- when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation -->
<!-- <Checkbox checked={$special.disablePresenterControllerKeys} on:change={(e) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")} /> -->

<style>
    .interfaceStyle {
        display: flex;
        gap: 8px;
        padding: 0.75rem;
        border-bottom: 1.2px solid var(--primary-lighter);
    }
    .interfaceStyle :global(button) {
        flex: 1;
    }
    .interfaceStyle :global(svg.layoutIcon) {
        width: 23px;
        height: 15px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1;
        opacity: 0.9;
    }
</style>

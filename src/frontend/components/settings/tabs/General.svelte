<script lang="ts">
    import { dictionary, fullColors, groups, labelsDisabled, language, special, timeFormat } from "../../../stores"
    import { getLanguageList, setLanguage, translateText } from "../../../utils/language"
    import { sortByName } from "../../helpers/array"
    import Title from "../../input/Title.svelte"
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
        Object.values(groups).forEach((a: any) => {
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

<!-- SLIDES -->

<!-- info.slides -->
<Title label="tools.slide" icon="slide" />

<MaterialPopupButton label={translateText("popup.manage_groups", $dictionary)} name={groupsString} value={groupsString ? "." : ""} popupId="manage_groups" icon="groups" />
<MaterialToggleSwitch label="settings.transparent_slides" checked={$special.transparentSlides} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "transparentSlides")} />

<!-- shortcuts: -->
<MaterialToggleSwitch label="settings.next_item_on_last_slide" checked={$special.nextItemOnLastSlide !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "nextItemOnLastSlide", true)} />
<MaterialToggleSwitch label="settings.slide_number_keys" checked={$special.numberKeys} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "numberKeys")} />
<MaterialToggleSwitch label="settings.auto_shortcut_first_letter" checked={$special.autoLetterShortcut} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "autoLetterShortcut")} />

<!-- when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation -->
<!-- <Checkbox checked={$special.disablePresenterControllerKeys} on:change={(e) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")} /> -->

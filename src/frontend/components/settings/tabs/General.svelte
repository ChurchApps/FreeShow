<script lang="ts">
    import { autoOutput, dictionary, fullColors, groups, labelsDisabled, language, os, special, timeFormat } from "../../../stores"
    import { getLanguageList, setLanguage, translateText } from "../../../utils/language"
    import { sortByName } from "../../helpers/array"
    import { DEFAULT_PROJECT_NAME, projectReplacers } from "../../helpers/historyHelpers"
    import Title from "../../input/Title.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

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

    $: projectName = $special.default_project_name ?? DEFAULT_PROJECT_NAME

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
<MaterialToggleSwitch label="settings.show_sort_bar" checked={$special.showSortBarEnabled !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "showSortBarEnabled", true)} />

<!-- PROJECT -->

<Title label="guide_title.project" icon="project" />

<MaterialTextInput label="settings.default_project_name" title={projectReplacerTitle} value={projectName} defaultValue={DEFAULT_PROJECT_NAME} on:change={(e) => updateSpecial(e.detail, "default_project_name", true)} />
<!-- WIP <span style="opacity: 0.6;display: flex;align-items: center;padding-left: 10px;font-size: 0.8em;">({getProjectName($special)})</span> -->

<MaterialToggleSwitch label="settings.startup_projects_list" checked={$special.startupProjectsList} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "startupProjectsList")} />

<!-- OUTPUT -->

<Title label="guide_title.output" icon="display_settings" />

<MaterialToggleSwitch label="settings.auto_output" checked={$autoOutput} defaultValue={false} on:change={(e) => autoOutput.set(e.detail)} />
<!-- apparently does not work on macos -->
{#if $os.platform !== "darwin"}
    <MaterialToggleSwitch label="settings.hide_cursor_in_output" checked={$special.hideCursor} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "hideCursor")} />
{/if}

<!-- SLIDES -->

<!-- info.slides -->
<Title label="tools.slide" icon="slide" />

<MaterialPopupButton label={translateText("popup.manage_groups", $dictionary)} name={groupsString} value={groupsString ? "." : ""} popupId="manage_groups" icon="groups" />
<MaterialTextInput label="settings.capitalize_words" title="settings.comma_seperated" value={$special.capitalize_words || ""} defaultValue="Jesus, Lord" on:change={(e) => updateSpecial(e.detail, "capitalize_words", true)} />
<MaterialToggleSwitch label="settings.transparent_slides" checked={$special.transparentSlides} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "transparentSlides")} />
<MaterialToggleSwitch label="settings.full_colors" checked={$fullColors} defaultValue={false} on:change={(e) => fullColors.set(e.detail)} />
<MaterialToggleSwitch label="settings.next_item_on_last_slide" checked={$special.nextItemOnLastSlide !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "nextItemOnLastSlide", true)} />
<MaterialToggleSwitch label="settings.slide_number_keys" checked={$special.numberKeys} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "numberKeys")} />
<MaterialToggleSwitch label="settings.auto_shortcut_first_letter" checked={$special.autoLetterShortcut} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "autoLetterShortcut")} />

<!-- when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation -->
<!-- <Checkbox checked={$special.disablePresenterControllerKeys} on:change={(e) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")} /> -->

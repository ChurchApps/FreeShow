<script lang="ts">
    import { autoOutput, fullColors, labelsDisabled, language, special, timeFormat } from "../../../stores"
    import { getLanguageList, setLanguage } from "../../../utils/language"
    import { DEFAULT_PROJECT_NAME, projectReplacers } from "../../helpers/historyHelpers"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Title from "../../input/Title.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    function reset() {
        setLanguage()
        timeFormat.set("24")
        labelsDisabled.set(false)

        autoOutput.set(false)

        special.update((a) => {
            delete a.hideCursor
            delete a.clearMediaOnFinish

            delete a.default_project_name
            delete a.startupProjectsList

            delete a.transparentSlides
            delete a.numberKeys
            delete a.autoLetterShortcut
            a.capitalize_words = "Jesus, Lord" // updateSettings.ts
            return a
        })

        fullColors.set(false)
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
</script>

<MaterialDropdown label="settings.language" value={$language} options={getLanguageList()} on:change={(e) => setLanguage(e.detail)} flags />
<MaterialToggleSwitch label="settings.use24hClock" checked={$timeFormat === "24"} on:change={(e) => timeFormat.set(e.detail ? "24" : "12")} />
<MaterialToggleSwitch label="settings.disable_labels" checked={$labelsDisabled} on:change={(e) => labelsDisabled.set(e.detail)} />

<!-- PROJECT -->

<Title label="guide_title.project" icon="project" />

<MaterialTextInput label="settings.default_project_name" title={projectReplacerTitle} value={projectName} defaultValue={DEFAULT_PROJECT_NAME} on:change={(e) => updateSpecial(e.detail, "default_project_name", true)} />
<!-- WIP <span style="opacity: 0.6;display: flex;align-items: center;padding-left: 10px;font-size: 0.8em;">({getProjectName($special)})</span> -->

<MaterialToggleSwitch label="settings.startup_projects_list" checked={$special.startupProjectsList} on:change={(e) => updateSpecial(e.detail, "startupProjectsList")} />

<!-- OUTPUT -->

<Title label="guide_title.output" icon="display_settings" />

<MaterialToggleSwitch label="settings.auto_output" checked={$autoOutput} on:change={(e) => autoOutput.set(e.detail)} />
<MaterialToggleSwitch label="settings.hide_cursor_in_output" checked={$special.hideCursor} on:change={(e) => updateSpecial(e.detail, "hideCursor")} />
<MaterialToggleSwitch label="settings.clear_media_when_finished" checked={$special.clearMediaOnFinish ?? true} on:change={(e) => updateSpecial(e.detail, "clearMediaOnFinish", true)} />

<!-- SLIDES -->

<!-- info.slides -->
<Title label="tools.slide" icon="slide" />

<MaterialTextInput label="settings.capitalize_words" title="settings.comma_seperated" value={$special.capitalize_words || ""} defaultValue="Jesus, Lord" on:change={(e) => updateSpecial(e.detail, "capitalize_words", true)} />
<MaterialToggleSwitch label="settings.transparent_slides" checked={$special.transparentSlides} on:change={(e) => updateSpecial(e.detail, "transparentSlides")} />
<MaterialToggleSwitch label="settings.full_colors" checked={$fullColors} on:change={(e) => fullColors.set(e.detail)} />
<MaterialToggleSwitch label="settings.slide_number_keys" checked={$special.numberKeys} on:change={(e) => updateSpecial(e.detail, "numberKeys")} />
<MaterialToggleSwitch label="settings.auto_shortcut_first_letter" checked={$special.autoLetterShortcut} on:change={(e) => updateSpecial(e.detail, "autoLetterShortcut")} />

<!-- when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation -->
<!-- <Checkbox checked={$special.disablePresenterControllerKeys} on:change={(e) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")} /> -->

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
        inset-inline-start: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;

        z-index: 2;
    }
</style>

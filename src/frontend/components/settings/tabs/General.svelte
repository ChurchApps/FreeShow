<script lang="ts">
    import { autoOutput, dictionary, fullColors, labelsDisabled, special, timeFormat } from "../../../stores"
    import { setLanguage } from "../../../utils/language"
    import { DEFAULT_PROJECT_NAME, getProjectName, projectReplacers } from "../../helpers/historyHelpers"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import LocaleSwitcher from "../LocaleSwitcher.svelte"

    const inputs = {
        timeFormat: (e: any) => timeFormat.set(e.target.checked ? "24" : "12"),
        labels: (e: any) => labelsDisabled.set(e.target.checked),
        // project
        defaultProjectName: (e: any) => updateSpecial(e.target.value || "", "default_project_name"),
        startupProjectsList: (e: any) => updateSpecial(e.target.checked, "startupProjectsList"),
        // output
        autoOutput: (e: any) => autoOutput.set(e.target.checked),
        hideCursor: (e: any) => updateSpecial(e.target.checked, "hideCursor"),
        clearMediaOnFinish: (e: any) => updateSpecial(e.target.checked, "clearMediaOnFinish", true),
        // slides
        capitalizeWords: (e: any) => updateSpecial(e.target.value || "", "capitalize_words", true),
        colors: (e: any) => fullColors.set(e.target.checked),
        transparentSlides: (e: any) => updateSpecial(e.target.checked, "transparentSlides"),
        numberKeys: (e: any) => updateSpecial(e.target.checked, "numberKeys"),
        autoLetterShortcut: (e: any) => updateSpecial(e.target.checked, "autoLetterShortcut"),
        disablePresenterControllerKeys: (e: any) => updateSpecial(e.target.checked, "disablePresenterControllerKeys")
    }

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
</script>

<CombinedInput>
    <p><T id="settings.language" /></p>
    <LocaleSwitcher />
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

<!-- PROJECT -->

<h3>
    <Icon id="project" white />
    <T id="guide_title.project" />
</h3>

<CombinedInput title={projectReplacerTitle}>
    <p><T id="settings.default_project_name" /><span style="opacity: 0.6;display: flex;align-items: center;padding-left: 10px;font-size: 0.8em;">({getProjectName($special)})</span></p>
    {#key $special}
        <TextInput value={$special.default_project_name ?? DEFAULT_PROJECT_NAME} on:change={inputs.defaultProjectName} />
    {/key}
</CombinedInput>

<CombinedInput>
    <p><T id="settings.startup_projects_list" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.startupProjectsList} on:change={inputs.startupProjectsList} />
    </div>
</CombinedInput>

<!-- OUTPUT -->

<h3>
    <Icon id="display_settings" white />
    <T id="guide_title.output" />
</h3>

<CombinedInput>
    <p><T id="settings.auto_output" /></p>
    <div class="alignRight">
        <Checkbox checked={$autoOutput} on:change={inputs.autoOutput} />
    </div>
</CombinedInput>
<CombinedInput style="border-bottom: 3px solid var(--primary-lighter);">
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

<!-- SLIDES -->

<h3>
    <Icon id="slide" white />
    <T id="tools.slide" />
    <!-- <T id="info.slides" /> -->
</h3>

<CombinedInput style="border-bottom: 3px solid var(--primary-lighter);">
    <p data-title={$dictionary.settings?.comma_seperated}><T id="settings.capitalize_words" /></p>
    <TextInput value={$special.capitalize_words || ""} on:change={inputs.capitalizeWords} />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.transparent_slides" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.transparentSlides} on:change={inputs.transparentSlides} />
    </div>
</CombinedInput>

<CombinedInput style="border-bottom: 3px solid var(--primary-lighter);">
    <p><T id="settings.full_colors" /></p>
    <div class="alignRight">
        <Checkbox checked={$fullColors} on:change={inputs.colors} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.slide_number_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.numberKeys} on:change={inputs.numberKeys} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.auto_shortcut_first_letter" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.autoLetterShortcut} on:change={inputs.autoLetterShortcut} />
    </div>
</CombinedInput>

<!-- when disabled: no ./F2 to clear, F5 clears slide timer instead of next slide, no PageUp/PageDown/Home/End for slide navigation -->
<!-- <CombinedInput>
    <p><T id="settings.disable_presenter_controller_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.disablePresenterControllerKeys} on:change={inputs.disablePresenterControllerKeys} />
    </div>
</CombinedInput> -->

<div class="filler" />
<div class="bottom">
    <Button style="width: 100%;" on:click={reset} center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

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
    }
</style>

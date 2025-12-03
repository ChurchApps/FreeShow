<script lang="ts">
    import type { BibleContent } from "../../../../types/Scripture"
    import type { Item } from "../../../../types/Show"
    import { activeDrawerTab, activeEdit, activePage, activePopup, activeScripture, activeStyle, drawerTabsData, outputs, popupData, scriptureSettings, styles, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { getAllNormalOutputs, getFirstActiveOutput } from "../../helpers/output"
    import InputRow from "../../input/InputRow.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Media from "../../output/layers/Media.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { createScriptureShow, getActiveScripturesContent, getMergedAttribution, getScriptureSlidesNew, textKeys } from "../bible/scripture"

    let biblesContent: BibleContent[] = []
    let selectedChapters: number[] = []
    let selectedVerses: (number | string)[][] = []

    $: activeScriptureId = $drawerTabsData.scripture?.activeSubTab || ""

    $: if (activeScriptureId || $activeScripture.reference) loadScriptureData()
    async function loadScriptureData() {
        const content = await getActiveScripturesContent()
        if (content?.length) {
            biblesContent = content
            selectedChapters = biblesContent[0]?.chapters || []
            selectedVerses = biblesContent[0]?.activeVerses || []
        }
    }

    let slides: Item[][] = [[]]

    // background
    $: templateId = styleScriptureTemplate || $scriptureSettings.template || "scripture" // $styles[styleId]?.templateScripture || ""
    $: template = $templates[templateId] || {}
    $: templateBackground = template.settings?.backgroundPath

    // auto change template based on number of bibles (if default)
    $: if (activeScriptureId || templateId || biblesContent.length) setTimeout(checkTemplate, 100)
    $: isDefault = typeof templateId === "string" ? templateId.includes("scripture") && !templateId.includes("LT") : false
    function checkTemplate() {
        if (!isDefault || !biblesContent.length) return

        let newTemplateId = "scripture_" + biblesContent.length
        scriptureSettings.update(a => {
            a.template = $templates[newTemplateId] ? newTemplateId : "scripture"
            return a
        })
    }

    $: {
        // if (selectedVerses.length || $scriptureSettings) slides = getScriptureSlides({ biblesContent, selectedChapters, selectedVerses }, true)
        if (selectedVerses.length || $scriptureSettings) slides = getScriptureSlidesNew({ biblesContent, selectedChapters, selectedVerses }, true)
        else slides = [[]]
    }

    $: showVersion = biblesContent.find(a => a?.attributionRequired) || $scriptureSettings.showVersion

    function update(id: string, value: any) {
        scriptureSettings.update(a => {
            a[id] = value
            return a
        })

        if (Object.keys(textKeys).includes(id)) updateCustomText(id, value)

        if (id === "splitLongVerses") longVersesMenuOpened = value
        else if (id === "verseNumbers") verseMenuOpened = value
        else if (id === "redJesus") redMenuOpened = value
        else if (id === "showVerse" || id === "showVersion") referenceMenuOpened = showVersion || $scriptureSettings.showVerse ? (value ? true : referenceMenuOpened) : false
    }

    // custom text
    $: customText = $scriptureSettings.customText || getDefaultText()
    function getDefaultText() {
        let text = ""

        Object.keys(textKeys).forEach(key => {
            let isEnabled = $scriptureSettings[key]
            if (key === "showVersion" && biblesContent.find(a => a?.attributionRequired)) isEnabled = true
            if (isEnabled) {
                if (text.length) text += "\n"
                text += textKeys[key]
            }
        })

        update("customText", text)

        return text
    }
    function updateCustomText(id: string, value: boolean) {
        let key = textKeys[id]

        if (value) {
            if (customText.includes(key)) return

            if (customText.length && !customText.includes("\n")) customText += "\n"
            customText += key
            update("customText", customText)

            return
        }

        customText = customText.replaceAll(key, "")
        if (!customText.split("\n")[0] && customText.length) customText = customText.replaceAll("\n", "")
        update("customText", customText)
    }

    function editTemplate() {
        if (styleScriptureTemplate) {
            activeStyle.set(styleId)
            activePage.set("settings")
            return
        }

        activeDrawerTab.set("templates")
        // closeDrawer()
        // drawerTabsData.update(a => {
        //     a.template.activeSubTab = "all"
        //     return a
        // })
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")
    }

    $: containsJesusWords = Object.values(biblesContent?.[0]?.verses?.[0] || {})?.find((text: any) => text?.includes('<span class="wj"') || text?.includes("<red") || text?.includes("!{"))

    $: previousSlides = "{}"
    let currentOutputSlides: any[] = []
    $: if (slides?.[0] && JSON.stringify(slides[0]) !== previousSlides) {
        currentOutputSlides = slides[0]
        previousSlides = JSON.stringify(slides[0])
    }

    $: styleId = getFirstActiveOutput($outputs)?.style || ""
    $: background = $templates[templateId]?.settings?.backgroundColor || $styles[styleId]?.background || "#000000"

    $: attributionString = getMergedAttribution(biblesContent)

    let longVersesMenuOpened = false
    let verseMenuOpened = false
    let redMenuOpened = false
    let referenceMenuOpened = false

    $: onlyOneNormalOutput = getAllNormalOutputs().length === 1
    $: styleScriptureTemplate = onlyOneNormalOutput ? $styles[styleId]?.templateScripture : ""
</script>

<div class="scroll split">
    <Zoomed style="width: 100%;" {background}>
        {#if selectedVerses.length}
            {#if templateBackground}
                <!-- WIP mediaStyle -->
                <Media path={templateBackground} videoData={{ paused: false, muted: true, loop: true }} mirror />
            {/if}

            {#key currentOutputSlides}
                {#each currentOutputSlides as item}
                    <Textbox {item} ref={{ id: "scripture" }} />
                {/each}
            {/key}

            {#if attributionString}
                <p class="attributionString">{attributionString}</p>
            {/if}
        {/if}
    </Zoomed>

    <!-- settings -->
    <div class="settings border">
        <!-- Template -->
        <InputRow style="margin-bottom: 10px;">
            <MaterialPopupButton label="info.template" disabled={!!styleScriptureTemplate} value={templateId} name={$templates[templateId]?.name} popupId="select_template" icon="templates" on:change={e => update("template", e.detail)} allowEmpty={!isDefault} />
            {#if templateId && $templates[templateId]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={editTemplate} />
            {/if}
        </InputRow>

        <!-- {#if $scriptureSettings.versesOnIndividualLines || sorted.length > 1} -->
        <MaterialToggleSwitch label="scripture.verses_on_individual_lines" checked={$scriptureSettings.versesOnIndividualLines} defaultValue={false} on:change={e => update("versesOnIndividualLines", e.detail)} />
        <!-- {/if} -->

        <!-- Long verses -->
        <InputRow arrow={$scriptureSettings.splitLongVerses} bind:open={longVersesMenuOpened}>
            <MaterialToggleSwitch label="scripture.divide_long_verses" style="width: 100%;" checked={$scriptureSettings.splitLongVerses} defaultValue={false} on:change={e => update("splitLongVerses", e.detail)} />

            <svelte:fragment slot="menu">
                {#if $scriptureSettings.splitLongVerses}
                    <MaterialToggleSwitch label="scripture.split_long_verses_suffix" checked={$scriptureSettings.splitLongVersesSuffix} defaultValue={false} on:change={e => update("splitLongVersesSuffix", e.detail)} />
                    <MaterialNumberInput label="edit.size" value={$scriptureSettings.longVersesChars || 100} defaultValue={100} min={50} on:change={e => update("longVersesChars", e.detail)} />
                {/if}
            </svelte:fragment>
        </InputRow>

        <!-- Verse numbers -->
        <InputRow arrow={$scriptureSettings.verseNumbers} bind:open={verseMenuOpened}>
            <MaterialToggleSwitch label="scripture.verse_numbers" style="width: 100%;" checked={$scriptureSettings.verseNumbers} defaultValue={false} on:change={e => update("verseNumbers", e.detail)} />

            <svelte:fragment slot="menu">
                {#if $scriptureSettings.verseNumbers}
                    <MaterialColorInput label="edit.color" value={$scriptureSettings.numberColor || "#919191"} defaultValue="#919191" on:change={e => update("numberColor", e.detail)} />
                    <MaterialNumberInput label="edit.size (%)" value={$scriptureSettings.numberSize || 50} defaultValue={50} on:change={e => update("numberSize", e.detail)} />
                {/if}
            </svelte:fragment>
        </InputRow>

        <!-- Red Jesus -->
        {#if $scriptureSettings.redJesus || containsJesusWords}
            <InputRow arrow={$scriptureSettings.redJesus} bind:open={redMenuOpened}>
                <MaterialToggleSwitch label="scripture.red_jesus" style="width: 100%;" checked={$scriptureSettings.redJesus} defaultValue={false} on:change={e => update("redJesus", e.detail)} />

                <svelte:fragment slot="menu">
                    {#if $scriptureSettings.redJesus}
                        <MaterialColorInput label="edit.color" value={$scriptureSettings.jesusColor || "#FF4136"} defaultValue="#FF4136" on:change={e => update("jesusColor", e.detail)} />
                    {/if}
                </svelte:fragment>
            </InputRow>
        {/if}

        <!-- Reference options -->
        <InputRow style="margin-top: 10px;" arrow bind:open={referenceMenuOpened}>
            <MaterialToggleSwitch label="scripture.reference" style="width: 100%;" checked={$scriptureSettings.showVerse} defaultValue={true} on:change={e => update("showVerse", e.detail)} />
        </InputRow>
        <InputRow arrow bind:open={referenceMenuOpened}>
            <MaterialToggleSwitch label="scripture.version" disabled={!!biblesContent.find(a => a?.attributionRequired)} style="width: 100%;" checked={showVersion} defaultValue={false} on:change={e => update("showVersion", e.detail)} />

            <svelte:fragment slot="menu">
                {#if showVersion || (showVersion && $scriptureSettings.showVerse) || ($scriptureSettings.showVerse && customText.trim() !== "[reference]")}
                    <MaterialTextarea label="tools.layout" value={customText} rows={2} on:change={e => update("customText", e.detail)} />
                {/if}

                <!-- {#if $scriptureSettings.showVerse}
                <CombinedInput>
                    <p><T id="meta.text_divider" /></p>
                    <TextInput value={$scriptureSettings.referenceDivider || ":"} on:change={(e) => update("referenceDivider", getTextValue(e))} />
                </CombinedInput>
            {/if} -->

                {#if showVersion || $scriptureSettings.showVerse}
                    <!-- {#if !$scriptureSettings.firstSlideReference} -->
                    <MaterialToggleSwitch label="scripture.combine_with_text" checked={$scriptureSettings.combineWithText} defaultValue={false} on:change={e => update("combineWithText", e.detail)} />
                    {#if $scriptureSettings.combineWithText}
                        <MaterialToggleSwitch label="scripture.reference_at_bottom" checked={$scriptureSettings.referenceAtBottom} defaultValue={false} on:change={e => update("referenceAtBottom", e.detail)} />
                    {/if}
                    <!-- {/if} -->

                    <!-- <br /> -->
                    <!-- WIP Unwanted: -->
                    {#if !$scriptureSettings.combineWithText}
                        <MaterialToggleSwitch label="edit.invert_items" checked={$scriptureSettings.invertItems} defaultValue={false} on:change={e => update("invertItems", e.detail)} />
                    {/if}
                {/if}
            </svelte:fragment>
        </InputRow>
    </div>
</div>

<InputRow>
    <Button on:click={e => createScriptureShow(e.altKey)} style="width: 100%;" disabled={!selectedVerses.length} dark center>
        <Icon id="slide" right />
        <T id="new.show_convert" />
        <!-- {#if slides.length > 1}
            <span style="opacity: 0.5;margin-inline-start: 0.5em;">({slides.length})</span>
        {/if} -->
    </Button>

    <Button
        title={translateText("popup.scripture_show")}
        on:click={() => {
            const showVersion = biblesContent.find(a => a?.attributionRequired) || $scriptureSettings.showVersion
            popupData.set({ showVersion })
            activePopup.set("scripture_show")
        }}
        dark
        center
    >
        <Icon id="options" white />
    </Button>
</InputRow>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    div :global(.zoomed) {
        height: initial !important;
    }

    .settings {
        display: flex;
        flex-direction: column;
        padding: 10px;
        flex: 1;
    }

    .settings :global(.dropdown) {
        /* position: absolute; */
        width: 160%;
        inset-inline-end: 0;
    }

    .attributionString {
        position: absolute;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);

        font-size: 28px;
        font-style: italic;
        opacity: 0.7;
    }
</style>

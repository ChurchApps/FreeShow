<script lang="ts">
    import { uid } from "uid"
    import type { BibleContent } from "../../../../types/Scripture"
    import type { Item, Show } from "../../../../types/Show"
    import { ShowObj } from "../../../classes/Show"
    import { createCategory } from "../../../converters/importHelpers"
    import { activeDrawerTab, activeEdit, activePage, activePopup, activeProject, activeScripture, activeTriggerFunction, drawerTabsData, outputs, popupData, scriptures, scriptureSettings, styles, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, removeDuplicates } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getActiveOutputs } from "../../helpers/output"
    import { checkName } from "../../helpers/show"
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
    import { getScriptureSlides, getShortBibleName, joinRange, loadJsonBible, textKeys } from "../bible/scripture"

    // WIP temp (similar to playScripture)
    let bibles: BibleContent[] = []
    $: if ($activeScripture.reference) loadScriptureData()
    async function loadScriptureData() {
        const tabId = $drawerTabsData.scripture?.activeSubTab || ""
        const selectedScriptureData = $scriptures[tabId]
        if (!selectedScriptureData) return

        const active = $activeScripture.reference
        const selectedVerses = active?.verses?.map(Number).sort((a, b) => a - b) || []
        if (selectedVerses.length === 0) return

        const currentScriptures = selectedScriptureData.collection?.versions || [tabId]

        bibles = await Promise.all(
            currentScriptures.map(async (id) => {
                const BibleData = await loadJsonBible(id)
                const Book = await BibleData.getBook(active?.book)

                const scriptureData = $scriptures[id]
                const version = scriptureData?.customName || scriptureData?.name || ""
                const attributionString = scriptureData?.attributionString || ""
                const attributionRequired = !!scriptureData?.attributionRequired

                const bookName = Book.name
                const selectedChapter = Number(active?.chapters[0])
                const Chapter = await Book.getChapter(selectedChapter)

                // is this needed??
                const metadata = scriptureData?.metadata || {}
                if (scriptureData?.copyright) metadata.copyright = scriptureData.copyright

                // WIP custom verse number offset per scripture

                let versesText: { [key: string]: string } = {}
                selectedVerses.forEach((v) => {
                    versesText[v] = Chapter.getVerse(v).getText()
                })

                // const reference = Chapter.getVerse(selectedVerses[0]).getReference()

                return { id, version, metadata, book: bookName, bookId: active?.book || "", chapter: selectedChapter, verses: versesText, activeVerses: selectedVerses, attributionString, attributionRequired } as BibleContent
            })
        )
    }

    // WIP sorting does not work with splitted verses
    $: sorted = (bibles[0]?.activeVerses || []).sort((a, b) => Number(a) - Number(b))

    let verseRange = ""
    $: {
        if (sorted.length) verseRange = joinRange(sorted)
        else verseRange = ""
    }

    let slides: Item[][] = [[]]

    // background
    $: templateId = $scriptureSettings.template || "scripture" // $styles[styleId]?.templateScripture || ""
    $: template = $templates[templateId] || {}
    $: templateBackground = template.settings?.backgroundPath

    $: if ($drawerTabsData || templateId) setTimeout(checkTemplate, 100)
    $: isDefault = templateId.includes("scripture") && !templateId.includes("LT")
    function checkTemplate() {
        if (!isDefault) return

        let newTemplateId = "scripture_" + bibles.length
        scriptureSettings.update((a) => {
            a.template = $templates[newTemplateId] ? newTemplateId : "scripture"
            return a
        })
    }

    $: {
        if (sorted.length || $scriptureSettings) slides = getScriptureSlides({ biblesContent: bibles as any, selectedVerses: sorted as any }, true)
        else slides = [[]]
    }

    $: if ($activeTriggerFunction === "scripture_newShow") createShow()
    $: if ($activeTriggerFunction === "scripture_newShow_popup") createShow(true)
    function createShow(noPopup = false, showPopup = false) {
        if (!verseRange) return

        if (!noPopup && (showPopup || sorted.length > 3)) {
            popupData.set({ showVersion })
            activePopup.set("scripture_show")
            return
        }

        let { show } = createSlides()
        if (!show) return
        history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
    }

    $: showVersion = bibles.find((a) => a?.attributionRequired) || $scriptureSettings.showVersion

    function createSlides() {
        if (!bibles[0]) return { show: null }

        let slides: any[][] = [[]]
        if (sorted.length || $scriptureSettings) slides = getScriptureSlides({ biblesContent: bibles as any, selectedVerses: sorted as any })

        let books = removeDuplicates(bibles.map((a) => a.book)).join(" / ")

        // create first slide reference
        // const itemIndex = $scriptureSettings?.invertItems ? 1 : 0
        if ($scriptureSettings.firstSlideReference && slides[0]?.[0]?.lines?.[0]?.text?.[0]) {
            const slideClone = clone(slides[0])
            // remove reference item
            // slides.forEach((a) => a.splice(a.length - 1, 1))
            // get verse text for correct styling
            let metaStyle = $scriptureSettings?.invertItems ? slideClone.at(-1) : slideClone.at(-2)
            if (!metaStyle) metaStyle = clone(slideClone[0])

            if (metaStyle) slides = [[metaStyle], ...slides]
            // only keep one line/text item (not verse number)
            slides[0][0].lines = [slides[0][0].lines[0]]
            slides[0][0].lines![0].text = [slides[0][0].lines[0].text[1] || slides[0][0].lines[0].text[0]]
            // set verse text to reference
            let refValue = ($scriptureSettings?.invertItems ? slideClone.at(-2) : slideClone.at(-1))?.lines?.at($scriptureSettings?.referenceAtBottom ? -1 : 0).text?.[0].value || ""
            slides[0][0].lines![0].text[0].value = refValue
        }

        let slides2: any = {}
        let layouts: any[] = []
        const referenceDivider = $scriptureSettings.referenceDivider || ":"
        slides.forEach((items: any, i: number) => {
            let id = uid()

            // get verse reference
            let v = $scriptureSettings.versesPerSlide
            if ($scriptureSettings.firstSlideReference) i--
            let range: any[] = sorted.slice((i + 1) * v - v, (i + 1) * v)
            let scriptureRef = books + " " + bibles[0].chapter + referenceDivider + joinRange(range)
            if (i === -1) scriptureRef = "—"

            slides2[id] = { group: scriptureRef || "", color: null, settings: {}, notes: "", items }
            let l: any = { id }
            layouts.push(l)
        })

        // add scripture category
        const categoryId = createCategory("scripture", "scripture", { isDefault: true, isArchive: true })

        let layoutID = uid()
        // only set template if not combined (because it might be a custom reference style on first line)
        let template = $scriptureSettings.combineWithText ? false : $scriptureSettings.template || false
        // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
        let show: Show = new ShowObj(false, categoryId, layoutID, new Date().getTime(), $scriptureSettings.verseNumbers ? false : template)

        Object.keys(bibles[0].metadata || {}).forEach((key) => {
            if (key.startsWith("@")) return
            if (typeof bibles[0].metadata?.[key] === "string") show.meta[key] = bibles[0].metadata[key]
        })
        // if (bibles[0].copyright) show.meta.copyright = bibles[0].copyright

        let bibleShowName = `${bibles[0].book} ${bibles[0].chapter},${verseRange}`
        show.name = checkName(bibleShowName)
        if (show.name !== bibleShowName) show.name = checkName(`${bibleShowName} - ${getShortBibleName(bibles[0].version || "")}`)
        show.slides = slides2
        show.layouts = { [layoutID]: { name: bibles[0].version || "", notes: "", slides: layouts } }

        let versions = bibles.map((a) => a.version).join(" + ")
        show.reference = {
            type: "scripture",
            data: {
                collection: $drawerTabsData.scripture?.activeSubTab || bibles[0].id || "",
                translations: bibles.length,
                version: versions,
                api: false, // bibles[0].api,
                book: bibles[0].bookId ?? bibles[0].book,
                chapter: bibles[0].chapter,
                verses: bibles[0].activeVerses,
                attributionString
            }
        }

        // WIP add template background?

        return { show }
    }

    function update(id: string, value: any) {
        scriptureSettings.update((a) => {
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

        Object.keys(textKeys).forEach((key) => {
            let isEnabled = $scriptureSettings[key]
            if (key === "showVersion" && bibles.find((a) => a?.attributionRequired)) isEnabled = true
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
        activeDrawerTab.set("templates")
        // closeDrawer()
        // drawerTabsData.update(a => {
        //     a.template.activeSubTab = "all"
        //     return a
        // })
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")
    }

    $: containsJesusWords = Object.values(bibles?.[0]?.verses || {})?.find((text: any) => text?.includes('<span class="wj"') || text?.includes("<red") || text?.includes("!{"))

    $: previousSlides = "{}"
    let currentOutputSlides: any[] = []
    $: if (slides?.[0] && JSON.stringify(slides[0]) !== previousSlides) {
        currentOutputSlides = slides[0]
        previousSlides = JSON.stringify(slides[0])
    }

    $: styleId = $outputs[getActiveOutputs()[0]]?.style || ""
    $: background = $templates[templateId]?.settings?.backgroundColor || $styles[styleId]?.background || "#000000"

    $: attributionString = [...new Set(bibles.map((a) => a?.attributionString).filter(Boolean))].join(" / ")

    let longVersesMenuOpened = false
    let verseMenuOpened = false
    let redMenuOpened = false
    let referenceMenuOpened = false
</script>

<div class="scroll split">
    <Zoomed style="width: 100%;" {background}>
        {#if bibles[0]?.activeVerses}
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
            <MaterialPopupButton label="info.template" value={templateId} name={$templates[templateId]?.name} popupId="select_template" icon="templates" on:change={(e) => update("template", e.detail)} allowEmpty={!isDefault} />
            {#if templateId && $templates[templateId]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={editTemplate} />
            {/if}
        </InputRow>

        <!-- {#if $scriptureSettings.versesOnIndividualLines || sorted.length > 1} -->
        <MaterialToggleSwitch label="scripture.verses_on_individual_lines" checked={$scriptureSettings.versesOnIndividualLines} defaultValue={false} on:change={(e) => update("versesOnIndividualLines", e.detail)} />
        <!-- {/if} -->

        <!-- Long verses -->
        <InputRow arrow={$scriptureSettings.splitLongVerses} bind:open={longVersesMenuOpened}>
            <MaterialToggleSwitch label="scripture.divide_long_verses" style="width: 100%;" checked={$scriptureSettings.splitLongVerses} defaultValue={false} on:change={(e) => update("splitLongVerses", e.detail)} />
        </InputRow>
        {#if $scriptureSettings.splitLongVerses && longVersesMenuOpened}
            <MaterialNumberInput label="edit.size" value={$scriptureSettings.longVersesChars || 100} defaultValue={100} min={50} on:change={(e) => update("longVersesChars", e.detail)} />
        {/if}

        <!-- Verse numbers -->
        <InputRow arrow={$scriptureSettings.verseNumbers} bind:open={verseMenuOpened}>
            <MaterialToggleSwitch label="scripture.verse_numbers" style="width: 100%;" checked={$scriptureSettings.verseNumbers} defaultValue={false} on:change={(e) => update("verseNumbers", e.detail)} />
        </InputRow>
        {#if $scriptureSettings.verseNumbers && verseMenuOpened}
            <MaterialColorInput label="edit.color" value={$scriptureSettings.numberColor || "#919191"} defaultValue="#919191" on:change={(e) => update("numberColor", e.detail)} />
            <MaterialNumberInput label="edit.size (%)" value={$scriptureSettings.numberSize || 50} defaultValue={50} on:change={(e) => update("numberSize", e.detail)} />
        {/if}

        <!-- Red Jesus -->
        {#if $scriptureSettings.redJesus || containsJesusWords}
            <InputRow arrow={$scriptureSettings.redJesus} bind:open={redMenuOpened}>
                <MaterialToggleSwitch label="scripture.red_jesus" style="width: 100%;" checked={$scriptureSettings.redJesus} defaultValue={false} on:change={(e) => update("redJesus", e.detail)} />
            </InputRow>
        {/if}
        {#if $scriptureSettings.redJesus && redMenuOpened}
            <MaterialColorInput label="edit.color" value={$scriptureSettings.jesusColor || "#FF4136"} defaultValue="#FF4136" on:change={(e) => update("jesusColor", e.detail)} />
        {/if}

        <!-- Reference options -->
        <InputRow style="margin-top: 10px;" arrow bind:open={referenceMenuOpened}>
            <MaterialToggleSwitch label="scripture.reference" style="width: 100%;" checked={$scriptureSettings.showVerse} defaultValue={true} on:change={(e) => update("showVerse", e.detail)} />
        </InputRow>
        <InputRow arrow bind:open={referenceMenuOpened}>
            <MaterialToggleSwitch label="scripture.version" disabled={!!bibles.find((a) => a?.attributionRequired)} style="width: 100%;" checked={showVersion} defaultValue={false} on:change={(e) => update("showVersion", e.detail)} />
        </InputRow>

        {#if referenceMenuOpened}
            {#if showVersion || (showVersion && $scriptureSettings.showVerse) || ($scriptureSettings.showVerse && customText.trim() !== "[reference]")}
                <MaterialTextarea label="tools.layout" value={customText} rows={2} on:change={(e) => update("customText", e.detail)} />
            {/if}

            <!-- {#if $scriptureSettings.showVerse}
                <CombinedInput>
                    <p><T id="meta.text_divider" /></p>
                    <TextInput value={$scriptureSettings.referenceDivider || ":"} on:change={(e) => update("referenceDivider", getTextValue(e))} />
                </CombinedInput>
            {/if} -->

            {#if showVersion || $scriptureSettings.showVerse}
                <!-- {#if !$scriptureSettings.firstSlideReference} -->
                <MaterialToggleSwitch label="scripture.combine_with_text" checked={$scriptureSettings.combineWithText} defaultValue={false} on:change={(e) => update("combineWithText", e.detail)} />
                {#if $scriptureSettings.combineWithText}
                    <MaterialToggleSwitch label="scripture.reference_at_bottom" checked={$scriptureSettings.referenceAtBottom} defaultValue={false} on:change={(e) => update("referenceAtBottom", e.detail)} />
                {/if}
                <!-- {/if} -->

                <!-- <br /> -->
                <!-- WIP Unwanted: -->
                {#if !$scriptureSettings.combineWithText}
                    <MaterialToggleSwitch label="edit.invert_items" checked={$scriptureSettings.invertItems} defaultValue={false} on:change={(e) => update("invertItems", e.detail)} />
                {/if}
            {/if}
        {/if}
    </div>
</div>

<Button
    on:click={(e) => {
        const preventPopup = e.ctrlKey || e.metaKey
        createShow(preventPopup, e.altKey)
    }}
    style="width: 100%;"
    disabled={!verseRange}
    dark
    center
>
    <Icon id="slide" right />
    <T id="new.show_convert" />
    <!-- {#if slides.length > 1}
        <span style="opacity: 0.5;margin-inline-start: 0.5em;">({slides.length})</span>
    {/if} -->
</Button>

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

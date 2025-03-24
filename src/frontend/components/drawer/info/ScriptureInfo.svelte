<script lang="ts">
    import { uid } from "uid"
    import type { Bible } from "../../../../types/Scripture"
    import type { Item, Show } from "../../../../types/Show"
    import { ShowObj } from "../../../classes/Show"
    import { activePopup, activeProject, activeTriggerFunction, categories, dictionary, drawerTabsData, media, outLocked, outputs, playScripture, popupData, scriptureHistory, scriptures, scriptureSettings, styles, templates } from "../../../stores"
    import { trackScriptureUsage } from "../../../utils/analytics"
    import { customActionActivation } from "../../actions/actions"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, removeDuplicates } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { checkName } from "../../helpers/show"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Media from "../../output/layers/Media.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getShortBibleName, getSlides, joinRange, textKeys } from "../bible/scripture"

    export let bibles: Bible[]
    $: sorted = bibles[0]?.activeVerses?.sort((a, b) => Number(a) - Number(b)) || []

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
    function checkTemplate() {
        if (!templateId.includes("scripture")) return

        let newTemplateId = "scripture_" + bibles.length
        scriptureSettings.update((a) => {
            a.template = $templates[newTemplateId] ? newTemplateId : "scripture"
            return a
        })
    }

    $: {
        if (sorted.length || $scriptureSettings) slides = getSlides({ bibles, sorted }, true)
        else slides = [[]]
    }

    $: if ($activeTriggerFunction === "scripture_newShow") createShow()
    $: if ($activeTriggerFunction === "scripture_newShow_popup") createShow(true)
    function createShow(noPopup: boolean = false, showPopup: boolean = false) {
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
        if (sorted.length || $scriptureSettings) slides = getSlides({ bibles, sorted })

        let books = removeDuplicates(bibles.map((a) => a.book)).join(" / ")

        // create first slide reference
        if ($scriptureSettings.firstSlideReference && slides[0]?.[0]?.lines?.[0]?.text?.[0]) {
            const slideClone = clone(slides[0])
            // remove reference item
            // slides.forEach((a) => a.splice(a.length - 1, 1))
            // get verse text for correct styling
            const metaStyle = slideClone.at(-2)
            if (metaStyle) slides = [[metaStyle], ...slides]
            // only keep one line/text item (not verse number)
            slides[0][0].lines = [slides[0][0].lines![0]]
            slides[0][0].lines![0].text = [slides[0][0].lines![0].text[1] || slides[0][0].lines![0].text[0]]
            // set verse text to reference
            slides[0][0].lines![0].text[0].value = slideClone.at(-1)?.lines?.[0].text?.[0].value || ""
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

        let layoutID = uid()
        // only set template if not combined (because it might be a custom reference style on first line)
        let template = $scriptureSettings.combineWithText ? false : $scriptureSettings.template || false
        // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
        let show: Show = new ShowObj(false, "scripture", layoutID, new Date().getTime(), $scriptureSettings.verseNumbers ? false : template)
        // add scripture category
        if (!$categories.scripture) {
            categories.update((a) => {
                a.scripture = { name: "category.scripture", icon: "scripture", default: true, isArchive: true }
                return a
            })
        }

        Object.keys(bibles[0].metadata || {}).forEach((key) => {
            if (key.startsWith("@")) return
            if (typeof bibles[0].metadata?.[key] === "string") show.meta[key] = bibles[0].metadata[key]
        })
        if (bibles[0].copyright) show.meta.copyright = bibles[0].copyright

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
                api: bibles[0].api,
                book: bibles[0].bookId ?? bibles[0].book,
                chapter: bibles[0].chapter,
                verses: bibles[0].activeVerses,
            },
        }

        // WIP add template background?

        return { show }
    }

    const checked = (e: any) => {
        let val = e.target.checked
        let id = e.target.id
        update(id, val)

        // if (id === "splitLongVerses") longVersesMenuOpened = val
        if (id === "verseNumbers") verseMenuOpened = val
        if (id === "redJesus") redMenuOpened = val
        if (id === "showVerse" || id === "showVersion") referenceMenuOpened = showVersion || $scriptureSettings.showVerse ? (val ? true : referenceMenuOpened) : false
    }

    function update(id: string, value: any) {
        scriptureSettings.update((a) => {
            a[id] = value
            return a
        })

        if (Object.keys(textKeys).includes(id)) updateCustomText(id, value)
    }

    function showVerse() {
        if ($outLocked || !bibles[0]) return

        // add to scripture history
        scriptureHistory.update((a) => {
            let newItem = {
                id: bibles[0].id,
                book: bibles[0].bookId,
                chapter: bibles[0].api ? bibles[0].chapter : Number(bibles[0].chapter) - 1,
                verse: sorted[0],
                reference: `${bibles[0].book} ${bibles[0].chapter}:${sorted[0]}`,
                text: bibles[0].verses[sorted[0]],
            }
            // WIP multiple verses, play from another version

            let existingIndex = a.findIndex((a) => JSON.stringify(a) === JSON.stringify(newItem))
            if (existingIndex > -1) a.splice(existingIndex, 1)
            a.push(newItem)

            return a
        })

        let outputIsScripture = $outputs[getActiveOutputs()[0]]?.out?.slide?.id === "temp"
        if (!outputIsScripture) customActionActivation("scripture_start")

        let tempItems: Item[] = slides[0] || []
        setOutput("slide", { id: "temp", tempItems, attributionString, translations: bibles.length })

        // track
        let reference = `${bibles[0].book} ${bibles[0].chapter}:${verseRange}`
        bibles.forEach((translation) => {
            let name = translation.version || ""
            let apiId = translation.api ? $scriptures[translation.id!]?.id || translation.id || "" : null
            if (name || apiId) trackScriptureUsage(name, apiId, reference)
        })

        // play template background
        if (!templateBackground) return

        // get style (for media "fit")
        let currentOutput = $outputs[getActiveOutputs()[0]]
        let currentStyle = $styles[currentOutput?.style || ""] || {}

        let mediaStyle = getMediaStyle($media[templateBackground], currentStyle)
        setOutput("background", { path: templateBackground, loop: true, muted: true, ...mediaStyle })
    }

    $: if ($playScripture) {
        showVerse()
        playScripture.set(false)
    }

    // show on enter
    function keydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return
        if (e.target?.closest(".search")) {
            showVerse()
            return
        }

        if (!e.ctrlKey && !e.metaKey) return
        if (e.target?.closest("input") || e.target?.closest(".edit")) return

        showVerse()
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

    // let longVersesMenuOpened: boolean = false
    let verseMenuOpened: boolean = false
    let redMenuOpened: boolean = false
    let referenceMenuOpened: boolean = false
</script>

<svelte:window on:keydown={keydown} />

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
        <CombinedInput style="border-bottom: 4px solid var(--primary-lighter);">
            <p><T id="info.template" /></p>
            <Button
                on:click={() => {
                    popupData.set({ action: "select_template", active: templateId, trigger: (id) => update("template", id) })
                    activePopup.set("select_template")
                }}
                style="overflow: hidden;"
                bold={false}
            >
                <div style="display: flex;align-items: center;padding: 0;">
                    <Icon id="templates" />
                    <p>{$templates[templateId]?.name || "popup.select_template"}</p>
                </div>
            </Button>
            {#if !templateId.includes("scripture")}
                <Button title={$dictionary.actions?.remove} on:click={() => update("template", "")} redHover>
                    <Icon id="close" size={1.2} white />
                </Button>
            {/if}
        </CombinedInput>

        <!-- {#if $scriptureSettings.versesOnIndividualLines || sorted.length > 1} -->
        <CombinedInput>
            <p style="flex: 1;"><T id="scripture.verses_on_individual_lines" /></p>
            <div class="alignRight">
                <Checkbox id="versesOnIndividualLines" checked={$scriptureSettings.versesOnIndividualLines} on:change={checked} />
            </div>
        </CombinedInput>
        <!-- {/if} -->

        <!-- Long verses -->
        <!-- <CombinedInput>
            <p style="flex: 1;"><T id="scripture.divide_long_verses" /></p>
            <div class="alignRight">
                <Checkbox id="splitLongVerses" checked={$scriptureSettings.splitLongVerses} on:change={checked} />
            </div>
            {#if $scriptureSettings.splitLongVerses}
                <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (longVersesMenuOpened = !longVersesMenuOpened)}>
                    {#if longVersesMenuOpened}
                        <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                    {:else}
                        <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                    {/if}
                </Button>
            {/if}
        </CombinedInput>
        {#if $scriptureSettings.splitLongVerses && longVersesMenuOpened}
            <CombinedInput style="border-bottom: 4px solid var(--primary-lighter);">
                <p><T id="edit.size" /></p>
                <NumberInput value={$scriptureSettings.longVersesChars || 100} min={50} on:change={(e) => update("longVersesChars", e.detail)} />
            </CombinedInput>
        {/if} -->

        <!-- Verse numbers -->
        <CombinedInput>
            <p style="flex: 1;"><T id="scripture.verse_numbers" /></p>
            <div class="alignRight">
                <Checkbox id="verseNumbers" checked={$scriptureSettings.verseNumbers} on:change={checked} />
            </div>
            {#if $scriptureSettings.verseNumbers}
                <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (verseMenuOpened = !verseMenuOpened)}>
                    {#if verseMenuOpened}
                        <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                    {:else}
                        <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                    {/if}
                </Button>
            {/if}
        </CombinedInput>
        {#if $scriptureSettings.verseNumbers && verseMenuOpened}
            <CombinedInput>
                <p><T id="edit.color" /></p>
                <Color height={20} width={50} value={$scriptureSettings.numberColor || "#919191"} on:input={(e) => update("numberColor", e.detail)} />
            </CombinedInput>
            <CombinedInput>
                <p><T id="edit.size" /></p>
                <NumberInput value={$scriptureSettings.numberSize || 50} on:change={(e) => update("numberSize", e.detail)} />
            </CombinedInput>
        {/if}

        <!-- Red Jesus -->
        {#if $scriptureSettings.redJesus || containsJesusWords}
            <CombinedInput style="border-top: 2px solid var(--primary-lighter);">
                <p style="flex: 1;"><T id="scripture.red_jesus" /></p>
                <div class="alignRight">
                    <Checkbox id="redJesus" checked={$scriptureSettings.redJesus} on:change={checked} />
                </div>
                {#if $scriptureSettings.redJesus}
                    <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (redMenuOpened = !redMenuOpened)}>
                        {#if redMenuOpened}
                            <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                        {:else}
                            <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                        {/if}
                    </Button>
                {/if}
            </CombinedInput>
        {/if}
        {#if $scriptureSettings.redJesus && redMenuOpened}
            <CombinedInput>
                <p><T id="edit.color" /></p>
                <Color height={20} width={50} value={$scriptureSettings.jesusColor || "#FF4136"} on:input={(e) => update("jesusColor", e.detail)} />
            </CombinedInput>
        {/if}

        <!-- Reference options -->
        <CombinedInput style="border-top: 2px solid var(--primary-lighter);">
            <p style="flex: 1;"><T id="scripture.reference" /></p>
            <div class="alignRight">
                <Checkbox id="showVerse" checked={$scriptureSettings.showVerse} on:change={checked} />
            </div>
            {#if $scriptureSettings.showVerse}
                <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (referenceMenuOpened = !referenceMenuOpened)}>
                    {#if referenceMenuOpened}
                        <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                    {:else}
                        <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                    {/if}
                </Button>
            {/if}
        </CombinedInput>
        <CombinedInput style={referenceMenuOpened ? "border-bottom: 4px solid var(--primary-lighter);" : ""}>
            <p style="flex: 1;"><T id="scripture.version" /></p>
            <div class="alignRight">
                <Checkbox disabled={bibles.find((a) => a?.attributionRequired)} id="showVersion" checked={showVersion} on:change={checked} />
            </div>
            {#if showVersion}
                <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (referenceMenuOpened = !referenceMenuOpened)}>
                    {#if referenceMenuOpened}
                        <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                    {:else}
                        <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                    {/if}
                </Button>
            {/if}
        </CombinedInput>

        {#if referenceMenuOpened}
            {#if showVersion || (showVersion && $scriptureSettings.showVerse) || ($scriptureSettings.showVerse && customText.trim() !== "[reference]")}
                <CombinedInput>
                    <Notes lines={2} value={customText} on:change={(e) => update("customText", e.detail)} />
                </CombinedInput>
            {/if}

            {#if showVersion || $scriptureSettings.showVerse}
                <!-- {#if !$scriptureSettings.firstSlideReference} -->
                <CombinedInput>
                    <p style="flex: 1;"><T id="scripture.combine_with_text" /></p>
                    <div class="alignRight">
                        <Checkbox id="combineWithText" checked={$scriptureSettings.combineWithText} on:change={checked} />
                    </div>
                </CombinedInput>
                {#if $scriptureSettings.combineWithText}
                    <CombinedInput>
                        <p style="flex: 1;"><T id="scripture.reference_at_bottom" /></p>
                        <div class="alignRight">
                            <Checkbox id="referenceAtBottom" checked={$scriptureSettings.referenceAtBottom} on:change={checked} />
                        </div>
                    </CombinedInput>
                {/if}
                <!-- {/if} -->

                <!-- <br /> -->
                <!-- WIP Unwanted: -->
                {#if !$scriptureSettings.combineWithText}
                    <CombinedInput>
                        <p style="flex: 1;"><T id="edit.invert_items" /></p>
                        <div class="alignRight">
                            <Checkbox id="invertItems" checked={$scriptureSettings.invertItems} on:change={checked} />
                        </div>
                    </CombinedInput>
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
        <span style="opacity: 0.5;margin-left: 0.5em;">({slides.length})</span>
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
        right: 0;
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

    .alignRight {
        flex: 0 !important;
        padding: 0 10px;
    }
</style>

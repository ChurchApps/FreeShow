<script lang="ts">
    import { uid } from "uid"
    import type { Bible } from "../../../../types/Scripture"
    import type { Item, Show } from "../../../../types/Show"
    import { ShowObj } from "../../../classes/Show"
    import { activeProject, activeTriggerFunction, categories, drawerTabsData, media, outLocked, outputs, playScripture, scriptureHistory, scriptureSettings, styles, templates } from "../../../stores"
    import { customActionActivation } from "../../actions/actions"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, removeDuplicates, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { checkName } from "../../helpers/show"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
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
    $: template = $templates[$scriptureSettings.template] || {}
    $: templateBackground = template.settings?.backgroundPath

    $: if ($drawerTabsData) setTimeout(checkTemplate, 100)
    function checkTemplate() {
        if (!$scriptureSettings.template?.includes("scripture")) return

        let templateId = "scripture_" + bibles.length
        scriptureSettings.update((a) => {
            a.template = $templates[templateId] ? templateId : "scripture"
            return a
        })
    }

    $: {
        if (sorted.length || $scriptureSettings) slides = getSlides({ bibles, sorted })
        else slides = [[]]
    }

    $: if ($activeTriggerFunction === "scripture_newShow") createShow()
    function createShow() {
        if (verseRange) {
            let { show } = createSlides()
            if (!show) return
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }
    }

    function createSlides() {
        if (!bibles[0]) return { show: null }

        let books = removeDuplicates(bibles.map((a) => a.book)).join(" / ")

        // create first slide reference
        if ($scriptureSettings.firstSlideReference) {
            const slideClone = clone(slides[0])
            slides.forEach((a) => a.splice(a.length - 1, 1))
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
        // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
        let show: Show = new ShowObj(false, "scripture", layoutID, new Date().getTime(), $scriptureSettings.verseNumbers ? false : $scriptureSettings.template || false)
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
            data: { collection: $drawerTabsData.scripture?.activeSubTab || bibles[0].id || "", version: versions, api: bibles[0].api, book: bibles[0].bookId ?? bibles[0].book, chapter: bibles[0].chapter, verses: bibles[0].activeVerses },
        }

        // WIP add template background?

        return { show }
    }

    const checked = (e: any) => {
        let val = e.target.checked
        let id = e.target.id
        update(id, val)
    }

    let templateList: any[] = []
    $: templateList = sortByName(Object.entries($templates).map(([id, template]: any) => ({ id, name: template.name })))

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
        setOutput("slide", { id: "temp", tempItems })

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
    function keydown(e: any) {
        if (e.key !== "Enter") return
        if (e.target.closest(".search")) {
            showVerse()
            return
        }

        if (!e.ctrlKey && !e.metaKey) return
        if (e.target.closest("input") || e.target.closest(".edit")) return

        showVerse()
    }

    // custom text
    $: customText = $scriptureSettings.customText || getDefaultText()
    function getDefaultText() {
        let text = ""

        Object.keys(textKeys).forEach((key) => {
            if ($scriptureSettings[key]) {
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
    $: if (JSON.stringify(slides[0]) !== previousSlides) {
        currentOutputSlides = slides[0]
        previousSlides = JSON.stringify(slides[0])
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll">
    <Zoomed style="width: 100%;">
        {#if bibles[0]?.activeVerses}
            {#if templateBackground}
                <Media path={templateBackground} videoData={{ paused: false, muted: true, loop: true }} mirror />
            {/if}

            {#key currentOutputSlides}
                {#each currentOutputSlides as item}
                    <Textbox {item} ref={{ id: "scripture" }} />
                {/each}
            {/key}
        {/if}
    </Zoomed>

    <!-- settings -->
    <div class="settings">
        <CombinedInput>
            <p><T id="info.template" /></p>
            <Dropdown options={templateList} value={$templates[$scriptureSettings.template]?.name || "—"} on:click={(e) => update("template", e.detail.id)} />
        </CombinedInput>

        {#if $scriptureSettings.versesPerSlide != 3 || sorted.length > 1}
            <CombinedInput textWidth={70}>
                <p><T id="scripture.max_verses" /></p>
                <NumberInput value={$scriptureSettings.versesPerSlide} min={1} max={100} on:change={(e) => update("versesPerSlide", e.detail)} buttons={false} />
            </CombinedInput>
        {/if}
        {#if $scriptureSettings.versesOnIndividualLines || (sorted.length > 1 && $scriptureSettings.versesPerSlide > 1)}
            <CombinedInput textWidth={70}>
                <p><T id="scripture.verses_on_individual_lines" /></p>
                <div class="alignRight">
                    <Checkbox id="versesOnIndividualLines" checked={$scriptureSettings.versesOnIndividualLines} on:change={checked} />
                </div>
            </CombinedInput>
        {/if}

        <CombinedInput textWidth={70}>
            <p><T id="scripture.verse_numbers" /></p>
            <div class="alignRight">
                <Checkbox id="verseNumbers" checked={$scriptureSettings.verseNumbers} on:change={checked} />
            </div>
        </CombinedInput>
        {#if $scriptureSettings.verseNumbers}
            <CombinedInput>
                <p><T id="edit.color" /></p>
                <Color height={20} width={50} value={$scriptureSettings.numberColor || "#919191"} on:input={(e) => update("numberColor", e.detail)} />
            </CombinedInput>
            <CombinedInput>
                <p><T id="edit.size" /></p>
                <NumberInput value={$scriptureSettings.numberSize || 50} on:change={(e) => update("numberSize", e.detail)} />
            </CombinedInput>
        {/if}

        {#if $scriptureSettings.redJesus || containsJesusWords}
            <CombinedInput textWidth={70}>
                <p><T id="scripture.red_jesus" /></p>
                <div class="alignRight">
                    <Checkbox id="redJesus" checked={$scriptureSettings.redJesus} on:change={checked} />
                </div>
            </CombinedInput>
        {/if}
        {#if $scriptureSettings.redJesus}
            <CombinedInput>
                <p><T id="edit.color" /></p>
                <Color height={20} width={50} value={$scriptureSettings.jesusColor || "#FF4136"} on:input={(e) => update("jesusColor", e.detail)} />
            </CombinedInput>
        {/if}

        <br />

        <CombinedInput textWidth={70}>
            <p><T id="scripture.reference" /></p>
            <div class="alignRight">
                <Checkbox id="showVerse" checked={$scriptureSettings.showVerse} on:change={checked} />
            </div>
        </CombinedInput>
        {#if $scriptureSettings.showVerse && !$scriptureSettings.firstSlideReference && sorted.length > 1}
            <CombinedInput textWidth={70}>
                <p><T id="scripture.split_reference" /></p>
                <div class="alignRight">
                    <Checkbox id="splitReference" checked={$scriptureSettings.splitReference !== false} on:change={checked} />
                </div>
            </CombinedInput>
        {/if}
        <CombinedInput textWidth={70}>
            <p><T id="scripture.version" /></p>
            <div class="alignRight">
                <Checkbox id="showVersion" checked={$scriptureSettings.showVersion} on:change={checked} />
            </div>
        </CombinedInput>

        {#if $scriptureSettings.showVersion || ($scriptureSettings.showVersion && $scriptureSettings.showVerse) || ($scriptureSettings.showVerse && customText.trim() !== "[reference]")}
            <CombinedInput>
                <Notes lines={2} value={customText} on:change={(e) => update("customText", e.detail)} />
            </CombinedInput>
        {/if}

        {#if $scriptureSettings.showVersion || $scriptureSettings.showVerse}
            {#if !$scriptureSettings.firstSlideReference}
                <CombinedInput textWidth={70}>
                    <p><T id="scripture.combine_with_text" /></p>
                    <div class="alignRight">
                        <Checkbox id="combineWithText" checked={$scriptureSettings.combineWithText} on:change={checked} />
                    </div>
                </CombinedInput>
                {#if $scriptureSettings.combineWithText}
                    <CombinedInput textWidth={70}>
                        <p><T id="scripture.reference_at_bottom" /></p>
                        <div class="alignRight">
                            <Checkbox id="referenceAtBottom" checked={$scriptureSettings.referenceAtBottom} on:change={checked} />
                        </div>
                    </CombinedInput>
                {/if}
            {/if}

            {#if !$scriptureSettings.combineWithText}
                <CombinedInput textWidth={70}>
                    <p><T id="scripture.first_slide_reference" /></p>
                    <div class="alignRight">
                        <Checkbox id="firstSlideReference" checked={$scriptureSettings.firstSlideReference} on:change={checked} />
                    </div>
                </CombinedInput>
            {/if}
        {/if}
    </div>
</div>

<Button on:click={createShow} style="width: 100%;" disabled={!verseRange} dark center>
    <Icon id="slide" right />
    <T id="new.show" />
    {#if slides.length > 1}
        <span style="opacity: 0.5;margin-left: 0.5em;">({slides.length})</span>
    {/if}
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
    }

    .settings :global(.dropdown) {
        /* position: absolute; */
        width: 160%;
        right: 0;
    }
</style>

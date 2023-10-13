<script lang="ts">
    import { uid } from "uid"
    import type { Bible } from "../../../../types/Scripture"
    import type { Item, Show } from "../../../../types/Show"
    import { ShowObj } from "../../../classes/Show"
    import { activeProject, categories, drawerTabsData, outLocked, playScripture, scriptureSettings, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { setOutput } from "../../helpers/output"
    import { checkName } from "../../helpers/show"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getSlides, joinRange, textKeys } from "../bible/scripture"

    export let bibles: Bible[]
    $: sorted = bibles[0]?.activeVerses?.sort((a, b) => Number(a) - Number(b)) || []

    let verseRange = ""
    $: {
        if (sorted.length) verseRange = joinRange(sorted)
        else verseRange = ""
    }

    // settings
    // let verseNumbers: boolean = false
    // let versesPerSlide: number = 3
    // let showVersion: boolean = false
    // let showVerse: boolean = true
    // let redJesus: boolean = false // red jesus words

    let slides: Item[][] = [[]]
    // let slides: any = {}
    // let values: any[][] = []
    // let itemStyle = "top: 150px;left: 50px;width: " + (resolution.width - 100) + "px;height: " + (resolution.height - 300) + "px;"

    $: if ($drawerTabsData) setTimeout(checkTemplate, 100)
    function checkTemplate() {
        if (!$scriptureSettings.template?.includes("scripture")) return

        let templateId = "scripture_" + bibles.length
        scriptureSettings.update((a) => {
            a.template = $templates[templateId] ? templateId : "scripture"
            return a
        })
    }

    // $: template = $templates[$scriptureSettings.template]?.items || []
    $: {
        if (sorted.length || $scriptureSettings) slides = getSlides({ bibles, sorted })
        else slides = [[]]
    }

    function createShow() {
        if (verseRange) {
            let { show } = createSlides()
            if (!show) return
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }
    }

    function createSlides() {
        if (!bibles[0]) return { show: null }

        let slides2: any = {}
        let layouts: any[] = []
        slides.forEach((items: any) => {
            let id = uid()
            // TODO: group as verse numbers
            let firstTextItem = items.find((a) => a.lines)
            slides2[id] = { group: firstTextItem?.lines?.[0]?.text?.[0]?.value?.split(" ")?.slice(0, 4)?.join(" ")?.trim() || "", color: null, settings: {}, notes: "", items }
            let l: any = { id }
            layouts.push(l)
        })

        let layoutID = uid()
        // TODO: private!!!?
        let show: Show = new ShowObj(false, "scripture", layoutID, new Date().getTime(), $scriptureSettings.template || false)
        // add scripture category
        if (!$categories.scripture) {
            categories.update((a) => {
                a.scripture = { name: "category.scripture", icon: "scripture", default: true }
                return a
            })
        }

        // TODO: if name exists create new layout!!
        // TODO: keep same chapter on same show (just add new layouts...?)
        show.name = checkName(bibles[0].book + " " + bibles[0].chapter + "," + verseRange)
        show.slides = slides2
        show.layouts = { [layoutID]: { name: bibles[0].version || "", notes: "", slides: layouts } }

        let versions = bibles.map((a) => a.version).join(" + ")
        show.reference = {
            type: "scripture",
            data: { collection: $drawerTabsData.scripture?.activeSubTab || bibles[0].id || "", version: versions, api: bibles[0].api, book: bibles[0].bookId || bibles[0].book, chapter: bibles[0].chapter, verses: bibles[0].activeVerses },
        }

        return { show }
    }

    const checked = (e: any) => {
        let val = e.target.checked
        let id = e.target.id
        update(id, val)
    }

    let templateList: any[] = []
    // TODO: sort by name
    $: templateList = Object.entries($templates).map(([id, template]: any) => ({ id, name: template.name }))

    function update(id: string, value: any) {
        scriptureSettings.update((a) => {
            a[id] = value
            return a
        })

        if (Object.keys(textKeys).includes(id)) updateCustomText(id, value)
    }

    function showVerse() {
        if ($outLocked) return

        let tempItems: Item[] = slides[0] || []
        setOutput("slide", { id: "temp", tempItems })
    }

    $: if ($playScripture) {
        showVerse()
        playScripture.set(false)
    }
    // $: if (verseRange && $outputs[getActiveOutputs()[0]]?.out?.slide?.id === "temp") showVerse()

    // show on enter
    function keydown(e: any) {
        if (e.key !== "Enter" || (!e.ctrlKey && !e.metaKey)) return
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
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll">
    <Zoomed style="width: 100%;">
        {#if bibles[0]?.activeVerses}
            <!-- {#each slides as items} -->
            {#each slides[0] as item}
                <Textbox {item} ref={{ id: "scripture" }} />
            {/each}
            <!-- {/each} -->
        {/if}
    </Zoomed>

    <!-- TODO: drag&drop slide(s) -->

    <!-- settings: red jw, verse numbers, verse break, max verses per slide, show version, show book&chapter&verse, text formatting -->
    <!-- settings -->
    <div class="settings">
        <CombinedInput textWidth={70}>
            <p><T id="info.template" /></p>
            <Dropdown options={templateList} value={$templates[$scriptureSettings.template]?.name || "—"} on:click={(e) => update("template", e.detail.id)} style="width: 30%;" />
        </CombinedInput>
        <CombinedInput textWidth={70}>
            <p><T id="scripture.max_verses" /></p>
            <NumberInput value={$scriptureSettings.versesPerSlide} min={1} max={100} on:change={(e) => update("versesPerSlide", e.detail)} buttons={false} />
        </CombinedInput>
        <CombinedInput textWidth={70}>
            <p><T id="scripture.verse_numbers" /></p>
            <div class="alignRight">
                <Checkbox id="verseNumbers" checked={$scriptureSettings.verseNumbers} on:change={checked} />
            </div>
        </CombinedInput>
        {#if $scriptureSettings.verseNumbers}
            <CombinedInput textWidth={70}>
                <p><T id="edit.color" /></p>
                <Color height={20} width={50} value={$scriptureSettings.numberColor || "#919191"} on:input={(e) => update("numberColor", e.detail)} />
            </CombinedInput>
        {/if}
        <CombinedInput textWidth={70}>
            <p><T id="scripture.version" /></p>
            <div class="alignRight">
                <Checkbox id="showVersion" checked={$scriptureSettings.showVersion} on:change={checked} />
            </div>
        </CombinedInput>
        <CombinedInput textWidth={70}>
            <p><T id="scripture.reference" /></p>
            <div class="alignRight">
                <Checkbox id="showVerse" checked={$scriptureSettings.showVerse} on:change={checked} />
            </div>
        </CombinedInput>
        {#if $scriptureSettings.showVersion || ($scriptureSettings.showVersion && $scriptureSettings.showVerse) || ($scriptureSettings.showVerse && customText.trim() !== "[reference]")}
            <CombinedInput>
                <Notes lines={2} value={customText} on:change={(e) => update("customText", e.detail)} />
            </CombinedInput>
        {/if}
        <!-- <span>
      <p><T id="scripture.red_jesus" /> (WIP)</p>
      <Checkbox id="redJesus" checked={$scriptureSettings.redJesus} on:change={checked} />
    </span> -->
    </div>
</div>

<Button on:click={createShow} style="width: 100%;" disabled={!verseRange} dark center>
    <Icon id="show" right />
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
        position: absolute;
        width: 250% !important;
        transform: translateX(-60%);
    }
</style>

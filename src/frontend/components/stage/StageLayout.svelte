<script lang="ts">
    import { onDestroy, setContext } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import { activePage, activeStage, allOutputs, currentOutputSettings, currentWindow, outputs, settingsTab, stageShows, toggleOutputEnabled } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { send } from "../../utils/request"
    import { getSortedStageItems, shouldItemBeShown } from "../edit/scripts/itemHelpers"
    import { centerZoom } from "../edit/scripts/zoom"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { enableStageOutput, getStageOutputId, getStageResolution } from "../helpers/output"
    import { getStyles } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import Zoomed from "../slide/Zoomed.svelte"
    import Center from "../system/Center.svelte"
    import Snaplines from "../system/Snaplines.svelte"
    import { getSlideTextItems, stageItemToItem, updateStageShow } from "./stage"
    import Stagebox from "./Stagebox.svelte"

    export let outputId = ""
    export let stageId = ""
    export let preview = false
    export let edit = true
    export let disableStagePreview = false

    const profile = getAccess("stage")
    $: readOnly = profile.global === "read" || profile[stageLayoutId || ""] === "read" || profile[stageLayoutId || ""] === "none"

    // item flash
    let layoutMounted = false
    setContext("layoutMounted", () => layoutMounted)
    $: if (stageLayoutId) {
        layoutMounted = false
        setTimeout(() => {
            layoutMounted = true
        }, 100)
    }

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: { [key: string]: number | string } = {}
    $: active = $activeStage.items

    let ratio = 1

    $: {
        if (active.length) {
            if (Object.keys(newStyles).length) setStyles()
        } else newStyles = {}
    }

    function setStyles() {
        let items = $stageShows[$activeStage.id!].items
        let newData: { [key: string]: string } = {}

        active.forEach((id) => {
            let styles = getStyles(items[id].style)
            Object.entries(newStyles).forEach(([key, value]) => (styles[key] = value.toString()))

            let textStyles = ""
            Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

            // TODO: move multiple!
            newData[id] = textStyles
        })

        history({ id: "UPDATE", newData: { data: newData, key: "items", subkey: "style", keys: active }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_position", override: $activeStage.id + active.join("") } })

        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    let timeout: NodeJS.Timeout | null = null

    $: stageLayoutId = stageId || $activeStage.id
    $: layout = $stageShows[stageLayoutId || ""] || {}

    // get video time (pre 1.4.0)
    $: if ($currentWindow === "output" && Object.keys(layout.items || {}).some((id) => id.includes("video"))) requestVideoData()
    let interval: NodeJS.Timeout | null = null
    function requestVideoData() {
        if (interval) return
        interval = setInterval(() => send(OUTPUT, ["MAIN_REQUEST_VIDEO_DATA"], { id: outputId }), 1000) // , stageId
    }

    onDestroy(() => {
        if (interval) clearInterval(interval)
    })

    // RESOLUTION

    let width = 0
    let height = 0
    $: stageOutputId = getStageOutputId($outputs)
    $: resolution = getStageResolution(stageOutputId, $outputs)

    // ACTION BAR

    // ZOOM
    let scrollElem: HTMLDivElement | undefined
    let zoom = 1
    let zoomOrigin: { x: number; y: number } | null = null
    function updateZoom(e: any) {
        zoom = e.detail
        const origin = zoomOrigin
        zoomOrigin = null
        centerZoom(zoom, origin, scrollElem, "")
    }

    $: currentOutput = $outputs[outputId] || $allOutputs[outputId] || {}
    $: backgroundColor = currentOutput.transparent ? "transparent" : layout.settings?.color || "#000000"

    $: stageItems = getSortedStageItems(stageLayoutId, $stageShows)

    // $: videoTime = $videosTime[outputId] || 0
    // { $activeTimers, $variables, $playingAudio, $playingAudioPaths, videoTime }
    let conditionsUpdater = 0
    const updaterInterval = setInterval(() => {
        if (!Array.isArray(stageItems)) return
        if (stageItems.some((a) => a?.conditions)) conditionsUpdater++
    }, 500)
    onDestroy(() => clearInterval(updaterInterval))

    function checkVisibility(itemIndex: number, _updater: any) {
        const item = stageItems[itemIndex]
        return shouldItemBeShown(stageItemToItem(item), item.type === "slide_text" ? getSlideTextItems(layout, item, $outputs || $allOutputs) : [], { type: "stage" })
    }

    // stage output

    $: hasStageOutput = edit && Object.values($outputs).some((a) => a.stageOutput && (a.enabled || a.stageOutput === stageLayoutId))

    function createStageOutput() {
        toggleOutputEnabled.set(true)
        setTimeout(() => {
            let id = enableStageOutput({ stageOutput: stageLayoutId, name: layout?.name || "" })
            currentOutputSettings.set(id)
            settingsTab.set("display_settings")
            activePage.set("settings")
        }, 100)
    }
</script>

<div class="stageArea">
    <!-- <Main slide={stageShowId ? show : null} let:width let:height let:resolution> -->
    <div class="parent" class:noOverflow={zoom >= 1} bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if stageLayoutId}
            <!-- TODO: stage resolution... -->
            <Zoomed background={backgroundColor} style={getStyleResolution(resolution, width, height, "fit", { zoom })} {resolution} id={stageOutputId} bind:ratio isStage disableStyle hideOverflow={!edit} center={zoom >= 1}>
                <!-- TODO: snapping to top left... -->
                {#if edit && !readOnly}
                    <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} isStage />
                {/if}
                {#key stageLayoutId}
                    {#each stageItems as item, index}
                        {#if (item.type || item.enabled !== false) && (edit || checkVisibility(index, conditionsUpdater))}
                            <Stagebox edit={edit && !readOnly} stageLayout={edit ? null : layout} id={item.id} item={clone(item)} {ratio} {preview} {disableStagePreview} bind:mouse />
                        {/if}
                    {/each}
                {/key}
            </Zoomed>
        {:else if edit}
            <Center size={2} faded>
                <T id="empty.layout" />
            </Center>
        {/if}
    </div>
    <!-- </Main> -->

    <!-- <div class="bar">
        <T id="settings.connections" />: {Object.keys($connections.STAGE || {}).length}
    </div> -->

    {#if edit && stageLayoutId}
        {#if !hasStageOutput}
            <FloatingInputs side="left" onlyOne>
                <MaterialButton icon="autofill" title="stage.create_stage_output" on:click={createStageOutput}>
                    <T id="stage.create_stage_output" />
                </MaterialButton>
            </FloatingInputs>
        {/if}

        <FloatingInputs>
            <MaterialZoom columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} on:change={updateZoom} on:origin={(e) => (zoomOrigin = e.detail)} />
        </FloatingInputs>
    {/if}
</div>

<style>
    .stageArea {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        /* overflow: hidden; */
    }

    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* padding: 10px; */
        overflow: auto;
    }

    .parent.noOverflow {
        overflow: hidden;
    }
</style>

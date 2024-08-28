<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { activeStage, currentWindow, stageShows } from "../../stores"
    import { send } from "../../utils/request"
    import { keysToID, sortByName } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getStyles } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import Zoomed from "../slide/Zoomed.svelte"
    import Center from "../system/Center.svelte"
    import Main from "../system/Main.svelte"
    import Snaplines from "../system/Snaplines.svelte"
    import { updateStageShow } from "./stage"
    import Stagebox from "./Stagebox.svelte"

    export let outputId: string = ""
    export let stageId: string = ""
    export let edit: boolean = true

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: any = {}
    $: active = $activeStage.items

    let ratio: number = 1

    $: {
        if (active.length) {
            if (Object.keys(newStyles).length) setStyles()
        } else newStyles = {}
    }

    $: if ($activeStage.id === null && Object.keys($stageShows).length) activeStage.set({ id: sortByName(keysToID($stageShows))[0]?.id, items: [] })

    function setStyles() {
        let items: any = $stageShows[$activeStage.id!].items
        let newData: any = {}

        active.forEach((id) => {
            let styles: any = getStyles(items[id].style)
            Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))

            let textStyles: string = ""
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

    let timeout: any = null

    $: stageShowId = stageId || $activeStage.id
    $: show = $stageShows[stageShowId || ""] || {}

    let noOverflow = true

    // get video time
    $: if ($currentWindow === "output" && Object.keys(show.items || {}).find((id) => id.includes("video"))) requestVideoData()
    let interval: any = null
    function requestVideoData() {
        if (interval) return
        interval = setInterval(() => send(OUTPUT, ["MAIN_REQUEST_VIDEO_DATA"], { id: outputId }), 1000) // , stageId
    }
</script>

<Main slide={stageShowId ? show : null} let:width let:height let:resolution>
    <div class="parent" class:noOverflow>
        {#if stageShowId}
            <!-- TODO: stage resolution... -->
            <Zoomed background={show.settings?.color || "#000000"} style={getStyleResolution(resolution, width, height, "fit")} bind:ratio disableStyle hideOverflow={!edit} center>
                <!-- TODO: snapping to top left... -->
                {#if edit}
                    <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
                {/if}
                <!-- {#key Slide} -->
                {#each Object.entries(show.items || {}) as [id, item]}
                    {#if item.enabled}
                        <Stagebox {edit} show={edit ? null : show} {id} {item} {ratio} bind:mouse />
                    {/if}
                {/each}
                <!-- {/key} -->
            </Zoomed>
        {:else if edit}
            <Center size={2} faded>
                <T id="empty.stage_show" />
            </Center>
        {/if}
    </div>
    <!-- <div class="bar">
        <T id="settings.connections" />: {Object.keys($connections.STAGE || {}).length}
    </div> -->
</Main>

<style>
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

    /* .bar {
        display: flex;
        justify-content: center;
        padding: 2px;
        width: 100%;
        background-color: var(--primary);
        border-top: 2px solid var(--primary-lighter);
    } */
</style>

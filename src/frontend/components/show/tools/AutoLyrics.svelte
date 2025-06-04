<script lang="ts">
    import { onDestroy } from "svelte"
    import type { LearnedSection } from "../../../../types/Show"
    import { activeAutoLyrics, labelsDisabled, showsCache } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { AudioAutoLyrics } from "./autoLyrics"
    // import { autoLyricsRecorder, autoLyricsStartMatching, stopAutoLyricsMatching } from "./autoLyrics"

    export let showId: string

    $: show = $showsCache[showId] || {}
    $: activeLayout = show.settings.activeLayout
    $: showLayout = show.layouts[activeLayout] || {}

    let autoLyricsData: LearnedSection[] | null = null
    $: autoLyricsData = showLayout.autoLyrics || null

    let settingsOpened: boolean = false

    let started: boolean = false
    // let outputListenerUnsubscribe: Unsubscriber | null = null
    let currentSequence: { time: number; slideRef: { id: string; index: any } }[] = []

    $: if (showId) updateData()
    function updateData() {
        aal.loadLearnedData(autoLyricsData || [])
    }

    const aal = new AudioAutoLyrics({
        debugLog: (message, ...args) => console.log(`[AAL DEMO DEBUG] ${message}`, ...args),
        featureBufferSize: 10, // Faster updates for demo
        matchWindowDurationMs: 2000 // Shorter window for demo
    })
    aal.onMatchUpdate = (partName) => {
        console.info(`%c[MATCH UPDATE] Most likely part: ${partName || "---"}`, "color: green; font-weight: bold;")
    }
    aal.onError = (err) => {
        console.error("[AAL DEMO ERROR]", err.message)
        alert("Demo Error: " + err.message)
    }

    async function toggleRecording() {
        if (started) {
            stopRecording()
            return
        }

        currentSequence = []
        started = true

        newToast("$toast.recording_started")

        // LISTEN
        // outputListenerUnsubscribe = await autoLyricsRecorder(showId)

        await aal.startRecording(showId)
    }

    onDestroy(stopRecording)

    function stopRecording() {
        if (!started) {
            aal.stopAllActivityAndReleaseAudio()
            return
        }

        newToast("$toast.recording_stopped")
        started = false
        // if (outputListenerUnsubscribe) outputListenerUnsubscribe()

        const data = aal.stopRecording()
        aal.stopAllActivityAndReleaseAudio()

        // let data = clone($autoLyricsRecording)
        if (!data?.length) return

        console.log("AUTO LYRICS DATA", data)

        let layout = clone(showLayout)
        layout.autoLyrics = data
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })

        // add start recording to first slide in recording
        // addSlideAction(sequence[0].slideRef.index, "start_slide_recording")

        // autoLyricsRecording.set(null)
    }

    function deleteAutoLyrics() {
        aal.clearLearnedData()
        let layout = clone(showLayout)
        delete layout.autoLyrics
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    $: recordingPlaying = getCurrentRecording($activeAutoLyrics)
    function getCurrentRecording(slideRecording) {
        console.log(slideRecording)
        if (!slideRecording) return null
        if (slideRecording.ref?.showId !== showId || slideRecording.ref?.layoutId !== activeLayout) return null

        return slideRecording
    }

    async function startMatching() {
        await aal.startMatching({ showId, layoutId: activeLayout })
    }

    function stopMatching() {
        aal.stopMatching()
    }
</script>

<div class="padding">
    {#if settingsOpened && autoLyricsData}
        <!-- SETTINGS: change microphone input! -->
    {:else if autoLyricsData}
        {#if recordingPlaying}
            <!-- <Button on:click={stopAutoLyricsMatching} dark red center> -->
            <Button on:click={stopMatching} dark red center>
                <Icon id="clear" size={3} right />
                <T id="media.stop" />
            </Button>
        {:else}
            <!-- <Button on:click={() => autoLyricsStartMatching(autoLyricsData, { showId, layoutId: activeLayout })} dark center> -->
            <Button on:click={startMatching} dark center>
                <Icon id="play" size={3} white right />
                <T id="media.play" />
            </Button>
        {/if}
    {:else}
        <Button on:click={toggleRecording} dark center>
            <Icon id={started ? "stop" : "record"} size={3} white={!started || !currentSequence.length} right />
            <T id="actions.{started ? 'stop_recording' : 'start_recording'}" />
        </Button>

        {#if !started}
            <div style="margin-top: 5px;">
                <T id="tooltip.auto_lyrics" />
            </div>
        {/if}
    {/if}
</div>

{#if autoLyricsData}
    <div class="bottom">
        {#if recordingPlaying}
            <!-- WIP continue recording... -->
        {:else}
            {#if settingsOpened}
                <Button style="width: 100%;" on:click={deleteAutoLyrics} dark center>
                    <Icon id="delete" right={!$labelsDisabled} />
                    {#if !$labelsDisabled}<T id="recording.remove" />{/if}
                </Button>
            {/if}

            <Button style="width: 100%;" on:click={() => (settingsOpened = !settingsOpened)} center dark>
                <!-- settings -->
                <Icon id="options" white={settingsOpened} right />
                <T id="edit.options" />
            </Button>
        {/if}
    </div>
{/if}

<style>
    .padding {
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 5px;
        flex: 1;

        overflow-y: auto;
    }
</style>

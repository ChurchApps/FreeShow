<script lang="ts">
    import { uid } from "uid"
    import { Recording } from "../../../../types/Show"
    import { activeSlideRecording, labelsDisabled, outputs, showsCache } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { getGroupName } from "../../helpers/show"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import { playRecording, stopSlideRecording } from "../../helpers/slideRecording"
    import { onDestroy } from "svelte"

    export let showId: string

    $: show = $showsCache[showId] || {}
    $: activeLayout = show.settings.activeLayout
    $: showLayout = show.layouts[activeLayout] || {}
    $: showSlides = show.slides
    $: layoutRef = [_show(showId).layouts("active").ref()[0], show][0]
    $: layoutSequence = layoutRef.map(({ id }) => id).join("")

    let recordingData: Recording | null = null
    $: recordingData = showLayout.recording?.[0] || null

    // check if layout slides has changed
    $: hasChanged = recordingData?.layoutAtRecording !== layoutSequence

    let started: boolean = false
    let outputListenerUnsubscribe: any = null
    let currentSequence: any[] = []
    function toggleRecording() {
        if (started) {
            stopRecording()
            return
        }

        currentSequence = []
        started = true

        // LISTEN
        let firstOutputId = getActiveOutputs()[0]
        outputListenerUnsubscribe = outputs.subscribe((a) => {
            let outSlide: any = a[firstOutputId]?.out?.slide
            // clear output to stop recording
            if (started && currentSequence.length && !outSlide) return stopRecording()
            if (!outSlide || outSlide.layout !== activeLayout) return

            if (!currentSequence.length) newToast("$toast.recording_started")

            let layoutSlide = layoutRef[outSlide.index]
            // if (layoutSlide.parent) layoutSlide = layoutSlide.parent
            let slideRef = { id: layoutSlide?.id, index: outSlide.index }
            if (JSON.stringify(currentSequence[currentSequence.length - 1]?.slideRef || {}) === JSON.stringify(slideRef)) return

            let sequence = { time: Date.now(), slideRef }
            currentSequence.push(sequence)
            currentSequence = currentSequence
        })

        // record clear actions as well?? - I guess slide actions should be used in that case
    }

    onDestroy(stopRecording)

    function stopRecording() {
        if (!started) return

        newToast("$toast.recording_stopped")
        started = false
        if (outputListenerUnsubscribe) outputListenerUnsubscribe()

        if (currentSequence.length < 2) return

        let sequence = currentSequence.map((a, i) => {
            let currentTime = a.time
            let time = (currentSequence[i + 1]?.time || currentTime) - currentTime
            return { ...a, time }
        })

        let currentRecording: Recording = {
            id: uid(5),
            layoutAtRecording: layoutSequence,
            sequence: sequence,
        }

        let layout = clone(showLayout)
        layout.recording = [currentRecording]
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function updateTime(e: any, index: number) {
        let layout = clone(showLayout)
        layout.recording![0].sequence[index].time = Number(e.detail)
        let override = showId + activeLayout + "_recordtime"
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout", override: override } })
    }

    function deleteRecording() {
        let layout = clone(showLayout)
        delete layout.recording
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function groupName({ index }) {
        let layoutSlide = layoutRef[index]
        if (!layoutSlide) return ""

        let childIndex = -1
        if (layoutSlide.parent) {
            childIndex = showSlides[layoutSlide.parent.id]?.children?.findIndex((id) => id === layoutSlide.id) ?? -1
            layoutSlide = layoutSlide.parent
        }

        let name = getGroupName({ show, showId }, layoutSlide.id, showSlides[layoutSlide.id]?.group, layoutSlide.layoutIndex) || "—"
        if (childIndex > -1) name += ` - ${childIndex + 1}`
        return name
    }

    $: recordingPlaying = getCurrentRecording($activeSlideRecording)
    function getCurrentRecording(slideRecording) {
        if (!slideRecording) return null
        if (slideRecording.ref.showId !== showId || slideRecording.ref.layoutId !== activeLayout) return null

        return slideRecording
    }

    let animate = false
    $: if (recordingPlaying) startTimebar()
    function startTimebar() {
        animate = false
        setTimeout(() => {
            animate = true
        })
    }

    $: syncedWithAudio = getFirstSlideAudio(recordingData, layoutRef)
    function getFirstSlideAudio(data, layout) {
        let ref = data?.sequence?.[0]?.slideRef
        if (!ref || !layout.length) return

        let layoutData = layout[ref.index]?.data || {}
        return layoutData.audio?.[0]
    }
</script>

<div class="padding">
    {#if recordingData}
        {#if recordingPlaying}
            <Button on:click={stopSlideRecording} dark red center>
                <Icon id="clear" size={3} right />
                <T id="media.stop" />
            </Button>
        {:else}
            <Button on:click={() => playRecording(recordingData, { showId, layoutId: activeLayout })} dark center>
                <Icon id="play" size={3} white right />
                <T id="media.play" />
            </Button>
        {/if}

        {#if syncedWithAudio}
            <div style="margin-top: 5px;display: flex;align-items: center;align-self: center;">
                <Icon id="music" right />
                <T id="recording.audio_synced" />
            </div>
        {/if}
        {#if hasChanged}
            <div style="margin-top: 5px;">
                <T id="recording.layout_changed" />
            </div>
        {/if}

        <div class="sequence">
            {#each recordingData.sequence as action, i}
                <div id={"#" + i} class="row context #slide_recorder_item">
                    <p>
                        <span style="opacity: 0.5;padding-right: 3px;min-width: 22px;display: inline-block;">{i + 1}</span>
                        <span style={action.time || i === recordingData.sequence.length - 1 ? "" : "opacity: 0.4;"}>{groupName(action.slideRef)}</span>
                    </p>

                    {#if i < recordingData.sequence.length - 1}
                        <NumberInput style="width: 100px;" buttons={false} value={action.time} inputMultiplier={0.001} fixed={2} step={500} max={10000000} on:change={(e) => updateTime(e, i)} />
                    {:else}
                        <NumberInput disabled style="width: 100px;" buttons={false} fixed={2} value={0} />
                    {/if}

                    {#if recordingPlaying?.index === i}
                        <!-- WIP showing wrong time if "started" before mount -->
                        <div class="timebar" style="--duration: {recordingPlaying.timeToNext}ms;width: {animate ? 100 : 0}%;"></div>
                    {/if}
                </div>
            {/each}
        </div>

        <div class="total" style="text-align: center;font-weight: bold;">
            <!-- WIP timebar / display real time time progress? -->
            {#if recordingPlaying}
                <span style="color: var(--secondary);margin-right: 10px;">{joinTime(secondsToTime(recordingData.sequence.slice(0, recordingPlaying.index).reduce((time, value) => (time += value.time), 0) / 1000))}</span>
            {/if}
            <span>{joinTime(secondsToTime(recordingData.sequence.reduce((time, value) => (time += value.time), 0) / 1000))}</span>
        </div>
    {:else}
        <Button on:click={toggleRecording} dark center>
            <Icon id={started ? "stop" : "record"} size={3} white={!started || !currentSequence.length} right />
            <T id="actions.{started ? 'stop_recording' : 'start_recording'}" />
        </Button>

        <!-- TODO: live audio recording (save approximate audio) -->
        <!-- live listen for when to play next slide.. -->

        {#if !started}
            <div style="margin-top: 5px;">
                <T id="recording.tip" />
            </div>
        {/if}
    {/if}
</div>

<!-- WIP autoscroll? -->

{#if recordingData}
    <div class="bottom">
        {#if recordingPlaying}
            <!-- WIP continue recording... -->
        {:else}
            <Button style="width: 100%;" on:click={deleteRecording} dark center>
                <Icon id="delete" right={!$labelsDisabled} />
                {#if !$labelsDisabled}<T id="recording.remove" />{/if}
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

    .sequence {
        margin-top: 5px;
    }
    .sequence .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 5px;
        border-bottom: 1px solid var(--primary-lighter);

        position: relative;
    }
    /* .sequence .row:nth-child(odd) {
        background-color: var(--primary-darker);
    } */

    .timebar {
        position: absolute;
        left: 0;
        bottom: 0;
        transform: translateY(50%);

        height: 1.5px;
        width: 0%;
        background-color: var(--secondary);

        transition: width var(--duration) linear;
    }
</style>

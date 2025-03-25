<script lang="ts">
    import { onDestroy } from "svelte"
    import { Unsubscriber } from "svelte/store"
    import { uid } from "uid"
    import type { Recording } from "../../../../types/Show"
    import { activeSlideRecording, dictionary, labelsDisabled, outputs, showsCache, special } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { addSlideAction } from "../../actions/actions"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import { getGroupName, getLayoutRef } from "../../helpers/show"
    import { playRecording, stopSlideRecording } from "../../helpers/slideRecording"
    import T from "../../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    export let showId: string

    $: show = $showsCache[showId] || {}
    $: activeLayout = show.settings.activeLayout
    $: showLayout = show.layouts[activeLayout] || {}
    $: showSlides = show.slides
    $: layoutRef = getLayoutRef(showId, show)
    $: layoutSequence = layoutRef.map(({ id }) => id).join("")

    let recordingData: Recording | null = null
    $: recordingData = showLayout.recording?.[0] || null

    let settingsOpened: boolean = false

    // $: useDurationTime = recordingData?.useDurationTime !== false
    $: useDurationTime = $special.useDurationTime !== false
    // check if layout slides has changed
    $: hasChanged = recordingData?.layoutAtRecording !== layoutSequence

    let started: boolean = false
    let outputListenerUnsubscribe: Unsubscriber | null = null
    let currentSequence: { time: number; slideRef: { id: string; index: any } }[] = []
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
            let outSlide = a[firstOutputId]?.out?.slide
            // clear output to stop recording
            if (started && currentSequence.length && !outSlide) return stopRecording()
            if (!outSlide || outSlide.layout !== activeLayout || outSlide.index === undefined) return

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

        // add start recording to first slide in recording
        addSlideAction(sequence[0].slideRef.index, "start_slide_recording")
    }

    function updateTime(e: any, index: number) {
        let layout = clone(showLayout)
        let s = layout.recording![0].sequence

        let reduced = useDurationTime ? 0 : s.reduce((time, value, i) => (time += i > index - 2 ? 0 : value.time), 0)
        let newTime = Number(e.detail)
        let newValue = newTime - reduced

        index = useDurationTime || index === 0 ? index : index - 1

        let difference = newValue - s[index].time
        s[index].time = newValue

        if (!useDurationTime) {
            if (s[index + 1]) s[index + 1].time -= difference

            let timestampValues = clone(s).map((a, ii) => {
                let time = s.reduce((time, value, i) => (time += i > ii - 1 ? 0 : value.time), 0)
                return { ...a, time }
            })

            // sort
            timestampValues = timestampValues.sort((a, b) => a.time - b.time)

            // back to duration
            let timeValue = 0
            const durationTimes = timestampValues.map((a, i) => {
                let time = timestampValues[i + 1]?.time || 0
                if (!time) {
                    a.time = time
                    return a
                }

                a.time = time - timeValue
                timeValue += a.time
                return a
            })

            layout.recording![0].sequence = durationTimes
        }

        let override = showId + activeLayout + "_recordtime"
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout", override: override } })
    }

    function deleteRecording() {
        let layout = clone(showLayout)
        delete layout.recording
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })

        settingsOpened = false
    }

    const isChecked = (e: any) => e.target.checked
    // function setRecordingKey(key: string, value: any) {
    //     let layout = clone(showLayout)
    //     if (!layout.recording) return

    //     layout.recording[0][key] = value
    //     history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    // }
    function setSpecialValue(key: string, value: any) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    function groupName({ index }) {
        let layoutSlide: any = layoutRef[index]
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

    function getTime(index: number) {
        if (!recordingData) return 0
        const s = recordingData.sequence
        if (useDurationTime) return s[index].time

        let reduced = s.reduce((time, value, i) => (time += i > index - 1 ? 0 : value.time), 0)
        return reduced
    }
</script>

<div class="padding">
    {#if settingsOpened && recordingData}
        <div class="settings">
            <CombinedInput textWidth={70}>
                <p title={$dictionary.recording?.use_duration_tip}><T id="recording.use_duration" /></p>
                <div class="alignRight">
                    <Checkbox checked={useDurationTime} on:change={(e) => setSpecialValue("useDurationTime", isChecked(e))} />
                </div>
            </CombinedInput>
        </div>
    {:else if recordingData}
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
                        <!-- || (useDurationTime ? i === recordingData.sequence.length - 1 : i === 0) -->
                        <span style={!action.time && i < recordingData.sequence.length - 1 ? "opacity: 0.4;" : ""}>{groupName(action.slideRef)}</span>
                    </p>

                    {#if useDurationTime ? i < recordingData.sequence.length - 1 : i > 0}
                        {#key recordingData}
                            <NumberInput style="width: 100px;min-width: 100px;" buttons={false} value={getTime(i)} inputMultiplier={0.001} fixed={2} step={500} max={10000000} on:change={(e) => updateTime(e, i)} />
                        {/key}
                    {:else}
                        <NumberInput disabled style="width: 100px;min-width: 100px;" buttons={false} fixed={2} value={0} />
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
            {#if settingsOpened}
                <Button style="width: 100%;" on:click={deleteRecording} dark center>
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

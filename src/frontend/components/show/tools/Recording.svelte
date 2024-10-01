<script lang="ts">
    import { uid } from "uid"
    import { Recording } from "../../../../types/Show"
    import { activeSlideRecording, labelsDisabled, outputs, showsCache } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, playRecording, stopSlideRecording } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { getGroupName } from "../../helpers/show"

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
    let currentSequence: any[] = []
    function toggleRecording() {
        if (started) {
            stopRecording()
            return
        }

        currentSequence = []
        started = true

        // LISTEN...
        // WIP store data for all "active" outputs!!!
        let firstOutputId = getActiveOutputs()[0]
        outputs.subscribe((a) => {
            let outSlide: any = a[firstOutputId]?.out?.slide || {}
            if (outSlide.layout !== activeLayout) return
            if (!currentSequence.length) newToast("$toast.recording_started")

            let layoutSlide = layoutRef[outSlide.index]
            // if (layoutSlide.parent) layoutSlide = layoutSlide.parent
            let slideRef = { id: layoutSlide?.id, index: outSlide.index }
            if (JSON.stringify(currentSequence[currentSequence.length - 1]?.slideRef || {}) === JSON.stringify(slideRef)) return

            let sequence = { time: Date.now(), slideRef }
            currentSequence.push(sequence)
            currentSequence = currentSequence
        })
    }

    function stopRecording() {
        newToast("$toast.recording_stopped")
        started = false

        if (currentSequence.length < 2) return

        let previousTime: number = 0
        let sequence = currentSequence.map((a, i) => {
            let time = i === 0 ? 0 : a.time - previousTime
            previousTime = a.time
            return { ...a, time }
        })

        let currentRecording: Recording = {
            id: uid(5),
            layoutAtRecording: layoutSequence,
            sequence: sequence,
        }

        let layout = clone(showLayout)
        layout.recording = [currentRecording]
        // WIP this can't undo properly!!
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout, previousData: clone(show) }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
        // recordingData = currentRecording
    }

    function updateTime(e: any, index: number) {
        let layout = clone(showLayout)
        layout.recording![0].sequence[index].time = Number(e.detail)
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout, previousData: clone(show) }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function deleteRecording() {
        let layout = clone(showLayout)
        delete layout.recording
        history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout, previousData: clone(show) }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
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

    $: recordingPlaying = $activeSlideRecording
</script>

<!-- WIP slide action to start recording!! -->
<!-- WIP use arrow keys to advance recording! -->
<!-- WIP record clear actions as well... -->
<!-- WIP if audo track is placed on first slide, the recording should "follow" the audio time.. -->

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
        <!-- <Button on:click={() => console.log("delete & record...")} dark center>
            <Icon id="restart" size={3} />
        </Button> -->

        {#if hasChanged}
            <div style="margin-top: 5px;">
                <T id="recording.layout_changed" />
            </div>
        {/if}

        <div class="sequence">
            {#each recordingData.sequence as action, i}
                <div class="row">
                    <!-- WIP highlight active -->
                    <p><span style="opacity: 0.5;padding-right: 3px;min-width: 22px;display: inline-block;">{i + 1}</span> {groupName(action.slideRef)}</p>
                    <NumberInput disabled={i === 0} style="width: 100px;" buttons={false} value={action.time} min={10} inputMultiplier={0.001} fixed={2} step={500} max={10000000} on:change={(e) => updateTime(e, i)} />
                </div>
            {/each}
        </div>
    {:else}
        <Button on:click={toggleRecording} dark center>
            <Icon id={started ? "stop" : "record"} size={3} white={!started || !currentSequence.length} right />
            <T id="actions.{started ? 'stop_recording' : 'start_recording'}" />
        </Button>

        {#if !started}
            <div style="margin-top: 5px;">
                <T id="recording.tip" />
            </div>
        {/if}
    {/if}
</div>

{#if recordingData}
    <div class="bottom">
        <Button style="width: 100%;" on:click={deleteRecording} dark center>
            <Icon id="delete" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="recording.remove" />{/if}
        </Button>
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
    }
    /* .sequence .row:nth-child(odd) {
        background-color: var(--primary-darker);
    } */
</style>

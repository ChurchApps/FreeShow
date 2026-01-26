import { get, type Unsubscriber } from "svelte/store"
import type { LayoutRef, TimelineAction } from "../../../types/Show"
import { activeShow, outputs, showsCache } from "../../stores"
import { getFirstActiveOutput, setOutput } from "../helpers/output"
import { getLayoutRef } from "../helpers/show"
import { updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"

type TimelineActionPass = { type: string; name: string; data: { id: string; index?: number; path?: string } }

export class ShowTimeline {
    private static recordingActive: boolean = false
    private static showRef: { id: string; layoutId: string } | null = null

    static toggleRecording(callback?: (s: TimelineActionPass) => void) {
        const currentShow = get(activeShow)
        if (!currentShow) {
            ShowTimeline.stopRecording()
            return false
        }

        if (ShowTimeline.isRecordingActive()) {
            ShowTimeline.stopRecording()
            return false
        } else {
            // active for another show
            if (ShowTimeline.recordingActive) ShowTimeline.stopRecording()

            ShowTimeline.startRecording(callback)
            return true
        }
    }

    static startRecording(callback?: (s: TimelineActionPass) => void) {
        const currentShow = get(activeShow)
        if (!currentShow) return

        const activeLayout = _show(currentShow.id).get("settings.activeLayout")
        ShowTimeline.showRef = { id: currentShow.id, layoutId: activeLayout }
        ShowTimeline.recordingActive = true

        console.log("Started recording timeline actions")

        ShowTimeline.outputListener(callback)
    }

    static stopRecording() {
        ShowTimeline.showRef = null
        ShowTimeline.recordingActive = false

        console.log("Stopped recording timeline actions")
    }

    static isRecordingActive() {
        const currentShow = get(activeShow)
        if (!currentShow) return false

        const activeLayout = _show(currentShow.id).get("settings.activeLayout")
        return ShowTimeline.recordingActive && ShowTimeline.showRef?.id === currentShow.id && ShowTimeline.showRef?.layoutId === activeLayout
    }

    // INPUT

    private static outputListenerUnsubscribe: Unsubscriber | null = null
    private static outputListener(callback?: (s: TimelineActionPass) => void) {
        let firstOutputId = getFirstActiveOutput()?.id || ""
        if (!firstOutputId) return

        ShowTimeline.clearOutputListener()

        const layoutRef = getLayoutRef()
        let previousRef = ""
        ShowTimeline.outputListenerUnsubscribe = outputs.subscribe((a) => {
            let outSlide = a[firstOutputId]?.out?.slide
            if (!outSlide || outSlide.id !== ShowTimeline.showRef?.id || outSlide.layout !== ShowTimeline.showRef?.layoutId || outSlide.index === undefined) return

            // if (!currentSequence.length) newToast("toast.recording_started")

            let layoutSlide = layoutRef[outSlide.index]
            if (!layoutSlide) return

            let slideRef = { id: layoutSlide.id, index: outSlide.index }

            const newRef = JSON.stringify(slideRef)
            if (previousRef === newRef) return
            previousRef = newRef

            const groupSlideId = layoutRef[outSlide.index]?.parent?.id || layoutSlide?.id
            const slideGroup = get(showsCache)[ShowTimeline.showRef?.id || ""]?.slides?.[groupSlideId]?.group || ""
            if (callback) callback({ type: "slide", name: slideGroup, data: slideRef })

            // let sequence = { time: Date.now(), slideRef }
            // ShowTimeline.currentSequence.push(sequence)
            // if (callback) callback(ShowTimeline.currentSequence)

            // WIP add clearing as actions...
        })
    }

    private static clearOutputListener() {
        if (!ShowTimeline.outputListenerUnsubscribe) return
        ShowTimeline.outputListenerUnsubscribe()
        ShowTimeline.outputListenerUnsubscribe = null
    }

    static playAction(action: TimelineAction) {
        console.log("Action:", action)

        if (action.type === "slide") {
            const ref = action.data
            const layoutRef = getLayoutRef()
            const slideIndex = ref.index
            if (typeof slideIndex !== "number") return

            // check that slide exists
            let slide: LayoutRef | undefined = layoutRef[slideIndex]
            if (!slide) slide = layoutRef.find((a) => a.id === ref.id)
            if (!slide) return

            // WIP improve this
            const showId = get(activeShow)?.id || "" // WIP should be playable independent of svelte component and the active ref
            const layoutId = _show().get("settings.activeLayout")
            const outSlide = getFirstActiveOutput()?.out?.slide
            if (outSlide?.id !== showId || outSlide?.layout !== layoutId || outSlide?.index !== slideIndex) {
                updateOut("active", slideIndex, layoutRef)
                // WIP check that slide is the correct ID ??
                setOutput("slide", { id: showId, layout: layoutId, index: slideIndex, line: 0 })
            }
        }

        // if (action.type === "audio") {
        //     AudioPlayer.start(action.data.path, { name: action.data.name }, { pauseIfPlaying: false, playMultiple: true })
        // }
    }
}

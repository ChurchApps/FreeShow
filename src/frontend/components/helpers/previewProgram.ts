import { get } from "svelte/store"
import type { OutData } from "../../../types/Output"
import type { Transition } from "../../../types/Show"
import { outputs, previewMode, previewOut, previewTransitionType, previewTransitionDuration, transitionData } from "../../stores"
import { clone, removeDuplicates } from "./array"
import { getActiveOutputs, setOutput } from "./output"
import { _show } from "./shows"
import { updateOut } from "./showActions"

/**
 * Load content into PREVIEW state (does NOT affect LED/Program output)
 * Called instead of setOutput() when previewMode is enabled
 */
export function setPreview(type: string, data: any, toggle = false, outputId = "", add = false) {
    const outs = outputId ? [outputId] : getActiveOutputs(get(outputs), true, false, true)

    previewOut.update((a: any) => {
        let toggleState = false
        outs.forEach((id: string, i: number) => {
            if (!a[id]) a[id] = {}

            if (type === "overlays" || type === "effects") {
                let outData: string[] = a[id][type] || []
                let items = Array.isArray(data) ? data : data ? [data] : []
                if (items.length) {
                    if (toggle && i === 0) toggleState = outData.includes(items[0])
                    if (toggle && toggleState) outData = outData.filter((x: any) => x !== items[0])
                    else if (toggle || add) outData = removeDuplicates([...outData, ...items])
                    else outData = items
                } else {
                    outData = []
                }
                a[id][type] = clone(outData)
            } else {
                a[id][type] = data ? clone(data) : null
            }
        })
        return a
    })
}

/**
 * TAKE: Transfer preview content to program (LED)
 * Copies previewOut state to outputs.out and triggers necessary side effects
 */
export function takeToProgram(outputId = "") {
    if (!get(previewMode)) return

    const preview = get(previewOut)
    const outs = outputId ? [outputId] : getActiveOutputs(get(outputs), true, false, true)

    outs.forEach((id: string) => {
        const previewData = preview[id]
        if (!previewData) return

        if (previewData.background !== undefined) {
            setOutputDirect("background", previewData.background, id)
        }
        if (previewData.slide !== undefined) {
            setOutputDirect("slide", previewData.slide, id)
            if (previewData.slide?.id && previewData.slide.index !== undefined) {
                const ref = _show(previewData.slide.id).layouts([previewData.slide.layout]).ref()[0] || []
                const wasPreviewMode = get(previewMode)
                previewMode.set(false)
                try {
                    updateOut(previewData.slide.id, previewData.slide.index, ref, true, id)
                } finally {
                    if (wasPreviewMode) previewMode.set(true)
                }
            }
        }
        if (previewData.overlays !== undefined) {
            setOutputDirect("overlays", previewData.overlays, id)
        }
        if (previewData.effects !== undefined) {
            setOutputDirect("effects", previewData.effects, id)
        }
    })

    // Clear preview after take
    clearPreview(outputId)
}

/**
 * FADE: Transfer preview to program with a fade transition
 */
export function fadeToProgram(customTransition?: Transition, outputId = "") {
    if (!get(previewMode)) return

    const duration = get(previewTransitionDuration) || 800
    const currentTransition = clone(get(transitionData))

    transitionData.set({
        text: customTransition || { type: "fade", duration, easing: "sine" },
        media: customTransition || { type: "fade", duration, easing: "sine" }
    })

    takeToProgram(outputId)

    setTimeout(() => {
        transitionData.set(currentTransition)
    }, duration + 100)
}

/**
 * CUT: Transfer preview to program instantly (no transition)
 */
export function cutToProgram(outputId = "") {
    if (!get(previewMode)) return

    const currentTransition = clone(get(transitionData))

    transitionData.set({
        text: { type: "none", duration: 0, easing: "" },
        media: { type: "none", duration: 0, easing: "" }
    })

    takeToProgram(outputId)

    setTimeout(() => {
        transitionData.set(currentTransition)
    }, 150)
}

/**
 * Blackout live program output (Panic / Black button)
 */
export function blackoutProgram(outputId = "") {
    const outs = outputId ? [outputId] : getActiveOutputs(get(outputs), true, false, true)
    outs.forEach((id: string) => {
        setOutputDirect("slide", null, id)
        setOutputDirect("background", null, id)
        setOutputDirect("overlays", [], id)
        setOutputDirect("effects", [], id)
    })
}

/**
 * Swap preview and program content
 */
export function swapPreviewProgram(outputId = "") {
    if (!get(previewMode)) return

    const preview = get(previewOut)
    const outs = outputId ? [outputId] : getActiveOutputs(get(outputs), true, false, true)

    outs.forEach((id: string) => {
        const currentProgram = clone(get(outputs)[id]?.out || {})
        const currentPreview = clone(preview[id] || {})

        previewOut.update((a: any) => {
            a[id] = currentProgram
            return a
        })

        if (currentPreview.slide !== undefined) setOutputDirect("slide", currentPreview.slide, id)
        if (currentPreview.background !== undefined) setOutputDirect("background", currentPreview.background, id)
        if (currentPreview.overlays !== undefined) setOutputDirect("overlays", currentPreview.overlays, id)
        if (currentPreview.effects !== undefined) setOutputDirect("effects", currentPreview.effects, id)
    })
}

/**
 * Clear preview state
 */
export function clearPreview(outputId = "") {
    if (outputId) {
        previewOut.update((a: any) => {
            delete a[outputId]
            return a
        })
    } else {
        previewOut.set({})
    }
}

/**
 * Quick action: load into preview + immediately take/fade to program
 * Useful for SHIFT+F keyboard shortcuts
 */
export function quickTake(type: string, data: any, useFade = false) {
    setPreview(type, data)
    if (useFade) fadeToProgram()
    else takeToProgram()
}

/**
 * Toggle preview/program mode
 */
export function togglePreviewMode() {
    previewMode.update((a: boolean) => !a)
    if (!get(previewMode)) {
        clearPreview()
    }
}

/**
 * Internal: directly call setOutput bypassing preview mode check
 */
export function setOutputDirect(type: string, data: any, outputId: string, toggle = false, add = false) {
    const wasPreviewMode = get(previewMode)
    previewMode.set(false)
    try {
        setOutput(type, data, toggle, outputId, add)
    } finally {
        if (wasPreviewMode) previewMode.set(true)
    }
}

import { get } from "svelte/store"
import { uid } from "uid"
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { Resolution } from "../../../types/Settings"
import type { Transition } from "../../../types/Show"
import { currentOutputSettings, lockedOverlays, outputDisplay, outputs, overlays, playingVideos, showsCache, styles, theme, themes, transitionData } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "./array"
import { _show } from "./shows"

export function displayOutputs(e: any = {}, auto: boolean = false) {
    let enabledOutputs: any[] = getActiveOutputs(get(outputs), false)
    enabledOutputs.forEach((id) => {
        let output: any = { id, ...get(outputs)[id] }
        send(OUTPUT, ["DISPLAY"], { enabled: !get(outputDisplay), output, force: e.ctrlKey || e.metaKey, auto })
    })
}

// background: null,
// slide: null,
// overlays: [],
// transition: null,
// TODO: updating a output when a "next slide timer" is active, will "reset/remove" the "next slide timer"
export function setOutput(key: string, data: any, toggle: boolean = false, outputId: string | null = null, add: boolean = false) {
    outputs.update((a: any) => {
        let outs = getActiveOutputs()
        if (outputId) outs = [outputId]

        outs.forEach((id: string, i: number) => {
            let output: any = a[id]
            if (!output.out) a[id].out = {}
            if (!output.out?.[key]) a[id].out[key] = key === "overlays" ? [] : null

            let outData = a[id].out?.[key] || null
            if (key === "overlays" && data.length) {
                if (!Array.isArray(data)) data = [data]
                if (toggle && outData?.includes(data[0])) outData!.splice(outData!.indexOf(data[0]), 1)
                else if (toggle || add) outData = [...new Set([...(a[id].out?.[key] || []), ...data])]
                else outData = data
            } else outData = data

            a[id].out![key] = outData

            // save locked overlays
            if (key === "overlays") lockedOverlays.set(outData)

            // WIP update bg (muted, loop, time)
            // WIP preview don't get set to 0, just output window
            if (key === "background" && data) {
                // mute videos in the other output windows if more than one
                let muted = data.muted || false
                if (outs.length > 1 && i !== 0) muted = true

                let msg: any = { id, data: { muted, loop: data.loop || false } }
                if (data.startAt !== undefined) msg.time = data.startAt || 0

                setTimeout(() => {
                    send(OUTPUT, ["UPDATE_VIDEO"], msg)
                }, 100)
            }
        })

        return a
    })
}

export function getActiveOutputs(updater: any = get(outputs), hasToBeActive: boolean = true, removeKeyOutput: boolean = false) {
    let sortedOutputs: any[] = Object.entries(updater)
        .map(([id, a]: any) => ({ id, ...a }))
        .sort((a, b) => a.name?.localeCompare(b.name))
    let enabled: any[] = sortedOutputs.filter((a) => a.enabled === true && (removeKeyOutput ? !a.isKeyOutput : true))

    if (hasToBeActive && enabled.filter((a) => a.active === true).length) enabled = enabled.filter((a) => a.active === true)

    enabled = enabled.map((a) => a.id)

    if (!enabled.length) {
        if (!sortedOutputs.length) addOutput(true)
        if (sortedOutputs[0]) enabled = [sortedOutputs[0].id]
    }

    return enabled
}

export function findMatchingOut(id: string, updater: any = get(outputs)): string | null {
    let match: string | null = null

    // TODO: more than one active

    getActiveOutputs(updater, false).forEach((outputId: string) => {
        let output: any = updater[outputId]
        if (match === null && output.enabled) {
            // TODO: index & layout: $outSlide?.index === i && $outSlide?.id === $activeShow?.id && $outSlide?.layout === activeLayout
            // slides (edit) + slides
            if (output.out?.slide?.id === id) match = output.color
            else if ((output.out?.background?.path || output.out?.background?.id) === id) match = output.color
            else if (output.out?.overlays?.includes(id)) match = output.color
        }
    })

    // if (match && match === "#F0008C" && get(themes)[get(theme)]?.colors?.secondary) {
    //   match = get(themes)[get(theme)]?.colors?.secondary
    // }

    return match
}

export function refreshOut(refresh: boolean = true) {
    outputs.update((a) => {
        getActiveOutputs().forEach((id: string) => {
            a[id].out = { ...a[id].out, refresh }
        })
        return a
    })

    if (refresh) {
        setTimeout(() => {
            refreshOut(false)
        }, 100)
    }
}

// outputs is just for updates
export function isOutCleared(key: string | null = null, updater: any = get(outputs), checkLocked: boolean = false) {
    let cleared: boolean = true

    getActiveOutputs().forEach((id: string) => {
        let output: any = updater[id]
        let keys: string[] = key ? [key] : Object.keys(output.out || {})
        keys.forEach((key: string) => {
            // TODO:
            if (output.out?.[key]) {
                if (key === "overlays") {
                    if (checkLocked && output.out.overlays.length) cleared = false
                    else if (!checkLocked && output.out.overlays.filter((id: string) => !get(overlays)[id]?.locked).length) cleared = false
                } else if (output.out[key] !== null) cleared = false
            }
        })
    })

    return cleared
}

// WIP style should override any slide resolution & color ? (it does not)

export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null, getSlideRes: boolean = false): Resolution {
    let currentOutput = get(outputs)[getActiveOutputs()[0]]
    let style = currentOutput?.style ? get(styles)[currentOutput?.style]?.resolution : null
    let slideRes: any = null

    if (!initial && !style && getSlideRes) {
        let outSlide: any = currentOutput?.out?.slide || {}
        let slideRef = _show(outSlide.id || "")
            .layouts([outSlide.layout])
            .ref()[0]?.[outSlide.index]
        let slideOutput = _show(outSlide.id || "").get("slides")?.[slideRef?.id] || null
        slideRes = slideOutput?.settings?.resolution
    }

    return initial || style || slideRes || { width: 1920, height: 1080 }
}

// settings

export const defaultOutput: Output = {
    enabled: true,
    active: true,
    name: "Output",
    color: "#F0008C",
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // x: 1920 ?
    screen: null,
}

export function keyOutput(keyId: string, delOutput: boolean = false) {
    if (!keyId) return

    if (delOutput) {
        deleteOutput(keyId)
        return
    }

    // create new "key" output
    outputs.update((a) => {
        let currentOutput = clone(defaultOutput)
        currentOutput.name = "Key"
        currentOutput.isKeyOutput = true
        a[keyId] = currentOutput

        // show
        send(OUTPUT, ["CREATE"], { id: keyId, ...currentOutput })
        if (get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id: keyId, ...currentOutput } })

        return a
    })
}

export function addOutput(onlyFirst: boolean = false) {
    if (onlyFirst && get(outputs).length) return

    outputs.update((output) => {
        let id = uid()
        if (get(themes)[get(theme)]?.colors?.secondary) defaultOutput.color = get(themes)[get(theme)]?.colors?.secondary
        output[id] = clone(defaultOutput)

        // set name
        let n = 0
        while (Object.values(output).find((a) => a.name === output[id].name + (n ? " " + n : ""))) n++
        if (n) output[id].name = output[id].name + " " + n
        if (onlyFirst) output[id].name = "Primary"

        // show
        if (!onlyFirst) send(OUTPUT, ["CREATE"], { id, ...output[id] })
        if (!onlyFirst && get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id, ...output[id] } })

        currentOutputSettings.set(id)
        return output
    })
}

export function deleteOutput(outputId: string) {
    if (Object.keys(get(outputs)).length <= 1) return

    outputs.update((a) => {
        let keyOutput = a[outputId].isKeyOutput

        send(OUTPUT, ["REMOVE"], { id: outputId })
        delete a[outputId]

        if (!keyOutput) currentOutputSettings.set(Object.keys(a)[0])
        return a
    })
}

export async function clearPlayingVideo(clearOutput: any = null) {
    // videoData.paused = true
    if (clearOutput) setOutput("background", null)

    let mediaTransition: Transition = getCurrentMediaTransition()
    console.log(mediaTransition)

    // TODO: fade out audio

    let duration = mediaTransition?.duration || 0
    if (!clearOutput) duration /= 2.4 // a little less than half the time

    return new Promise((resolve) => {
        setTimeout(() => {
            // if (!videoData.paused) return

            // remove from playing
            playingVideos.update((a) => {
                let existing = a.findIndex((a) => a.location === "output")
                if (existing > -1) a.splice(existing, 1)
                return a
            })

            //   let video = null
            let videoData = {
                time: 0,
                duration: 0,
                paused: !!clearOutput,
                muted: false,
                loop: false,
            }

            send(OUTPUT, ["UPDATE_VIDEO"], { id: clearOutput, data: videoData, time: 0 })

            resolve(videoData)
        }, duration)
    })
}

export function getCurrentMediaTransition() {
    let transition: Transition = get(transitionData).media

    let outputId = getActiveOutputs(get(outputs))[0]
    let currentOutput = get(outputs)[outputId] || {}
    let out: any = currentOutput?.out || {}
    let slide: any = out.slide || null
    let slideData = get(showsCache) && slide && slide.id !== "temp" ? _show(slide.id).layouts("active").ref()[0]?.[slide.index!]?.data : null
    let slideMediaTransition = slideData ? slideData.mediaTransition : null

    return slideMediaTransition || transition
}

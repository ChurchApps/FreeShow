import { get } from "svelte/store"
import { uid } from "uid"
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import type { Resolution } from "../../../types/Settings"
import { currentOutputSettings, outputDisplay, outputs, overlays, theme, themes } from "../../stores"
import { sendInitialOutputData } from "../../utils/messages"
import { send } from "../../utils/request"

// background: null,
// slide: null,
// overlays: [],
// transition: null,
export function setOutput(key: string, data: any, toggle: boolean = false, outputId: string | null = null, add: boolean = false) {
  outputs.update((a: any) => {
    let outs = getActiveOutputs()
    if (outputId) outs = [outputId]
    outs.forEach((id: string) => {
      let output: any = a[id]
      if (!output.out) a[id].out = {}
      if (!output.out?.[key]) a[id].out[key] = key === "overlays" ? [] : null
      if (key === "overlays" && data.length) {
        if (!Array.isArray(data)) data = [data]
        if (toggle && a[id].out?.[key]?.includes(data[0])) a[id].out![key]!.splice(a[id].out![key]!.indexOf(data[0]), 1)
        else if (toggle || add) a[id].out![key] = [...new Set([...(a[id].out?.[key] || []), ...data])]
        else a[id].out![key] = data
      } else a[id].out![key] = data

      // WIP update bg (muted, loop, time)
      if (key === "background" && data) send(OUTPUT, ["UPDATE_VIDEO"], { id, data: { muted: data.muted || false, loop: data.loop || false }, time: data.startAt || 0 })
    })
    return a
  })
}

export function getActiveOutputs(updater: any = get(outputs), hasToBeActive: boolean = true) {
  let sortedOutputs: any[] = Object.entries(updater)
    .map(([id, a]: any) => ({ id, ...a }))
    .sort((a, b) => a.name?.localeCompare(b.name))
  let enabled: any[] = sortedOutputs.filter((a) => a.enabled === true)

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

  // if (match && match === "#e6349c" && get(themes)[get(theme)]?.colors?.secondary) {
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
          else if (!checkLocked && output.out.overlays.filter((id: string) => !get(overlays)[id].locked).length) cleared = false
        } else if (output.out[key] !== null) cleared = false
      }
    })
  })

  return cleared
}

export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null): Resolution {
  let currentOutput = get(outputs)[getActiveOutputs()[0]]
  return initial || currentOutput?.show?.resolution || { width: 1920, height: 1080 }
}

// settings

export const defaultOutput: Output = {
  enabled: true,
  active: true,
  name: "Output",
  color: "#e6349c",
  bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // x: 1920 ?
  screen: null,
  kiosk: true,
  show: {},
}

export function addOutput(onlyFirst: boolean = false) {
  if (onlyFirst && get(outputs).length) return

  outputs.update((output) => {
    let id = uid()
    if (get(themes)[get(theme)]?.colors?.secondary) defaultOutput.color = get(themes)[get(theme)]?.colors?.secondary
    output[id] = JSON.parse(JSON.stringify(defaultOutput))

    // set name
    let n = 0
    while (Object.values(output).find((a) => a.name === output[id].name + (n ? " " + n : ""))) n++
    if (n) output[id].name = output[id].name + " " + n
    if (onlyFirst) output[id].name = "Primary"

    // show
    if (!onlyFirst) send(OUTPUT, ["CREATE"], { id, ...output[id] })
    if (!onlyFirst && get(outputDisplay)) send(OUTPUT, ["DISPLAY"], { enabled: true, output: { id, ...output[id] } })
    setTimeout(() => {
      sendInitialOutputData()
    }, 3000)

    currentOutputSettings.set(id)
    return output
  })
  // history({
  //       id: "addTheme",
  //       newData: { ...JSON.parse(JSON.stringify($themes[$theme])), default: false, name: themeValue + " 2" },
  //       location: { page: "settings", theme: uid() },
  //     })
}

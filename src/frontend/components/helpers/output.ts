import { get } from "svelte/store"
import type { Resolution } from "../../../types/Settings"
import { outputs } from "../../stores"

// background: null,
// slide: null,
// overlays: [],
// transition: null,
export function setOutput(key: string, data: any, toggle: boolean = false, outputId: string | null = null) {
  outputs.update((a: any) => {
    let outs = getActiveOutputs()
    if (outputId) outs = [outputId]
    outs.forEach((id: string) => {
      let output: any = a[id]
      if (!output.out) a[id].out = {}
      if (!output.out?.[key]) a[id].out[key] = key === "overlays" ? [] : null
      if (key === "overlays" && data.length) {
        if (toggle && a[id].out?.[key]?.includes(data)) a[id].out![key]!.splice(a[id].out![key]!.indexOf(data), 1)
        else if (toggle) a[id].out![key] = [...new Set([...(a[id].out?.[key] || []), data])]
        else a[id].out![key] = data
      } else a[id].out![key] = data
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

  if (!enabled.length) enabled = [sortedOutputs[0].id]

  return enabled
}

export function findMatchingOut(id: string, updater: any = get(outputs)): string | null {
  let match: string | null = null

  // TODO: more than one active

  getActiveOutputs(updater, false).forEach((outputId: string) => {
    let output: any = updater[outputId]
    if (match === null && output.enabled) {
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

export function refreshOut() {
  // TODO: (outputs not updating)
  outputs.update((a) => {
    getActiveOutputs().forEach((id: string) => {
      a[id].out = a[id].out
    })
    return a
  })
}

// outputs is just for updates
export function isOutCleared(key: string | null = null, updater: any = get(outputs)) {
  let cleared: boolean = true

  getActiveOutputs().forEach((id: string) => {
    let output: any = updater[id]
    let keys: string[] = key ? [key] : Object.keys(output.out || {})
    keys.forEach((key: string) => {
      // TODO:
      if (output.out?.[key]) {
        if (key === "overlays") {
          if (output.out[key].length) cleared = false
        } else if (output.out[key] !== null) cleared = false
      }
    })
  })

  return cleared
}

export function getResolution(initial: Resolution | undefined | null = null, _updater: any = null): Resolution {
  let currentOutput = get(outputs)[getActiveOutputs()[0]]
  return initial || currentOutput.show?.resolution || { width: 1920, height: 1080 }
}

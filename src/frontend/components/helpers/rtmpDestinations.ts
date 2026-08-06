import { uid } from "uid"
import type { RtmpData, RtmpDestination, RtmpStatus } from "../../../types/Output"

export function createDestination(index: number): RtmpDestination {
    return { id: uid(), name: `Destination ${index + 1}`, url: "", key: "", enabled: true }
}

/**
 * Fold the pre-multi-destination `{ url, key }` pair into the destinations list.
 * Idempotent, so it is safe to run on every settings load.
 */
export function migrateRtmpData(rtmpData: RtmpData | undefined): RtmpData | undefined {
    if (!rtmpData) return rtmpData
    if (rtmpData.url === undefined && rtmpData.key === undefined) return rtmpData

    const { url, key, ...rest } = rtmpData
    const migrated: RtmpData = { ...rest }

    if (!migrated.destinations?.length && url) {
        migrated.destinations = [{ id: uid(), name: "Destination 1", url, key: key || "", enabled: true }]
    }

    return migrated
}

/** Migrate every output in place. Returns true when something actually changed. */
export function migrateOutputsRtmp(outputs: { [id: string]: { rtmpData?: RtmpData } }): boolean {
    let changed = false

    for (const output of Object.values(outputs)) {
        const migrated = migrateRtmpData(output.rtmpData)
        if (migrated !== output.rtmpData) {
            output.rtmpData = migrated
            changed = true
        }
    }

    return changed
}

export function hasStreamableDestination(rtmpData: RtmpData | undefined): boolean {
    return !!rtmpData?.destinations?.some((d) => d.enabled && d.url)
}

/**
 * Which enabled destinations are not currently live, for the at-a-glance badge on the output
 * preview. Only the *current* state counts: a destination that reconnected earlier but is live
 * now should not leave the badge stuck amber for the rest of the stream — that history belongs
 * in the per-destination hint on the settings page instead.
 */
export function getUnhealthyDestinations(rtmpData: RtmpData | undefined, status: RtmpStatus | undefined): string[] {
    if (!status) return []

    return (rtmpData?.destinations || [])
        .filter((d) => d.enabled && d.url)
        .filter((d) => {
            const state = status[d.id]?.state
            return !!state && state !== "live"
        })
        .map((d) => d.name)
}

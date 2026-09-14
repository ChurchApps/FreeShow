import { uid } from "uid"
import type { RtmpData, RtmpDestination, RtmpStatus } from "../../../types/Output"

export function createDestination(): RtmpDestination {
    return { id: uid(), url: "", key: "", enabled: true }
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
        .map((d) => d.id)
}

// MIGRATE v1.6.4 config (only this one version uses it)

/** Migrate every output in place. Returns true when something actually changed. */
export function migrateOutputsRtmp(outputs: { [id: string]: { rtmpData?: RtmpData } }) {
    for (const output of Object.values(outputs)) {
        const migrated = migrateRtmpData(output.rtmpData)
        if (migrated !== output.rtmpData) {
            output.rtmpData = migrated
        }
    }
}

function migrateRtmpData(rtmpData: RtmpData | undefined): RtmpData | undefined {
    if (!rtmpData) return rtmpData
    if (rtmpData.url === undefined && rtmpData.key === undefined) return rtmpData

    const { url, key, ...rest } = rtmpData
    const migrated: RtmpData = { ...rest }

    if (!migrated.destinations?.length && url) {
        migrated.destinations = [{ id: uid(), url, key: key || "", enabled: true }]
    }

    return migrated
}

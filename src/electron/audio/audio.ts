import { parseFile } from "music-metadata"

export async function getAudioMetadata(filePath: string) {
    if (!filePath) return null

    try {
        const metadata = await parseFile(filePath, { skipCovers: true })

        let replayGainDb: number | null = null
        let replayGainPeak: number | null = null

        // Helper to parse values that could be numbers, strings, or objects (music-metadata IRatio)
        function parseValue(val: any, field: "dB" | "ratio"): number | null {
            if (typeof val === "number") return val
            if (val && typeof val === "object") return val[field] ?? val.ratio ?? val.dB
            if (typeof val === "string") {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ""))
                return isNaN(parsed) ? null : parsed
            }
            return null
        }

        // Recursive function to search for ReplayGain keys
        function findReplayGain(obj: any) {
            if (!obj || typeof obj !== "object") return
            if (replayGainDb !== null && replayGainPeak !== null) return

            for (const key of Object.keys(obj)) {
                const cleanKey = key.toLowerCase().replace(/[\s_]/g, "")

                if (replayGainDb === null && (cleanKey === "replaygaintrackgain" || cleanKey === "replaygainalbumgain")) {
                    replayGainDb = parseValue(obj[key], "dB")
                } else if (replayGainPeak === null && (cleanKey === "replaygaintrackpeak" || cleanKey === "replaygainalbumpeak")) {
                    replayGainPeak = parseValue(obj[key], "ratio")
                } else if (obj[key] && typeof obj[key] === "object") {
                    findReplayGain(obj[key])
                }
            }
        }

        findReplayGain(metadata)

        const returnData: any = { common: metadata.common }
        if (replayGainDb !== null) {
            let multiplier = Math.pow(10, replayGainDb / 20)

            // Limit gain if peak is available to avoid clipping (0 dBFS max)
            if (replayGainPeak !== null && replayGainPeak > 0) {
                const maxMultiplier = 1 / replayGainPeak
                if (multiplier > maxMultiplier) {
                    multiplier = maxMultiplier
                }
            }

            returnData.replayGainMultiplier = multiplier
        }

        return returnData
    } catch (err: any) {
        // ignore known unsupported formats like QuickTime video
        if (err.message?.includes("video/quicktime")) return null

        console.error("Error parsing audio metadata:", err.message)
        return null
    }
}

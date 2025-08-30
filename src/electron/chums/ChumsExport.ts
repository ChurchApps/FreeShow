import path from "path"
import type { Main, MainSendPayloads } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { parseShow, readFile } from "../utils/files"
import { ChumsConnect } from "./ChumsConnect"
import type { ChumsSongData } from "./types"

/**
 * Handles exporting FreeShow songs to Chums.
 * Syncs local songs with Chums by identifying missing songs and sending them in batches.
 */
export class ChumsExport {
    public static async sendSongsToChums(data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]): Promise<void> {
        const missingIds = await this.getMissingSongIds(data)
        console.log("Sending songs to Chums", missingIds.length)
        if (missingIds.length === 0) return

        // Get song data only for missing songs
        const songData = this.getChumsSongData(missingIds, data)
        const batchSize = 10

        // Send the missing songs in batches
        for (let i = 0; i < songData.length; i += batchSize) {
            const batch = songData.slice(i, i + batchSize)
            await ChumsConnect.apiRequest({
                api: "content",
                authenticated: true,
                scope: "plans",
                endpoint: "/songs/import",
                method: "POST",
                data: batch
            })
        }

        sendToMain(ToMain.TOAST, `Synced ${missingIds.length} new songs to Chums`)
    }

    private static async getMissingSongIds(data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]): Promise<string[]> {
        const freeShowIds = this.getAllFreeShowSongIds(data)

        const missingSongsResponse = await ChumsConnect.apiRequest({
            api: "content",
            authenticated: true,
            scope: "plans",
            endpoint: "/arrangements/freeShow/missing",
            method: "POST",
            data: { freeShowIds }
        })

        return missingSongsResponse || []
    }

    private static getAllFreeShowSongIds(data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]): string[] {
        const shows = data.shows
        const selectedCategories = data.categories || ["song"]
        return Object.keys(shows).filter((key) => selectedCategories.includes(shows[key].category || ""))
    }

    private static getChumsSongData(freeShowIds: string[], data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]): ChumsSongData[] {
        const songList: ChumsSongData[] = []
        const shows = data.shows

        freeShowIds.forEach((key: string) => {
            const show = shows[key]
            const showData = this.loadShowData(show.name, data.showsPath)
            if (!showData) return

            const songData: ChumsSongData = {
                freeShowId: key,
                title: showData[1].meta?.title || showData[1].name || "",
                artist: showData[1].meta?.artist || "",
                lyrics: "",
                ccliNumber: showData[1].meta?.CCLI || ""
            }

            // Add lyrics with group names
            let currentGroup = ""
            Object.keys(showData[1].slides).forEach((slideKey: string) => {
                const slide = showData[1].slides?.[slideKey]
                // Add group name if it's different from the current group
                if (slide.group && slide.group !== currentGroup) {
                    songData.lyrics += `[${slide.group}]\n`
                    currentGroup = slide.group
                }
                slide.items.forEach((item) => {
                    item.lines?.forEach((line) => {
                        songData.lyrics += line.text?.[0]?.value + "\n" || ""
                    })
                })
                songData.lyrics += "\n"
            })
            songData.lyrics = songData.lyrics.replaceAll("\n\n", "\n")

            songList.push(songData)
        })

        return songList
    }

    private static loadShowData(showName: string, showsPath: string) {
        const showPath = path.join(showsPath, `${showName}.show`)
        const jsonData = readFile(showPath) || "{}"
        return parseShow(jsonData)
    }
}

import { ToMain } from "../../types/IPC/ToMain"
import { stores } from "../data/store"
import { sendToMain } from "../IPC/main"
import { getDocumentsFolder, parseShow, readFile } from "../utils/files"
import path from "path"
import { ChumsConnect } from "./ChumsConnect"
import type { ChumsSongData } from "./types"

/**
 * Handles exporting FreeShow songs to Chums.
 * Syncs local songs with Chums by identifying missing songs and sending them in batches.
 */
export class ChumsExport {
    public static async sendSongsToChums(): Promise<void> {
        const missingIds = await this.getMissingSongIds()
        if (missingIds.length === 0) return

        // Get song data only for missing songs
        const songData = this.getChumsSongData(missingIds)
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
                data: batch,
            })
        }

        sendToMain(ToMain.TOAST, `Synced ${missingIds.length} new songs to Chums`)
    }

    private static async getMissingSongIds(): Promise<string[]> {
        const freeShowIds = this.getAllFreeShowSongIds()

        const missingSongsResponse = await ChumsConnect.apiRequest({
            api: "content",
            authenticated: true,
            scope: "plans",
            endpoint: "/arrangements/freeShow/missing",
            method: "POST",
            data: { freeShowIds },
        })

        return missingSongsResponse || []
    }

    private static getAllFreeShowSongIds(): string[] {
        const shows = stores.SHOWS.store as { [key: string]: any }
        return Object.keys(shows).filter((key) => shows[key].category === "song")
    }

    private static getChumsSongData(freeShowIds: string[]): ChumsSongData[] {
        const songList: ChumsSongData[] = []
        const shows = stores.SHOWS.store as { [key: string]: any }

        freeShowIds.forEach((key: string) => {
            const show = shows[key]
            if (show.category === "song") {
                const showData = this.loadShowData(show.name)
                if (showData) {
                    const songData: ChumsSongData = {
                        freeShowId: key,
                        title: showData[1].meta?.title || showData[1].name || "",
                        artist: showData[1].meta?.artist || "",
                        lyrics: "",
                        ccliNumber: showData[1].meta?.CCLI || "",
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
                }
            }
        })

        return songList
    }

    private static loadShowData(showName: string) {
        const showsPath = getDocumentsFolder()
        const showPath: string = path.join(showsPath, `${showName}.show`)
        const jsonData = readFile(showPath) || "{}"
        return parseShow(jsonData)
    }
}

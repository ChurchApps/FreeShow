import { ToMain } from "../../types/IPC/ToMain"
import { stores } from "../data/store"
import { sendToMain } from "../IPC/main"
import { getDocumentsFolder, parseShow, readFile } from "../utils/files"
import path from "path"
import { ChumsConnect } from "./ChumsConnect"
import type { ChumsSongData } from "./types"

export class ChumsExport {
  public static async sendSongsToChums(): Promise<void> {
    const songData = this.getChumsSongData()
    const batchSize = 10

    // Send the data in batches
    for (let i = 0; i < songData.length; i += batchSize) {
      const batch = songData.slice(i, i + batchSize)
      console.log("Sending batch", batch)
      await ChumsConnect.apiRequest({
        api: "content",
        authenticated: true,
        scope: "plans",
        endpoint: "/songs/import",
        method: "POST",
        data: batch
      })
    }

    sendToMain(ToMain.TOAST, "Synced song library to Chums")
  }

  private static getChumsSongData(): ChumsSongData[] {
    const songList: ChumsSongData[] = []
    const shows = stores.SHOWS.store as { [key: string]: any }

    Object.keys(shows).forEach((key: string) => {
      const show = shows[key]
      if (show.category === "song") {
        const showData = this.loadShowData(show.name)
        if (showData) {
          const songData: ChumsSongData = {
            freeShowId: key,
            title: showData[1].meta?.title || showData[1].name || "",
            artist: showData[1].meta?.artist || "",
            lyrics: "",
            ccliNumber: showData[1].meta?.CCLI || ""
          }

          // Add lyrics
          Object.keys(showData[1].slides).forEach((slideKey: string) => {
            const slide = showData[1].slides?.[slideKey]
            slide.items.forEach((item: any) => {
              item.lines.forEach((line: any) => {
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

  private static loadShowData(showName: string): any {
    const showsPath = getDocumentsFolder()
    const showPath: string = path.join(showsPath, `${showName}.show`)
    const jsonData = readFile(showPath) || "{}"
    return parseShow(jsonData)
  }
} 
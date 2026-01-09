/**
 * WARNING: This file should ONLY be accessed through ChurchAppsImport.
 * Do not import or use this class directly in other parts of the application.
 */

import { uid } from "uid"
import type { Media, Show, Slide, SlideData } from "../../../types/Show"
import type { FeedFile } from "./types"

/**
 * Builds FreeShow Show objects from ChurchApps data.
 */
export class ChurchAppsShowBuilder {
    private static readonly ITEM_STYLE = "left:50px;top:120px;width:1820px;height:840px;"

    public static parseLyrics(lyrics: string): { label: string; lyrics: string }[] {
        if (!lyrics) return []
        if (!lyrics.startsWith("[")) return [{ label: "Lyrics", lyrics }]

        const sections: { label: string; lyrics: string }[] = []
        const lines = lyrics.split("\n")
        lines.forEach((line) => {
            if (line.startsWith("[") && line.endsWith("]")) {
                sections.push({ label: line.slice(1, -1), lyrics: "" })
            } else {
                const lastSection = sections[sections.length - 1]
                if (lastSection) lastSection.lyrics += line + "\n"
            }
        })
        return sections
    }

    public static createSongShow(
        arrangementKey: any,
        arrangement: any,
        song: any,
        songDetails: any,
        sections: { label: string; lyrics: string }[]
    ): { showId: string; show: Show; seconds: number } {
        const slides: { [key: string]: Slide } = {}
        const layoutSlides: SlideData[] = []

        sections.forEach((section) => {
            const linesPerPage = 2
            const pages: { lines: string[] }[] = []
            const allLines = section.lyrics.split("\n").filter((line: string) => line.trim() !== "")

            allLines.forEach((line: string, index: number) => {
                if (index % linesPerPage === 0) pages.push({ lines: [] })
                pages[pages.length - 1].lines.push(line)
            })

            pages.forEach((page) => {
                const slideId = uid()
                slides[slideId] = {
                    group: section.label,
                    globalGroup: section.label.toLowerCase(),
                    color: null,
                    settings: {},
                    notes: "",
                    items: [
                        {
                            style: this.ITEM_STYLE,
                            lines: page.lines.map((a: string) => ({
                                align: "",
                                text: [{ style: "", value: a }]
                            }))
                        }
                    ]
                }
                layoutSlides.push({ id: slideId })
            })
        })

        const title = `${songDetails.title} (${arrangement.name} - ${arrangementKey.keySignature})`
        const layoutId = uid()
        const show: Show = {
            name: title || "",
            category: "churchapps",
            timestamps: {
                created: new Date(song.dateAdded).getTime() || Date.now(),
                modified: new Date(song.dateAdded).getTime() || null,
                used: null
            },
            meta: {
                title,
                author: songDetails.artist || "",
                publisher: "",
                copyright: "",
                CCLI: "",
                key: songDetails.keySignature || ""
            },
            settings: { activeLayout: layoutId, template: null },
            layouts: {
                [layoutId]: {
                    name: "Default",
                    notes: song.notes || "",
                    slides: layoutSlides
                }
            },
            slides,
            media: {}
        }

        const showId = arrangement.freeShowId || `chumssong_${arrangementKey.id}`
        return { showId, show, seconds: songDetails.seconds || 0 }
    }

    public static createEmptyShow(id: string, title: string, description: string, seconds: number): { showId: string; show: Show; seconds: number } {
        const layoutId = uid()
        const show: Show = {
            name: title || "",
            category: "churchapps",
            timestamps: { created: Date.now(), modified: null, used: null },
            meta: { title, author: "", publisher: "", copyright: "", CCLI: "", key: "" },
            settings: { activeLayout: layoutId, template: null },
            layouts: {
                [layoutId]: {
                    name: "Default",
                    notes: description || "",
                    slides: []
                }
            },
            slides: {},
            media: {}
        }

        return { showId: `chumsshow_${id}`, show, seconds: seconds || 0 }
    }

    public static createMediaShow(item: any, files: FeedFile[]): { showId: string; show: Show; seconds: number } {
        const layoutId = uid()
        const slides: { [key: string]: Slide } = {}
        const layoutSlides: SlideData[] = []
        const media: { [key: string]: Media } = {}

        files.forEach((file) => {
            const slideId = uid()
            const mediaId = uid()
            const fileUrl = file.url || file.streamUrl || ""
            const isVideo = file.fileType === "video" || fileUrl.endsWith(".mp4") || fileUrl.includes("/externalVideos/download/") || !!file.streamUrl

            media[mediaId] = {
                name: file.name || "",
                path: fileUrl,
                type: isVideo ? "video" : "image",
                loop: file.loopVideo || false
            }

            slides[slideId] = {
                group: item.label,
                color: null,
                settings: {},
                notes: "",
                items: []
            }

            layoutSlides.push({ id: slideId, background: mediaId })
        })

        const show: Show = {
            name: item.label || "",
            category: "churchapps",
            timestamps: { created: Date.now(), modified: null, used: null },
            meta: { title: item.label },
            settings: { activeLayout: layoutId, template: null },
            layouts: {
                [layoutId]: {
                    name: "Default",
                    notes: item.description || "",
                    slides: layoutSlides
                }
            },
            slides,
            media
        }

        const prefix = item.itemType === "lessonSection" ? "chumslesson" : "chumsaction"
        return { showId: `${prefix}_${item.id}`, show, seconds: item.seconds || 0 }
    }
}

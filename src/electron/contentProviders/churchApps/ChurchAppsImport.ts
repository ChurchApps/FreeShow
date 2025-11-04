/**
 * WARNING: This file should ONLY be accessed through ChurchAppsProvider.
 * Do not import or use this class directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchAppsProvider instead.
 */

import { uid } from "uid"
import { ToMain } from "../../../types/IPC/ToMain"
import type { Show, Slide, SlideData } from "../../../types/Show"
import { sendToMain } from "../../IPC/main"
import { ChurchAppsConnect } from "./ChurchAppsConnect"

/**
 * Handles importing service plans and songs from ChurchApps.
 * Converts ChurchApps service plans and songs into FreeShow shows and projects.
 */
export class ChurchAppsImport {
    private static projects: any[] = []
    private static shows: Show[] = []

    public static async loadServices(): Promise<void> {
        this.projects = []
        this.shows = []
        // console.log("Loading services from ChurchApps")

        const SERVICE_PLANS = await ChurchAppsConnect.apiRequest({
            api: "doing",
            authenticated: true,
            scope: "plans",
            endpoint: "/plans/presenter",
        })

        if (!SERVICE_PLANS[0]?.id) return

        await Promise.all(
            SERVICE_PLANS.map(async (plan: any) => {
                await this.loadPlanItems(plan)
            })
        )

        sendToMain(ToMain.TOAST, `Loaded ${this.projects.length} service(s) from ChurchApps`)
        sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "churchApps", categoryName: "ChurchApps", shows: this.shows, projects: this.projects })
    }

    private static async loadPlanItems(plan: any): Promise<void> {
        const projectItems: any[] = []
        const planItems: any = await ChurchAppsConnect.apiRequest({
            api: "doing",
            authenticated: false,
            scope: "plans",
            endpoint: `/planItems/presenter/${plan.churchId}/${plan.id}`,
        })

        if (!planItems?.length) return

        for (const pi of planItems) {
            projectItems.push({
                type: "section",
                id: uid(5),
                name: pi.label || "",
                scheduleLength: pi.seconds,
                notes: pi.description || "",
            })

            for (const child of pi.children) {
                if (child.itemType === "arrangementKey") {
                    const { showId, show, seconds } = await this.loadArrangementKey(child.churchId, child.relatedId)
                    if (showId && show) {
                        this.shows.push({ id: showId, ...show })
                        projectItems.push({ type: "show", id: showId, scheduleLength: seconds })
                    }
                } else {
                    const { showId, show, seconds } = this.getEmptyShow(child.id, child.label, child.description, child.seconds)
                    if (showId && show) {
                        this.shows.push({ id: showId, ...show })
                        projectItems.push({ type: "show", id: showId, scheduleLength: seconds })
                    }
                }
            }
        }

        const projectData = {
            id: plan.id,
            name: plan.name,
            scheduledTo: new Date(plan.serviceDate).getTime(),
            created: new Date(plan.serviceDate).getTime(),
            folderId: "",
            folderName: "",
            items: projectItems,
        }

        if (Object.keys(projectData).length) this.projects.push(projectData)
    }

    private static async loadArrangementKey(churchId: string, arrangementId: string) {
        let data: any = {}
        try {
            data = await ChurchAppsConnect.apiRequest({
                api: "content",
                authenticated: false,
                scope: "plans",
                endpoint: "/arrangementKeys/presenter/" + churchId + "/" + arrangementId,
            })
        } catch (err) {
            console.error("ERROR!!", err)
        }

        if (!data?.arrangementKey) return { showId: "", show: null, seconds: 0 }

        const sections = this.parseLyrics(data.arrangement.lyrics)
        return this.getShow(data.arrangementKey, data.arrangement, data.song, data.songDetail, sections)
    }

    private static parseLyrics(lyrics: string): any[] {
        if (!lyrics) return []
        if (!lyrics.startsWith("[")) return [{ label: "Lyrics", lyrics }]

        const sections: any[] = []
        const lines = lyrics.split("\n")
        lines.forEach((line) => {
            if (line.startsWith("[") && line.endsWith("]")) {
                const label = line.slice(1, -1)
                sections.push({ label, lyrics: "" })
            } else {
                const lastSection = sections[sections.length - 1]
                if (lastSection) lastSection.lyrics += line + "\n"
            }
        })
        return sections
    }

    private static getShow(ARRANGEMENT_KEY: any, ARRANGEMENT: any, SONG: any, SONG_DETAILS: any, SECTIONS: any[]) {
        const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"
        const slides: { [key: string]: Slide } = {}
        const layoutSlides: SlideData[] = []

        SECTIONS.forEach((section) => {
            const linesPerPage = 2
            const pages: { lines: string[] }[] = []
            let allLines = section.lyrics.split("\n")
            allLines = allLines.filter((line: string) => line.trim() !== "")

            allLines.forEach((line: string, index: number) => {
                if (index % linesPerPage === 0) pages.push({ lines: [] })
                pages[pages.length - 1].lines.push(line)
            })

            pages.forEach((page: any) => {
                const slideId = uid()
                const items = [
                    {
                        style: itemStyle,
                        lines: page.lines.map((a: string) => ({
                            align: "",
                            text: [{ style: "", value: a }],
                        })),
                    },
                ]

                slides[slideId] = {
                    group: section.label,
                    globalGroup: section.label.toLowerCase(),
                    color: null,
                    settings: {},
                    notes: "",
                    items,
                }
                layoutSlides.push({ id: slideId })
            })
        })

        const title = `${SONG_DETAILS.title} (${ARRANGEMENT.name} - ${ARRANGEMENT_KEY.keySignature})`
        const metadata = {
            title,
            author: SONG_DETAILS.artist || "",
            publisher: "",
            copyright: "",
            CCLI: "",
            key: SONG_DETAILS.keySignature || "",
            BPM: SONG_DETAILS.bpm || "",
        }

        const layoutId = uid()
        const show: Show = {
            name: title || "",
            category: "churchApps",
            timestamps: {
                created: new Date(SONG.dateAdded).getTime() || Date.now(),
                modified: new Date(SONG.dateAdded).getTime() || null,
                used: null,
            },
            meta: metadata,
            settings: {
                activeLayout: layoutId,
                template: null,
            },
            layouts: {
                [layoutId]: {
                    name: "Default",
                    notes: SONG.notes || "",
                    slides: layoutSlides,
                },
            },
            slides,
            media: {},
        }

        const showId = ARRANGEMENT.freeShowId || `chumssong_${ARRANGEMENT_KEY.id}`
        return { showId, show, seconds: SONG_DETAILS.seconds || 0 }
    }

    private static getEmptyShow(id: string, title: string, description: string, seconds: number) {
        const slides: { [key: string]: Slide } = {}
        const layoutSlides: SlideData[] = []
        const metadata = {
            title,
            author: "",
            publisher: "",
            copyright: "",
            CCLI: "",
            key: "",
            BPM: "",
        }

        const layoutId = uid()
        const show: Show = {
            name: title || "",
            category: "churchApps",
            timestamps: { created: Date.now(), modified: null, used: null },
            meta: metadata,
            settings: { activeLayout: layoutId, template: null },
            layouts: {
                [layoutId]: {
                    name: "Default",
                    notes: description || "",
                    slides: layoutSlides,
                },
            },
            slides,
            media: {},
        }

        const showId = `chumsshow_${id}`
        return { showId, show, seconds: seconds || 0 }
    }
}

/**
 * WARNING: This file should ONLY be accessed through ChurchAppsProvider.
 * Do not import or use this class directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchAppsProvider instead.
 */

import { uid } from "uid"
import { ToMain } from "../../../types/IPC/ToMain"
import type { Show } from "../../../types/Show"
import { sendToMain } from "../../IPC/main"
import { ChurchAppsConnect } from "./ChurchAppsConnect"
import { ChurchAppsShowBuilder } from "./ChurchAppsShowBuilder"
import type { FeedFile, VenueFeed } from "./types"

export class ChurchAppsImport {
    private static projects: any[] = []
    private static shows: Show[] = []
    private static feedCache: Map<string, VenueFeed> = new Map()
    private static actionFilesMap: Map<string, FeedFile[]> = new Map()
    private static sectionFilesMap: Map<string, FeedFile[]> = new Map()
    private static addOnFilesMap: Map<string, FeedFile[]> = new Map()

    public static async loadServices(): Promise<void> {
        this.projects = []
        this.shows = []
        this.feedCache.clear()
        this.actionFilesMap.clear()
        this.sectionFilesMap.clear()
        this.addOnFilesMap.clear()

        const SERVICE_PLANS = await ChurchAppsConnect.apiRequest({
            api: "doing",
            authenticated: true,
            scope: "plans",
            endpoint: "/plans/presenter"
        })

        if (!SERVICE_PLANS?.[0]?.id) return

        await Promise.all(SERVICE_PLANS.map(async (plan: any) => this.loadPlanItems(plan)))

        sendToMain(ToMain.TOAST, `Loaded ${this.projects.length} service(s) from ChurchApps`)
        sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "churchApps", categoryName: "ChurchApps", shows: this.shows, projects: this.projects })
    }

    private static async loadPlanItems(plan: any): Promise<void> {
        const projectItems: any[] = []
        const planItems: any = await ChurchAppsConnect.apiRequest({
            api: "doing",
            authenticated: false,
            scope: "plans",
            endpoint: `/planItems/presenter/${plan.churchId}/${plan.id}`
        })

        if (plan.contentType === "venue" && plan.contentId) await this.fetchVenueFeed(plan.contentId)

        if (planItems?.length) {
            for (const pi of planItems) {
                projectItems.push({
                    type: "section",
                    id: uid(5),
                    name: pi.label || "",
                    scheduleLength: pi.seconds,
                    notes: pi.description || ""
                })

                for (const child of pi.children || []) {
                    const result = await this.processChildItem(child)
                    if (result) {
                        this.shows.push({ id: result.showId, ...result.show })
                        projectItems.push({ type: "show", id: result.showId, scheduleLength: result.seconds })
                    }
                }
            }
        } else if (plan.contentType === "venue" && plan.contentId) {
            const feed = this.feedCache.get(plan.contentId)
            if (feed?.sections) {
                for (const section of feed.sections) {
                    projectItems.push({
                        type: "section",
                        id: uid(5),
                        name: section.name || "",
                        scheduleLength: 0,
                        notes: ""
                    })

                    for (const action of section.actions || []) {
                        const actionType = action.actionType?.toLowerCase()
                        if ((actionType === "play" || actionType === "add-on") && action.files?.length) {
                            const item = {
                                id: action.id || uid(5),
                                label: action.content || section.name || "",
                                itemType: "lessonAction",
                                relatedId: action.id,
                                seconds: action.files.reduce((sum: number, f: FeedFile) => sum + (f.seconds || 0), 0)
                            }
                            const result = ChurchAppsShowBuilder.createMediaShow(item, action.files)
                            if (result) {
                                this.shows.push({ id: result.showId, ...result.show })
                                projectItems.push({ type: "show", id: result.showId, scheduleLength: result.seconds })
                            }
                        }
                    }
                }
            }
        }

        if (projectItems.length > 0) {
            this.projects.push({
                id: plan.id,
                name: plan.name,
                scheduledTo: new Date(plan.serviceDate).getTime(),
                created: new Date(plan.serviceDate).getTime(),
                folderId: "",
                folderName: "",
                items: projectItems
            })
        }
    }

    private static async processChildItem(child: any): Promise<{ showId: string; show: Show; seconds: number } | null> {
        switch (child.itemType) {
            case "arrangementKey":
                return this.loadArrangementKey(child.churchId, child.relatedId)
            case "lessonSection":
                return this.getLessonShow(child)
            case "lessonAction":
            case "lessonAddOn":
                return this.getLessonActionShow(child)
            case "item":
            case "header":
                return ChurchAppsShowBuilder.createEmptyShow(child.id, child.label, child.description, child.seconds)
            default:
                return null
        }
    }

    private static async loadArrangementKey(churchId: string, arrangementId: string): Promise<{ showId: string; show: Show; seconds: number } | null> {
        let data: any = {}
        try {
            data = await ChurchAppsConnect.apiRequest({
                api: "content",
                authenticated: false,
                scope: "plans",
                endpoint: "/arrangementKeys/presenter/" + churchId + "/" + arrangementId
            })
        } catch (err) {
            console.error(err)
        }

        if (!data?.arrangementKey) return null

        const sections = ChurchAppsShowBuilder.parseLyrics(data.arrangement.lyrics)
        return ChurchAppsShowBuilder.createSongShow(data.arrangementKey, data.arrangement, data.song, data.songDetail, sections)
    }

    private static async fetchVenueFeed(venueId: string): Promise<VenueFeed | null> {
        if (this.feedCache.has(venueId)) return this.feedCache.get(venueId)!

        const data = await ChurchAppsConnect.apiRequest({
            api: "lessons",
            authenticated: false,
            scope: "plans",
            endpoint: `/venues/public/feed/${venueId}`
        })

        if (data) {
            this.feedCache.set(venueId, data)
            this.buildFileMaps(data)
        }
        return data
    }

    private static buildFileMaps(feed: VenueFeed): void {
        for (const addOn of feed.files || []) {
            if (addOn.id && addOn.files?.length) this.addOnFilesMap.set(addOn.id, addOn.files)
        }

        for (const section of feed.sections || []) {
            const sectionFiles: FeedFile[] = []
            for (const action of section.actions || []) {
                const actionType = action.actionType?.toLowerCase()
                if (actionType === "play" || actionType === "add-on") {
                    const files = action.files || []
                    if (action.id && files.length > 0) this.actionFilesMap.set(action.id, files)
                    sectionFiles.push(...files)
                }
            }
            if (section.id && sectionFiles.length > 0) this.sectionFilesMap.set(section.id, sectionFiles)
        }
    }

    private static getLessonShow(item: any): { showId: string; show: Show; seconds: number } | null {
        const files = this.sectionFilesMap.get(item.relatedId)
        if (!files?.length) return null
        return ChurchAppsShowBuilder.createMediaShow(item, files)
    }

    private static async getLessonActionShow(item: any): Promise<{ showId: string; show: Show; seconds: number } | null> {
        let files = this.actionFilesMap.get(item.relatedId)

        if (!files?.length && item.itemType === "lessonAddOn") {
            files = this.addOnFilesMap.get(item.relatedId)

            if (!files?.length && item.relatedId) {
                const addOnData = await this.fetchAddOn(item.relatedId)
                if (addOnData) {
                    files = addOnData
                    this.addOnFilesMap.set(item.relatedId, files)
                }
            }
        }

        if (!files?.length) return null
        return ChurchAppsShowBuilder.createMediaShow(item, files)
    }

    private static async fetchAddOn(addOnId: string): Promise<FeedFile[] | null> {
        const data = await ChurchAppsConnect.apiRequest({
            api: "lessons",
            authenticated: false,
            scope: "plans",
            endpoint: `/addOns/public/${addOnId}`
        })

        if (!data) return null

        const files: FeedFile[] = []
        if (data.video) {
            files.push({
                name: data.name || "",
                url: `https://api.lessons.church/externalVideos/download/${data.video.id}`,
                streamUrl: data.video.videoId ? `https://vimeo.com/${data.video.videoId}` : undefined,
                seconds: data.video.seconds,
                loopVideo: data.video.loopVideo,
                fileType: "video"
            })
        } else if (data.file) {
            files.push({
                name: data.name || "",
                url: data.file.contentPath,
                fileType: data.file.fileType
            })
        }

        return files.length > 0 ? files : null
    }
}

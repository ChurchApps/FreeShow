import { get } from "svelte/store"
import { uid } from "uid"
import type { ContentFile, ContentProviderId } from "../../electron/contentProviders/base/types"
import { Main } from "../../types/IPC/Main"
import type { Show, Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import { checkName, getLayoutRef } from "../components/helpers/show"
import { requestMain } from "../IPC/main"
import { activeProject, showsCache } from "../stores"
import { newToast } from "../utils/common"

type CanvaPresentationData = {
    designId: string
    presentationName?: string
    providerId?: ContentProviderId
}

const CANVA_EXPORT_TIMEOUT = 120000
const CANVA_PREVIEW_TIMEOUT = 60000

export async function addCanvaPresentationAsShow(data: CanvaPresentationData, options: { projectId?: string | null; index?: number } = {}) {
    try {
        newToast("toast.canva_exporting")

        const showId = uid()
        const show = await createCanvaShow(data, showId)
        history({ id: "UPDATE", newData: { data: show, remember: { project: options.projectId ?? get(activeProject), index: options.index } }, oldData: { id: showId }, location: { page: "show", id: "show" } })
        syncCanvaShowInBatches(showId)
    } catch (error) {
        console.error("Failed to export Canva presentation:", error)
        newToast("Could not export Canva presentation")
    }
}

export async function syncCanvaShow(showId: string) {
    const currentShow = await getCanvaShow(showId)
    const designId = currentShow?.reference?.data?.designId
    if (!currentShow || !designId) return

    try {
        newToast("toast.canva_exporting")

        const slides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId: "canva", key: `presentation:${designId}` }, undefined, CANVA_PREVIEW_TIMEOUT)
        if (!slides?.length) throw new Error("No Canva slides returned")

        const presentationName = currentShow.reference?.data?.presentationName || currentShow.name
        const activeLayoutId = currentShow.settings?.activeLayout || Object.keys(currentShow.layouts || {})[0] || uid()

        const { showSlides, layoutSlides, media } = buildCanvaSlideData(slides, designId)

        const syncedShow: Show = {
            ...currentShow,
            origin: "canva",
            reference: {
                type: "canva",
                data: {
                    ...currentShow.reference?.data,
                    designId,
                    presentationName
                }
            },
            slides: showSlides,
            layouts: {
                ...currentShow.layouts,
                [activeLayoutId]: {
                    ...currentShow.layouts?.[activeLayoutId],
                    slides: layoutSlides
                }
            },
            media: {
                ...Object.fromEntries(Object.entries(currentShow.media || {}).filter(([, m]) => (m as any)?.origin !== "canva")),
                ...media
            },
            timestamps: {
                ...currentShow.timestamps,
                modified: Date.now()
            }
        }

        history({ id: "UPDATE", newData: { data: syncedShow }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
        syncCanvaShowInBatches(showId)
    } catch (error) {
        console.error("Failed to sync Canva show:", error)
        newToast("Could not sync with Canva")
    }
}

async function syncCanvaShowInBatches(showId: string) {
    const currentShow = await getCanvaShow(showId)
    if (!currentShow) return

    const designId = currentShow?.reference?.data?.designId
    if (!designId) return

    try {
        const metadata = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId: "canva", key: `presentation:${designId}` }, undefined, CANVA_PREVIEW_TIMEOUT)
        if (!metadata?.length) return

        const pageNumbers = Array.from({ length: metadata.length }, (_, i) => i + 1)
        const exportedSlides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId: "canva", key: `presentation-export-batch:${designId}:${pageNumbers.join(",")}` }, undefined, CANVA_EXPORT_TIMEOUT)
        if (!exportedSlides?.length) {
            newToast("main.finished")
            return
        }

        const layoutRef = getLayoutRef(showId)
        const updatedMedia: Show["media"] = { ...currentShow.media }
        const updatedLayouts: Show["layouts"] = Object.fromEntries(Object.entries(currentShow.layouts).map(([id, layout]) => [id, { ...layout, slides: [...layout.slides] }]))

        metadata.forEach((slide: ContentFile, index: number) => {
            const exportedSlide = exportedSlides[index] as ContentFile | undefined
            if (!exportedSlide?.url) return

            const targetRef = layoutRef[index]
            if (!targetRef) return

            const mediaId = uid(5)
            const name = slide.name || `Slide ${index + 1}`
            const layoutId = targetRef.layoutId
            const oldBackgroundId = targetRef.data?.background || updatedLayouts[layoutId]?.slides[targetRef.layoutIndex]?.background || ""

            updatedMedia[mediaId] = {
                path: exportedSlide.url,
                name,
                type: "image",
                origin: "canva",
                canva: { designId, pageId: exportedSlide.mediaId || slide.mediaId, index: index + 1, quality: "export" }
            } as any

            updatedLayouts[layoutId].slides[targetRef.layoutIndex] = {
                ...updatedLayouts[layoutId].slides[targetRef.layoutIndex],
                background: mediaId,
                mediaTransition: { type: "none", duration: 0, easing: "linear" }
            }

            if (oldBackgroundId && (updatedMedia[oldBackgroundId] as any)?.origin === "canva") {
                delete updatedMedia[oldBackgroundId]
            }
        })

        const syncedShow: Show = {
            ...currentShow,
            layouts: updatedLayouts,
            media: updatedMedia,
            timestamps: {
                ...currentShow.timestamps,
                modified: Date.now()
            }
        }

        history({ id: "UPDATE", newData: { data: syncedShow }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
        newToast("main.finished")
    } catch (error) {
        console.error("Failed to sync Canva show in batches:", error)
        newToast("Could not sync with Canva")
    }
}

function buildCanvaSlideData(slides: ContentFile[], designId: string) {
    const showSlides: { [key: string]: Slide } = {}
    const layoutSlides: SlideData[] = []
    const media: Show["media"] = {}

    slides.forEach((slide, index) => {
        const slideId = uid()
        const mediaId = uid(5)
        const name = slide.name || `Slide ${index + 1}`

        showSlides[slideId] = { group: name, color: null, settings: {}, notes: "", items: [] }
        media[mediaId] = {
            path: slide.url,
            name,
            type: "image",
            origin: "canva",
            canva: { designId, pageId: slide.mediaId, index: index + 1, quality: "preview" }
        } as any
        layoutSlides.push({ id: slideId, background: mediaId, mediaTransition: { type: "none", duration: 0, easing: "linear" } })
    })

    return { showSlides, layoutSlides, media }
}

async function getCanvaShow(showId: string) {
    if (!get(showsCache)[showId]) await loadShows([showId])

    const currentShow = get(showsCache)[showId]
    if (!currentShow || currentShow.origin !== "canva" || !currentShow.reference?.data?.designId) {
        newToast("Could not sync with Canva")
        return null
    }

    return currentShow
}

async function createCanvaShow({ designId, presentationName = "Canva presentation", providerId = "canva" }: CanvaPresentationData, showId: string): Promise<Show> {
    if (!designId) throw new Error("Missing Canva design ID")

    const slides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId, key: `presentation:${designId}` }, undefined, CANVA_PREVIEW_TIMEOUT)
    if (!slides?.length) throw new Error("No Canva slides returned")

    const layoutId = uid()
    const show = new ShowObj(false, "presentation", layoutId, Date.now(), false)
    show.name = checkName(presentationName, showId)
    show.origin = "canva"
    show.reference = { type: "canva", data: { designId, presentationName } }

    const { showSlides, layoutSlides, media } = buildCanvaSlideData(slides, designId)

    show.slides = showSlides
    show.layouts[layoutId].slides = layoutSlides
    show.media = media

    return show
}

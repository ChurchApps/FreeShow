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
import { newToast, setStatus } from "../utils/common"

type CanvaPresentationData = {
    designId: string
    presentationName?: string
    providerId?: ContentProviderId
}

const CANVA_EXPORT_TIMEOUT = 120000
const CANVA_PREVIEW_TIMEOUT = 60000

export async function addCanvaPresentationAsShow(data: CanvaPresentationData, options: { projectId?: string | null; index?: number } = {}) {
    try {
        newToast("toast.canva_adding")
        const showId = uid()
        const show = await createCanvaShow(data, showId)
        history({ id: "UPDATE", newData: { data: show, remember: { project: options.projectId ?? get(activeProject), index: options.index } }, oldData: { id: showId }, location: { page: "show", id: "show" } })
        newToast("toast.canva_exporting")
        setStatus("canva_exporting", 60)
        syncCanvaShowInBatches(showId)
    } catch (error) {
        console.error("Failed to add Canva presentation as show:", error)
        setStatus("error", 3)
        newToast("toast.canva_add_show_failed")
    }
}

export async function syncCanvaShow(showId: string) {
    const currentShow = await getCanvaShow(showId)
    const designId = currentShow?.reference?.data?.designId
    if (!currentShow || !designId) return

    try {
        newToast("toast.canva_exporting")
        setStatus("canva_exporting", 60)

        const generated = await createCanvaShow({ designId, presentationName: currentShow.reference?.data?.presentationName || currentShow.name }, showId)
        const activeLayoutId = currentShow.settings?.activeLayout || Object.keys(currentShow.layouts || {})[0] || generated.settings.activeLayout
        const generatedLayoutId = generated.settings.activeLayout

        const syncedShow: Show = {
            ...currentShow,
            origin: "canva",
            reference: {
                type: "canva",
                data: {
                    ...currentShow.reference?.data,
                    designId,
                    presentationName: currentShow.reference?.data?.presentationName || generated.reference?.data?.presentationName || currentShow.name
                }
            },
            slides: generated.slides,
            layouts: {
                ...currentShow.layouts,
                [activeLayoutId]: {
                    ...(currentShow.layouts?.[activeLayoutId] || generated.layouts[generatedLayoutId]),
                    slides: generated.layouts[generatedLayoutId].slides
                }
            },
            media: {
                ...Object.fromEntries(Object.entries(currentShow.media || {}).filter(([, media]) => (media as any)?.origin !== "canva")),
                ...generated.media
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
        setStatus("error", 3)
        newToast("toast.canva_sync_failed")
    }
}

async function syncCanvaShowInBatches(showId: string) {
    const currentShow = await getCanvaShow(showId)
    if (!currentShow) return

    const designId = currentShow?.reference?.data?.designId
    if (!designId) return

    try {
        // Get metadata to know slide count
        const metadata = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId: "canva", key: `presentation:${designId}` }, undefined, CANVA_PREVIEW_TIMEOUT)
        if (!metadata?.length) return

        const slideCount = metadata.length
        const pageNumbers = Array.from({ length: slideCount }, (_, i) => i + 1)

        // Request ONE export job for all pages
        const exportedSlides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId: "canva", key: `presentation-export-batch:${designId}:${pageNumbers.join(",")}` }, undefined, CANVA_EXPORT_TIMEOUT)
        if (!exportedSlides?.length) {
            setStatus("synced", 3)
            newToast("main.finished")
            return
        }

        // Build updated show with all new URLs at once
        const layoutRef = getLayoutRef(showId)
        const updatedMedia: Show["media"] = { ...currentShow.media }
        const updatedLayouts: Show["layouts"] = {}

        Object.entries(currentShow.layouts).forEach(([layoutId, layout]) => {
            updatedLayouts[layoutId] = { ...layout, slides: [...layout.slides] }
        })

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
        setStatus("synced", 3)
        newToast("main.finished")
    } catch (error) {
        console.error("Failed to sync Canva show in batches:", error)
        setStatus("error", 3)
        newToast("toast.canva_sync_failed")
    }
}

async function getCanvaShow(showId: string) {
    if (!get(showsCache)[showId]) await loadShows([showId])

    const currentShow = get(showsCache)[showId]
    if (!currentShow || currentShow.origin !== "canva" || !currentShow.reference?.data?.designId) {
        newToast("toast.canva_sync_failed")
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
    show.reference = { type: "canva", data: { designId, presentationName, url: `https://www.canva.com/design/${designId}/view` } }

    const showSlides: { [key: string]: Slide } = {}
    const layoutSlides: SlideData[] = []
    const media: Show["media"] = {}

    slides.forEach((slide: ContentFile, index: number) => {
        const slideId = uid()
        const mediaId = uid(5)
        const name = slide.name || `Slide ${index + 1}`

        showSlides[slideId] = {
            group: name,
            color: null,
            settings: {},
            notes: "",
            items: []
        }

        media[mediaId] = {
            path: slide.url,
            name,
            type: "image",
            origin: "canva",
            canva: { designId, pageId: slide.mediaId, index: index + 1, quality: "preview" }
        } as any

        layoutSlides.push({ id: slideId, background: mediaId, mediaTransition: { type: "none", duration: 0, easing: "linear" } })
    })

    show.slides = showSlides
    show.layouts[layoutId].slides = layoutSlides
    show.media = media

    return show
}

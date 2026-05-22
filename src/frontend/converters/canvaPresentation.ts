import { get } from "svelte/store"
import { uid } from "uid"
import type { ContentFile, ContentProviderId } from "../../electron/contentProviders/base/types"
import { Main } from "../../types/IPC/Main"
import type { Show, Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { clone } from "../components/helpers/array"
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
        const show = await createCanvaShow(data, showId, "preview")
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

        const generated = await createCanvaShow({ designId, presentationName: currentShow.reference?.data?.presentationName || currentShow.name }, showId, "preview")
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

export async function syncCanvaSlide(showId: string, slideIndex: number, options: { silent?: boolean } = {}) {
    const currentShow = await getCanvaShow(showId)
    const designId = currentShow?.reference?.data?.designId
    if (!currentShow || !designId || slideIndex < 0) return

    try {
        if (!options.silent) {
            newToast("toast.canva_exporting")
            setStatus("canva_exporting", 60)
        }

        const exportedSlide = await getCanvaSlide({ designId, presentationName: currentShow.reference?.data?.presentationName || currentShow.name }, slideIndex)
        const layoutRef = getLayoutRef(showId)
        const targetRef = layoutRef[slideIndex]
        if (!targetRef) throw new Error("Missing target slide")

        const layoutId = targetRef.layoutId
        const layout = clone(currentShow.layouts[layoutId])
        const layoutSlide = layout.slides[targetRef.layoutIndex]
        const oldBackgroundId = targetRef.data?.background || layoutSlide?.background || ""

        layout.slides[targetRef.layoutIndex] = {
            ...layoutSlide,
            background: exportedSlide.mediaId,
            mediaTransition: { type: "none", duration: 0, easing: "linear" }
        }

        const syncedShow: Show = {
            ...currentShow,
            slides: {
                ...currentShow.slides,
                [targetRef.id]: exportedSlide.slide
            },
            layouts: {
                ...currentShow.layouts,
                [layoutId]: layout
            },
            media: {
                ...currentShow.media,
                [exportedSlide.mediaId]: exportedSlide.media
            },
            timestamps: {
                ...currentShow.timestamps,
                modified: Date.now()
            }
        }

        if (oldBackgroundId && (syncedShow.media[oldBackgroundId] as any)?.origin === "canva") delete syncedShow.media[oldBackgroundId]

        history({ id: "UPDATE", newData: { data: syncedShow }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
        if (!options.silent) {
            setStatus("synced", 3)
            newToast("main.finished")
        }
    } catch (error) {
        console.error("Failed to sync Canva slide:", error)
        if (!options.silent) {
            setStatus("error", 3)
            newToast("toast.canva_sync_failed")
        }
    }
}

async function syncCanvaShowInBatches(showId: string) {
    const currentShow = await getCanvaShow(showId)
    if (!currentShow) return

    const slideCount = getLayoutRef(showId).length
    for (let index = 0; index < slideCount; index++) {
        await syncCanvaSlide(showId, index, { silent: true })
    }

    setStatus("synced", 3)
    newToast("main.finished")
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

async function createCanvaShow({ designId, presentationName = "Canva presentation", providerId = "canva" }: CanvaPresentationData, showId: string, quality: "preview" | "export" = "export"): Promise<Show> {
    if (!designId) throw new Error("Missing Canva design ID")

    const key = `presentation:${designId}`
    let slides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId, key }, undefined, quality === "preview" ? CANVA_PREVIEW_TIMEOUT : CANVA_EXPORT_TIMEOUT)
    if (!slides?.length) throw new Error("No Canva slides returned")

    const layoutId = uid()
    const show = new ShowObj(false, "presentation", layoutId, Date.now(), false)
    show.name = checkName(presentationName, showId)
    show.origin = "canva"
    show.reference = { type: "canva", data: { designId, presentationName } }

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
            canva: { designId, pageId: slide.mediaId, index: index + 1, quality }
        } as any

        layoutSlides.push({ id: slideId, background: mediaId, mediaTransition: { type: "none", duration: 0, easing: "linear" } })
    })

    show.slides = showSlides
    show.layouts[layoutId].slides = layoutSlides
    show.media = media

    return show
}

async function getCanvaSlide({ designId, presentationName = "Canva presentation", providerId = "canva" }: CanvaPresentationData, slideIndex: number) {
    const slides = await requestMain(Main.GET_PROVIDER_CONTENT, { providerId, key: `presentation-export:${designId}:${slideIndex + 1}` }, undefined, CANVA_EXPORT_TIMEOUT)
    const slide = slides?.[0]
    if (!slide) throw new Error("No Canva slide returned")

    const mediaId = uid(5)
    const name = slide.name || `Slide ${slideIndex + 1}`

    return {
        slide: {
            group: name,
            color: null,
            settings: {},
            notes: "",
            items: []
        } as Slide,
        mediaId,
        media: {
            path: slide.url,
            name,
            type: "image",
            origin: "canva",
            canva: { designId, presentationName, pageId: slide.mediaId, index: slideIndex + 1, quality: "export" }
        } as any
    }
}

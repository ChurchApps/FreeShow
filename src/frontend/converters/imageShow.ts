import { uid } from "uid"
import type { Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { clone } from "../components/helpers/array"
import { getFileName, removeExtension } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { categories, templates } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { get } from "svelte/store"

export function createImageShow({ images, name }: { images: string[]; name: string }) {
    // newToast("Creating show...")

    const categoryId = createCategory("Converted", "presentation", { isArchive: true })

    const layoutId = uid()
    const showId = uid()
    const show = new ShowObj(false, categoryId, layoutId, new Date().getTime(), false)

    const categoryTemplateId = get(categories)[categoryId || ""]?.template || ""
    const categoryTemplate = get(templates)[categoryTemplateId]
    const templateSlideActions = categoryTemplate?.settings?.actions?.length ? clone(categoryTemplate.settings.actions) : null

    if (categoryTemplateId && categoryTemplate) show.settings.template = categoryTemplateId

    show.name = checkName(name, showId)

    const backgrounds: any[] = []
    const slides: { [key: string]: Slide } = {}
    const layoutShows: SlideData[] = []
    let parentSlideId: string = uid()
    images.forEach((path, i) => {
        const slideId = i === 0 ? parentSlideId : uid()
        slides[slideId] = {
            group: i === 0 ? "." : null,
            color: i === 0 ? "" : null,
            settings: {},
            notes: "",
            items: []
        }

        const backgroundId = uid()
        backgrounds.push([backgroundId, path])

        const layoutData: SlideData = { background: backgroundId, mediaTransition: { type: "none", duration: 0, easing: "linear" } as const }
        if (templateSlideActions?.length) layoutData.actions = { slideActions: clone(templateSlideActions) }

        if (i === 0) {
            slides[slideId].children = []
            layoutShows.push({ id: slideId, ...layoutData, children: {} })
        } else {
            slides[parentSlideId].children!.push(slideId)
            layoutShows[0].children![slideId] = layoutData
        }
    })

    show.slides = slides
    show.layouts[layoutId].slides = layoutShows

    backgrounds.forEach(([id, path]) => {
        const media = { path, name: removeExtension(getFileName(path)) }
        show.media[id] = media
    })

    setTempShows([{ id: showId, show }])
}
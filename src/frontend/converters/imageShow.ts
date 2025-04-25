import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { createCategory, setTempShows } from "./importHelpers"
import { checkName } from "../components/helpers/show"
import { getFileName, removeExtension } from "../components/helpers/media"

export function createImageShow({ images, name }: { images: string[]; name: string }) {
    // newToast("Creating show...")

    const categoryId = createCategory("Presentation", "presentation", { isDefault: true })

    const layoutId = uid()
    const showId = uid()
    const show = new ShowObj(false, categoryId, layoutId)

    show.name = checkName(name, showId)

    const backgrounds: any[] = []
    const slides: any = {}
    const layoutShows: any[] = []
    images.forEach((path, i) => {
        const slideId = uid()
        slides[slideId] = {
            group: (i + 1).toString(),
            color: "",
            settings: {},
            notes: "",
            items: [],
        }

        const backgroundId = uid()
        backgrounds.push([backgroundId, path])
        layoutShows.push({
            id: slideId,
            background: backgroundId,
        })
    })

    show.slides = slides
    show.layouts[layoutId].slides = layoutShows

    backgrounds.forEach(([id, path]) => {
        const media = { path, name: removeExtension(getFileName(path)) }
        show.media[id] = media
    })

    setTempShows([{ id: showId, show }])
}

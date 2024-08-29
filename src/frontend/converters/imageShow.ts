import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { createCategory, setTempShows } from "./importHelpers"
import { checkName } from "../components/helpers/show"

export function createImageShow({ images, name }: { images: string[]; name: string }) {
    // newToast("Creating show...")

    let categoryId = createCategory("Presentation", "presentation", { isDefault: true })

    let layoutId = uid()
    let showId = uid()
    let show = new ShowObj(false, categoryId, layoutId)

    show.name = checkName(name, showId)

    let backgrounds: any[] = []
    let slides: any = {}
    let layoutShows: any[] = []
    images.forEach((path, i) => {
        let slideId = uid()
        slides[slideId] = {
            group: (i + 1).toString(),
            color: "",
            settings: {},
            notes: "",
            items: [],
        }

        let backgroundId = uid()
        backgrounds.push([backgroundId, path])
        layoutShows.push({
            id: slideId,
            background: backgroundId,
        })
    })

    show.slides = slides
    show.layouts[layoutId].slides = layoutShows

    backgrounds.forEach(([id, path]) => {
        let media = { path }
        show.media[id] = media
    })

    setTempShows([{ id: showId, show }])
}

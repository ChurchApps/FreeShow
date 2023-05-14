import { get } from "svelte/store"
import { uid } from "uid"
import { changeLayout, changeSlideGroups } from "../../show/slides"
import { activeDrawerTab, activePage, activeProject, activeShow, audioExtensions, drawerTabsData, imageExtensions, media, projects, showsCache, videoExtensions } from "../../stores"
import { addItem } from "../edit/scripts/addItem"
import { clone } from "./array"
import { history, historyAwait } from "./history"
import { getExtension, getFileName, getMediaType, removeExtension } from "./media"
import { addToPos, getIndexes, mover } from "./mover"
import { _show } from "./shows"

function getId(drag: any): string {
    let id: string = ""
    console.log(drag)
    if (drag.id === "slide" || drag.id === "group") return "slide"
    const extension: string = getExtension(drag.data[0].name)
    if (drag.id === "files" && getMediaType(extension) === "audio") return "audio"
    if ((drag.id === "show" && ["media", "image", "video"].includes(drag.data[0].type)) || drag.id === "media" || drag.id === "files" || drag.id === "camera") return "media"
    // if (drag.id === "audio") return "audio"
    // if (drag.id === "global_group") return "global_group"
    return drag.id || id
}

export const dropActions: any = {
    slides: ({ drag, drop }: any, history: any) => dropActions.slide({ drag, drop }, history),
    slide: ({ drag, drop }: any, history: any) => {
        history.location = { page: get(activePage), show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }

        let id: string = getId(drag)
        if (slideDrop[id]) {
            history = slideDrop[id]({ drag, drop }, history)
            return history
        }

        console.log("Missing slide drop action:", drag.id)
        return history
    },
    projects: ({ drag, drop }: any, history: any) => {
        if (drag.id !== "folder" && drag.id !== "project") return
        if (drop.data.type && drop.data.type !== "folder") return

        history.location.page = "show"
        // TODO: move multiple
        let parents = drop.data.path?.split("/") || [""]
        drag.data.forEach(checkData)
        function checkData(data: any) {
            if (data.type === drop.data.type) {
                // itself
                if (data.id === drop.data.id) return
                // child of itself
                if (parents[0] && data.path !== drop.data.path && parents.includes(data.id)) return
            }
            // if ((data.id !== drop.data.id && (parents[0] === "" || data.path === drop.data.path || !parents.includes(data.id))) || data.type !== drop.data.type) {

            history.oldData = { id: data.id }

            if (data.type === "folder") {
                history.id = "UPDATE"
                history.location.id = "project_folder_key"
                return
            }

            history.id = "UPDATE"
            history.location.id = "project_key"
        }

        history.newData = { key: "parent", data: drop.data.id || "/" }

        return history
    },
    project: ({ drag, drop }: any, history: any) => {
        history.id = "UPDATE"
        history.location = { page: "show", id: "project_ref" }
        history.oldData = { id: get(activeProject) }

        let projectShows = get(projects)[history.oldData.id]?.shows || []

        if (drop.index === undefined) drop.index = projectShows.length
        if (drag.id === "files" && drop.trigger?.includes("end")) drop.index++

        let data: any[] = drag.data
        if (drag.id === "media" || drag.id === "files") {
            data = data
                .map((a: any) => {
                    const extension: string = getExtension(a.path || a.name)
                    if (drag.id === "files" && !files[drop.id].includes(extension)) return null

                    let type: string = getMediaType(extension)

                    let name: string = a.name || getFileName(a.path)
                    return { name: removeExtension(name), id: a.path, type }
                })
                .filter((a: any) => a)
        } else if (drag.id === "audio") {
            data = data.map((a: any) => ({ id: a.path, name: removeExtension(a.name), type: "audio" }))
        } else if (drag.id === "player") {
            data = data.map((a: any) => ({ id: a, type: "player" }))
        }

        history.newData = { key: "shows", data: [] }
        if (drag.id === "show") history.newData.data = mover(projectShows, getIndexes(data), drop.index)
        else history.newData.data = addToPos(projectShows, data, drop.index)

        return history
    },
    all_slides: ({ drag, drop }: any, history: any) => {
        history.location = { page: "show" }

        if (drag.id === "template") {
            history.id = "TEMPLATE"

            // TODO: add slide
            // if (trigger) location.layoutSlide = index
            let indexes: number[] = []
            if (drop.center) indexes.push(drop.index)
            history.newData = { id: drag.data[0], data: { createItems: true }, indexes }
        }

        return history
    },
    navigation: ({ drag, drop }: any, h: any) => {
        if (drop.data !== "all" && get(activeDrawerTab) && (drag.id === "show" || drag.id === "show_drawer")) {
            h.id = "SHOWS"
            let data = drop.data === "unlabeled" ? null : drop.data
            let showsList: any[] = drag.data.map(({ id }) => ({ show: { category: data }, id }))
            h.newData = { replace: true, data: showsList }
            h.location = { page: "drawer" }
            historyAwait(
                drag.data.map(({ id }) => id),
                h
            )
            return
        }

        if (drop.data === "favourites" && drag.id === "media") {
            drag.data.forEach((card: any) => {
                let path: string = card.path || card.id
                media.update((a: any) => {
                    if (!a[path]) a[path] = { filter: "" }
                    a[path].favourite = true
                    return a
                })
            })

            // return history
        }

        if (drop.data !== "all" && (drag.id === "overlay" || drag.id === "template")) {
            drag.data.forEach((id: any) => {
                history({
                    id: "UPDATE",
                    oldData: { id },
                    newData: { key: "category", data: drop.data === "unlabeled" ? null : drop.data },
                    location: { page: "drawer", id: drag.id + "_category" },
                })
            })

            // return history
        }
    },
    templates: ({ drag, drop }: any) => {
        if (drag.id !== "slide") return

        drag.data.forEach(({ index }: any) => {
            let ref: any = _show().layouts("active").ref()[0][index]
            let slides: any[] = _show().get().slides
            let slide: any = ref.type === "child" ? slides[ref.parent.id] : slides[ref.id]
            let activeTab: string | null = get(drawerTabsData).templates?.activeSubTab
            let data: any = {
                name: slide.group || "",
                color: slide.color || "",
                category: activeTab === "all" || activeTab === "unlabeled" ? null : activeTab,
                items: slide.items,
            }
            history({ id: "UPDATE", newData: { data }, location: { page: "drawer", id: drop.id.slice(0, -1) } })
        })
    },
    overlays: ({ drag, drop }: any) => dropActions.templates({ drag, drop }),
    edit: ({ drag }: any) => {
        if (drag.id !== "media") return
        drag.data.forEach(({ path }: any) => addItem("media", null, { src: path }))
    },
}

// "show", "project"
const fileDropExtensions: any = [...get(imageExtensions), ...get(videoExtensions), ...get(audioExtensions)]

const files: any = {
    project: fileDropExtensions,
    slides: fileDropExtensions,
    slide: fileDropExtensions,
}

const slideDrop: any = {
    media: ({ drag, drop }: any, history: any) => {
        let data: any[] = drag.data
        // TODO: move multiple add to possible slides

        // check files
        if (drag.id === "files") {
            data = []
            drag.data.forEach((a: any) => {
                const extension: string = getExtension(a.name)
                if (files[drop.id].includes(extension)) {
                    data.push({
                        path: a.path,
                        name: removeExtension(a.name),
                        type: getMediaType(extension),
                    })
                }
            })
        } else if (drag.id === "camera") data[0].type = "camera"
        else if (!data[0].name) data[0].name = data[0].path

        if (drop.center) {
            history.id = "showMedia"

            if (drop.trigger?.includes("end")) drop.index!--
            history.location.layoutSlide = drop.index
            let newData = { ...data[0], path: data[0].path || data[0].id }
            delete newData.index
            delete newData.id
            history.newData = newData

            return history
        }

        history.id = "SLIDES"
        let slides: any[] = drag.data.map((a: any) => ({ id: a.id || uid(), group: removeExtension(a.name || ""), color: null, settings: {}, notes: "", items: [] }))

        history.newData = { index: drop.index, data: slides, layout: { backgrounds: data } }

        return history
    },
    audio: ({ drag, drop }: any, h: any) => {
        h.id = "showAudio"

        if (drop.trigger?.includes("end")) drop.index!--
        h.location.layoutSlide = drop.index

        drag.data.forEach((audio: any) => {
            // TODO: drop both audio & video files...
            h.newData = { name: audio.name || audio.path, path: audio.path, type: "audio" }
            history(h)
        })
    },
    slide: ({ drag, drop }: any, history: any) => {
        history.id = "slide"
        let ref: any[] = _show().layouts("active").ref()[0]

        let slides = _show().get().slides
        let oldLayout = _show().layouts("active").get()[0].slides
        history.oldData = clone({ layout: oldLayout, slides })

        // end of layout
        if (drop.index === undefined) drop.index = ref.length

        let newIndex: number = drop.index
        let moved: any[] = []
        let sortedLayout: any[] = []

        if (drag.id === "slide") {
            let selected: number[] = getIndexes(drag.data)

            // let moveIntoChild: string = ""

            // move all children when parent is moved
            selected.forEach(selectChildren)
            function selectChildren(index: number) {
                if (ref[index].type !== "parent") return
                console.log(newIndex, index, ref[index].children)
                let children: string[] = ref[index].children || []
                if (!children) return

                // let parentMovedToOwnChildren = newIndex > index && newIndex - 1 <= index + children.length

                // // select children
                // if (parentMovedToOwnChildren) {
                //     // moveIntoChild = ref[index].id
                //     return
                // }

                children.map((_id: string, childIndex: number) => selected.push(index + childIndex + 1))
                selected = [...new Set(selected)]
            }

            sortedLayout = mover(ref, selected, drop.index)

            ref = ref.filter((a: any, i: number) => {
                if (!selected.includes(i)) return true
                if (i < drop.index!) newIndex--
                moved.push(a)
                return false
            })
        } else if (drag.id === "group") {
            if (drop.center) {
                if (drop.trigger?.includes("end")) newIndex--
                ref.splice(drop.index, 1)
            }

            moved = drag.data.map(({ index, id }: any) => ref[index] || { type: "parent", id })
            sortedLayout = addToPos(ref, moved, newIndex)
        }

        // sort layout ref
        let newLayoutRef: any[] = addToPos(ref, moved, newIndex)

        // TODO: dragging a current group on child will not remove old children
        // TODO: dragging a parent slide over its own childs will not change children

        // check if first slide child
        if (newLayoutRef[0].type === "child") newLayoutRef[0].newType = "parent"

        console.log(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
        history.newData = changeLayout(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
        return history
    },
    global_group: ({ drag, drop }: any, history: any) => {
        let ref: any[] = _show().layouts("active").ref()[0]

        if (drop.center) {
            if (drop.trigger?.includes("end")) drop.index--
            changeSlideGroups({ sel: { data: [{ index: drop.index }] }, menu: { id: drag.data[0].globalGroup } })
            return
        }

        history.id = "slide"

        let layoutId: string = _show().get("settings.activeLayout")

        let slides: any = get(showsCache)[get(activeShow)!.id].slides
        let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

        if (drop.index === undefined) drop.index = layout.length
        let newIndex: number = drop.index

        drag.data.forEach((slide: any) => {
            let id = uid()
            delete slide.id
            slides[id] = slide

            let parent = ref[newIndex - 1]
            if (parent.type === "child") parent = parent.parent

            layout = addToPos(layout, [{ id }], parent.index + 1)
        })

        history.newData = { slides, layout }
        history.location.layout = layoutId
        return history
    },
    overlay: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let ref: any = _show().layouts("active").ref()[0][drop.index!]
        let data: any[] = [...new Set([...(ref?.data?.overlays || []), ...drag.data])]

        history.newData = { key: "overlays", data, dataIsArray: true, indexes: [drop.index] }
        return history
    },
    midi: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let ref: any = _show().layouts("active").ref()[0][drop.index!]
        let data: any = ref.data.actions || {}
        let key = drag.data[0].type === "in" ? "receiveMidi" : "sendMidi"
        data[key] = drag.data[0].id

        history.newData = { key: "actions", data, indexes: [drop.index] }
        return history
    },
}

import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Slide, SlideData, Template } from "../../../types/Show"
import { breakLongLines, removeItemValues } from "../../show/slides"
import { activeEdit, activePage, activePopup, activeProject, activeShow, alertMessage, cachedShowsData, deletedShows, groups, notFound, projects, refreshEditSlide, renamedShows, shows, showsCache, templates } from "../../stores"
import { save } from "../../utils/save"
import { EMPTY_SHOW_SLIDE } from "../../values/empty"
import { customActionActivation } from "../actions/actions"
import { getItemText } from "../edit/scripts/textStyle"
import { clone, keysToID } from "./array"
import { history } from "./history"
import { _updaters } from "./historyHelpers"
import { addToPos } from "./mover"
import { getItemsCountByType, isEmptyOrSpecial, mergeWithTemplate, updateLayoutsFromTemplate, updateSlideFromTemplate } from "./output"
import { loadShows, saveTextCache } from "./setShow"
import { getShowCacheId } from "./show"
import { getItemWithMostLines } from "./showActions"
import { _show } from "./shows"

export const historyActions = ({ obj, undo = null }: any) => {
    let data: any = {}
    const initializing: boolean = undo === null

    if (obj) data = obj.newData || {}

    const actions = {
        UPDATE: () => handleUpdate(obj, data, initializing),
        SHOWS: () => handleShows(obj, data, initializing),
        SLIDES: () => handleSlides(obj, data, initializing),
        TEMPLATE: () => handleTemplate(obj, data, initializing),
        SHOW_LAYOUT: () => handleShowLayout(obj, data, initializing),
        SHOW_ITEMS: () => handleShowItems(obj, data, initializing)
    }

    if (obj) console.info("HISTORY " + (initializing ? "INIT" : undo ? "UNDO" : "REDO") + ` [${obj.id}]:`, clone(obj))

    return actions
}

function handleUpdate(obj, data, initializing) {
    if (!obj.location?.id) return errorMsg("no updater id: " + obj.id)
    const updater = _updaters[obj.location.id]
    if (!updater) return errorMsg("missing updater: " + obj.location.id + " for " + obj.id)

    let id = data.id
    const deleting: boolean = id !== undefined

    data = clone(deleting ? obj.oldData : data) || {}

    const key = data.key
    const subkey = data.subkey
    let index = data.index
    const indexes = data.indexes
    const keys = data.keys

    if (!deleting) {
        const empty = !data?.data
        data = { ...data, data: data?.data ?? clone(updater.empty) }
        id = obj.oldData?.id || uid()
        if (keys && !key) id = "keys"

        if (initializing && obj.location.id === "show") customActionActivation("show_created")
        if (initializing && empty && updater.initialize) data.data = updater.initialize(data.data, id)

        if (initializing && obj.location.id === "project_ref") {
            projects.update((a) => {
                if (!a[id]) return a
                a[id].modified = Date.now()
                return a
            })
        }

        if (data.replace) {
            data.data = { ...data.data, ...data.replace }
            delete data.replace
        }
    }

    if (deleting && updater.deselect) {
        const changed: any = updater.deselect(id, data)
        if (changed) data.changed = changed
    }

    updater.store.update((a) => {
        if (deleting) return revertOrDeleteElement(a)
        return updateElement(a)
    })

    if (!deleting && updater.select) updater.select(id, data, initializing)

    if (obj.location?.id === "show_key" && key === "quickAccess") {
        shows.update((a) => {
            if (!a[id]) return a
            if (deleting && data.previousData) a[id].quickAccess = data.previousData
            else a[id].quickAccess = data.data
            return a
        })
    }

    if (!initializing) return

    if (deleting) delete data.id
    obj.newData = deleting ? { id } : data
    obj.oldData = deleting ? data : { id }

    function revertOrDeleteElement(a) {
        const previousData = clone(data.previousData)

        if (key) {
            if (!a[id]) return a
            const keyContent = a[id][key]
            data = { ...data, data: filterIndexes(clone(keyContent), subkey, { indexes, keys }) }
            if (previousData && index !== undefined) index = undefined
            if (previousData !== undefined) return updateKeyData(a, previousData)
            if (subkey && keyContent) delete keyContent[subkey]
            else delete a[id][key]
            return a
        }

        if (keys) {
            const currentData = {}
            keys.forEach((currentKey) => {
                currentData[currentKey] = clone(a[currentKey])
                if (previousData) a[currentKey] = previousData[currentKey] || previousData
                else delete a[currentKey]
            })
            data = { ...data, data: clone(currentData) }
            return a
        }

        data = { ...data, data: clone(a[id]) }
        if (previousData) a[id] = previousData
        else delete a[id]
        return a
    }

    function updateElement(a) {
        if (key) {
            data.previousData = clone(filterIndexes(a[id]?.[key] ?? {}, subkey, { indexes, keys }))
            a = updateKeyData(a, data.data)
        } else if (keys) {
            data.previousData = {}
            keys.forEach((currentKey) => {
                data.previousData[currentKey] = a[currentKey]
                a[currentKey] = data.data[currentKey] || data.data
            })
        } else {
            data.previousData = clone(a[id])
            a[id] = data.data
        }

        if (subkey && index !== undefined && index > -1 && !Array.isArray(a[id]?.[key]?.[subkey])) delete data.previousData
        if (updater.timestamp && a[id]) a[id].modified = Date.now()
        if (data.previousData === data.data) console.warn(obj.id, "HISTORY:", "Previous data is the same as current data. Try using clone()!")
        return a
    }

    function updateKeyData(keyData, newValue) {
        if (!keyData[id]) return keyData

        if (indexes?.length && Array.isArray(keyData[id][key])) {
            if (!keyData[id][key].length && newValue.length) {
                keyData[id][key] = newValue
                return keyData
            }
            keyData[id][key] = keyData[id][key].map((value, i) => {
                if (indexes?.length && !indexes.includes(i)) return value
                const currentIndex = indexes.findIndex((a) => a === i)
                const replacerValue = Array.isArray(newValue) ? newValue[currentIndex] : newValue
                if (subkey) {
                    value[subkey] = replacerValue
                    return value
                }
                return replacerValue
            })
            keyData[id][key] = keyData[id][key].filter((a) => a !== undefined)
            return keyData
        }

        if (keys?.length) {
            keys.forEach((currentKey) => {
                let replacerValue = typeof newValue === "string" || newValue?.[currentKey] === undefined || keyData.dataIsArray ? newValue : newValue[currentKey]
                if (index === -1 && !Array.isArray(replacerValue)) replacerValue = [replacerValue]
                if (subkey) {
                    if (!keyData[id][key]?.[currentKey]) return
                    if (index === -1) {
                        if (!Array.isArray(keyData[id][key][currentKey][subkey])) keyData[id][key][currentKey][subkey] = []
                        keyData[id][key][currentKey][subkey].push(...replacerValue)
                    } else keyData[id][key][currentKey][subkey] = replacerValue
                    return
                }
                if (index === -1) keyData[id][key][currentKey].push(...replacerValue)
                else keyData[id][key][currentKey] = replacerValue
            })
            return keyData
        }

        if (subkey) {
            if (!keyData[id][key]) keyData[id][key] = {}
            if (index !== undefined && Array.isArray(keyData[id][key][subkey])) {
                if (index === -1) keyData[id][key][subkey].push(newValue)
                else keyData[id][key][subkey].splice(index, 0, newValue)
                return keyData
            }
            keyData[id][key][subkey] = newValue
            return keyData
        }

        if (index !== undefined && Array.isArray(keyData[id][key])) {
            if (index === -1) keyData[id][key].push(newValue)
            else keyData[id][key].splice(index, 0, newValue)
            return keyData
        }

        keyData[id][key] = newValue
        return keyData
    }
}

async function handleShows(obj, data, initializing) {
    const showsList = obj.newData?.data || obj.oldData?.data || []
    if (!showsList.length) return

    let replace: boolean = obj.newData?.replace === true
    let deleting = !obj.newData?.data?.length
    const projectImport = obj.newData?.projectImport === true
    if (obj.oldData?.replace) replace = deleting = true

    if (replace && initializing) obj.oldData = { data: clone(obj.newData.data) }

    if (!deleting) {
        showsList.forEach(({ show }, i) => {
            if (!show) return
            let name = show.name
            if (!name) return
            let number = 1
            while (showsList.find((a: any, index: number) => a.show?.name === (number > 1 ? name + " " + number : name) && index !== i)) number++
            name = number > 1 ? name + " " + number : name
            showsList[i].show.name = name
            const deletedIndex = get(deletedShows).findIndex((a) => a.name === name)
            if (deletedIndex > -1) {
                deletedShows.update((a) => {
                    a.splice(deletedIndex, 1)
                    return a
                })
            }
        })
        notFound.set({ show: [], bible: [] })
    }

    const duplicates: string[] = []
    const oldShows: any = {}
    const rename: { [key: string]: { name: string; oldName: string } } = {}

    if (deleting && showsList.length < 20) {
        await loadShows(
            showsList.map((a) => a.id),
            true
        )
    }

    showsCache.update((a) => {
        showsList.forEach(({ show, id }, i: number) => {
            if (deleting) {
                if (replace && show) {
                    a[id] = show
                    return
                }
                if (!a[id]) return
                oldShows[id] = clone(a[id])
                delete a[id]
            } else {
                if (!show) return
                if (projectImport && get(shows)[id]?.locked) return
                if (initializing && !projectImport && get(shows)[id]?.timestamps?.modified && show.timestamps?.modified && get(shows)[id].timestamps.modified! > show.timestamps.modified) return
                if (replace) {
                    if (initializing) obj.oldData.data[i].show = clone(a[id])
                    a[id] = { ...a[id], ...show }
                    const oldName = get(shows)[id]?.name
                    if (show.name !== undefined && oldName && oldName !== show.name) rename[id] = { name: show.name || id, oldName }
                    return
                }
                a[id] = show
                saveTextCache(id, show)
            }
        })
        return a
    })

    shows.update((a) => {
        showsList.forEach(({ show, id }, i) => {
            if (deleting && !replace) {
                if (!obj.oldData?.data[i]?.show) obj.oldData.data[i] = { id, show: oldShows[id] }
                if (!a[id]) return
                deletedShows.set([...get(deletedShows), { id, name: a[id].name }])
                delete a[id]
                return
            }
            if (!show) return
            deletedShows.set(get(deletedShows).filter((deleted) => deleted.id !== id))
            const oldModified = a[id]?.timestamps?.modified || 0
            const newModified = show.timestamps?.modified || 0
            if (initializing && newModified && oldModified > newModified) return
            const oldShow = a[id] ? clone(a[id]) : null
            if (oldShow?.timestamps) delete (oldShow as any).timestamps.used
            a[id] = {
                name: show.name || a[id]?.name || "",
                category: show.category === undefined ? a[id]?.category : show.category,
                timestamps: show.timestamps || a[id]?.timestamps,
                quickAccess: show.quickAccess || a[id]?.quickAccess
            }
            if (show.origin) a[id].origin = ""
            else if (a[id].origin) delete a[id].origin
            if (show.private) a[id].private = true
            else if (a[id].private) delete a[id].private
            if (show.locked) a[id].locked = true
            else if (a[id].locked) delete a[id].locked
            const newShow = clone(a[id])
            if (newShow?.timestamps) delete (newShow as any).timestamps.used
            if (initializing && !replace && oldShow && JSON.stringify(oldShow) !== JSON.stringify(newShow)) duplicates.push(show.name)
        })
        return a
    })

    const renamedIds = Object.keys(rename)
    if (renamedIds.length) {
        const newRenamed = get(renamedShows).filter((a) => !renamedIds.includes(a.id))
        const newRenamedList = keysToID(rename).map((a) => {
            const previous = get(renamedShows).find((r) => r.id === a.id)
            if (!previous) return a
            return { ...a, oldName: previous.oldName }
        })
        renamedShows.set([...newRenamed, ...newRenamedList])
    }

    if (initializing && duplicates.length) {
        let text = "Overwritten " + duplicates.length + " show"
        if (duplicates.length > 1) text += "s"
        setTimeout(() => {
            alertMessage.set(text + ":<br>- " + duplicates.join("<br>- "))
            activePopup.set("alert")
        }, 2000)
    }

    if (!deleting && Object.keys(get(showsCache)).length >= 100) {
        if (initializing) save()
        setTimeout(() => {
            showsCache.set({})
            activeShow.set(null)
        }, 2000)
    }

    if (deleting && initializing && get(activeProject)) {
        const projectItems = get(projects)[get(activeProject)!]?.shows || []
        let newShows = projectItems
        showsList.forEach(({ id }) => {
            newShows = newShows.filter((a) => a.id !== id)
        })
        if (showsList.length < projectItems.length) {
            history({ id: "UPDATE", newData: { key: "shows", data: newShows }, oldData: { id: get(activeProject) }, location: { page: "show", id: "project_key" } })
        }
    }
}

function handleSlides(obj, data, initializing) {
    const deleting = !!obj.oldData
    data = (deleting ? obj.oldData : obj.newData) || {}

    if (initializing) {
        data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
    }

    let slides = clone(data?.data) || []
    const { showId, layout } = data.remember || {}
    if (!showId || !layout) return

    const ref = _show(showId).layouts([layout]).ref()[0] || []
    if (!deleting) data.index = data.index ?? ref.length
    let index = data.index
    const type: "delete" | "delete_group" | "remove" = data.type || "delete"

    if (!deleting) {
        if (data.previousData) {
            _show(showId).set({ key: "slides", value: data.previousData.slides })
            _show(showId).set({ key: "layouts", value: data.previousData.layouts })
            if (data.previousData.media) _show(showId).set({ key: "media", value: data.previousData.media })
            return
        }
        if (data.media) {
            const showMedia = _show(showId).get("media") || {}
            _show(showId).set({ key: "media", value: { ...showMedia, ...data.media } })
        }
        if (!slides.length) {
            slides = [createNewSlide(showId, layout, ref, data, index)]
            data.data = clone(slides)
        }
    } else {
        data.previousData = {
            slides: clone(_show(showId).get("slides")),
            layouts: clone(_show(showId).get("layouts")),
            media: clone(_show(showId).get("media"))
        }
    }

    if (!slides[0]) return

    slides = slides.sort((a, b) => (a.index < b.index ? 1 : -1))
    if (data.layouts) data.layouts.reverse()
    if (data.layout?.backgrounds?.[1]) data.layout.backgrounds.reverse()

    slides.forEach((slide, i) => processSlide(slide, i, { deleting, data, showId, layout, ref, index, type, obj, initializing }))

    if (deleting) {
        if (type === "delete" || type === "delete_group") {
            _show(showId)
                .slides(data.data.map((a) => a.id))
                .remove()
        }
    } else {
        setTimeout(
            () =>
                activeEdit.update((a) => {
                    a.slide = index
                    return a
                }),
            10
        )
    }

    if (!initializing) return
    if (deleting) obj.oldData = clone(data)
    else obj.newData = clone(data)
}

function processSlide(slide, i, { deleting, data, showId, layout, ref, index, type, obj, initializing }) {
    let slideId = slide.id
    delete slide.id
    const slideIndex = slide.index ?? index
    delete slide.index
    const isParent = slide.group !== null
    if (!slideId) {
        slideId = uid()
    }

    if (deleting) removeSlideFromLayout(showId, layout, slideId, slideIndex, isParent, type)
    else addSlideToLayout(slide, slideId, slideIndex, i, showId, layout, ref, data, index, isParent)
}

function removeSlideFromLayout(showId, layout, slideId, slideIndex, isParent, type) {
    showsCache.update((a) => {
        if (!a[showId]?.layouts?.[layout]) return a
        const layoutSlides = a[showId].layouts[layout].slides
        let newSlides = clone(layoutSlides).filter((ls) => ls.id !== slideId)

        if (type === "delete") {
            Object.keys(a[showId].slides).forEach((currentSlideId) => {
                const currentSlide = a[showId].slides[currentSlideId]
                if (!currentSlide) return

                if (currentSlideId !== slideId) {
                    const childIndex = currentSlide.children?.indexOf(slideId) ?? -1
                    if (childIndex >= 0) currentSlide.children!.splice(childIndex, 1)
                    return
                }
                if (isParent) {
                    if (!currentSlide.children?.length) return
                    newSlides = promoteFirstChildInLayout(layoutSlides, slideId, currentSlide, a[showId].slides, newSlides)
                }
            })
        }

        a[showId].layouts[layout].slides = newSlides
        return a
    })
}

function promoteFirstChildInLayout(layoutSlides, slideId, currentSlide, slides, newSlides) {
    const firstChildId = currentSlide.children[0]
    const newChildren = clone(currentSlide.children.slice(1))
    if (!slides[firstChildId]) return newSlides
    slides[firstChildId].globalGroup = currentSlide.globalGroup
    slides[firstChildId].group = currentSlide.group
    slides[firstChildId].color = currentSlide.color
    slides[firstChildId].children = newChildren
    return clone(layoutSlides).map((layoutSlideRef) => {
        if (layoutSlideRef.id !== slideId) return layoutSlideRef
        const newLayoutChildren = clone(layoutSlideRef.children || {})
        const newLayoutRef = { id: firstChildId, ...newLayoutChildren[firstChildId], children: {} }
        delete newLayoutChildren[firstChildId]
        newLayoutRef.children = newLayoutChildren
        return newLayoutRef
    })
}

function addSlideToLayout(slide, slideId, slideIndex, i, showId, layout, ref, data, index, isParent) {
    const slideData = clone(slide)
    if (data.addItems === false) slideData.items = []
    _show(showId).slides([slideId]).add([slideData], isParent)

    const layoutValue = data.layouts?.[i] || {}
    layoutValue.id = slideId

    if (data.layout?.backgrounds?.length) {
        const background = data.layout.backgrounds[i] || data.layout.backgrounds[0]
        const existingBackgrounds = _show(showId).get("media") || {}
        const existingId = Object.keys(existingBackgrounds).find((mediaId) => existingBackgrounds[mediaId].path === background.path)
        const bgId = existingId || _show(showId).media().add(background, "")
        layoutValue.background = bgId
    }

    if (isParent) {
        const refAtIndex = ref[slideIndex - 1]?.parent || ref[slideIndex - 1]
        const slideLayoutIndex = refAtIndex ? refAtIndex.index + 1 : (slideIndex ?? ref.length)
        _show(showId).layouts([layout]).slides([slideLayoutIndex]).add([layoutValue])
        const updatedRef = _show(showId).layouts([layout]).ref()[0] || []
        index = updatedRef.find((a) => a.id === layoutValue.id)?.layoutIndex ?? index
    } else if (slide.oldChild) {
        const parent = ref.find((a) => a.children?.includes(slide.oldChild))
        if (parent) {
            let newChildren = clone(_show(showId).slides([parent.id]).get()[0]?.children || [])
            let oldIndex = newChildren.indexOf(slide.oldChild)
            if (oldIndex < 0) oldIndex = newChildren.length
            newChildren = addToPos(newChildren, [slideId], oldIndex)
            _show(showId).slides([parent.id]).set({ key: "children", value: newChildren })
        } else {
            _show(showId).slides([slideId]).set({ key: "group", value: "" })
            _show(showId)
                .layouts([layout])
                .slides()
                .add([{ ...layoutValue, id: slideId }])
        }
    }
}

function createNewSlide(showId, layout, ref, data, index) {
    const isParent = !ref.length || data.replace?.parent
    const id = data.id || uid()

    if (!isParent) {
        const parent = ref[index - 1]?.parent || ref[index - 1]
        if (parent) {
            const parentSlide = _show(showId).slides([parent.id]).get()[0]
            let value: string[] = [id]
            const childIndex = parent.layoutIndex < index ? index - parent.layoutIndex - 1 : index
            if (parentSlide.children) value = addToPos(parentSlide.children, value, childIndex)
            setTimeout(() => _show(showId).slides([parent.id]).set({ key: "children", value }), 10)
        }
    }

    let items: any[] = data.replace?.items || []
    if (!items.length && ref.length && index - 1 >= 0) {
        items = clone(
            _show(showId)
                .slides([ref[index - 1].id])
                .items()
                .get(null, false)[0]
        )
        items = removeItemValues(items)
    }

    const slide: Slide = clone({ ...EMPTY_SHOW_SLIDE, items })
    if (isParent) slide.globalGroup = "verse"
    else slide.group = null

    return { id, ...slide }
}

function handleTemplate(obj, data, initializing) {
    const deleting = !!obj.oldData
    data = (deleting ? obj.oldData : obj.newData) || {}

    if (initializing) {
        data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
    }

    let show = get(showsCache)[data.remember.showId]
    if (!show) return
    const previousShow: string = JSON.stringify(show)
    let slides = show.slides || {}

    let ref = _show(data.remember.showId).layouts([data.remember.layout]).ref()[0] || []
    const slideId: string = data.indexes ? ref[data.indexes[0]]?.id : ""

    let createItems = !!data.data?.createItems
    const shiftItems = !!data.data?.shiftItems
    const previousTemplateId = show.settings?.template

    if (deleting) {
        const previousData = data.previousData
        if (!previousData) return errorMsg("missing previousData")
        _show(data.remember.showId).set({ key: "slides", value: previousData.slides || {} })
        _show(data.remember.showId).set({ key: "settings.template", value: previousData.template })
    } else {
        data.previousData = clone({ template: previousTemplateId, slides })
        const templateId: string = data.id
        if (templateId && !slideId && previousTemplateId !== templateId) _show(data.remember.showId).set({ key: "settings.template", value: slideId ? null : templateId })

        const template = clone(get(templates)[templateId])
        const maxLines = template?.settings?.maxLinesPerSlide
        if (maxLines !== "0" && !isNaN(Number(maxLines))) {
            slides = splitToMaxLines(Number(maxLines))
            show.slides = slides
        }
        const brLongLines = template?.settings?.breakLongLines
        if (brLongLines !== "0" && !isNaN(Number(brLongLines))) {
            slides = breakLongLines(data.remember.showId, Number(brLongLines))
            show.slides = slides
        }
        updateSlidesWithTemplate(template)
        if (get(activePage) === "edit") refreshEditSlide.set(true)
    }

    cachedShowsData.update((a) => {
        const customId = getShowCacheId(data.remember.showId, null, data.remember.layout)
        if (a[customId]?.template?.slidesUpdated) a[customId].template.slidesUpdated = true
        return a
    })

    if (!initializing) return
    if (deleting) obj.oldData = clone(data)
    else obj.newData = clone(data)

    function splitToMaxLines(maxLines: number) {
        const currentSlides = clone(show.slides) || {}
        if (!maxLines) return currentSlides
        const newSlides: { [key: string]: Slide } = {}
        Object.entries(currentSlides).forEach(([id, slide]) => {
            let childrenIds: string[] = []
            const totalLines = getItemWithMostLines(slide)
            const splitLines = Math.max(totalLines, 1)
            for (let i = 0; i < splitLines; i += maxLines) {
                const newItems: Item[] = []
                slide.items.forEach((item) => {
                    if (!item.lines) {
                        newItems.push(item)
                        return
                    }
                    const lines = clone(item.lines).slice(i, i + maxLines)
                    newItems.push({ ...item, lines })
                })
                const newSlide = { ...clone(slide), group: i === 0 ? slide.group : null, color: i === 0 ? slide.color : null, items: newItems }
                if (i > 0) {
                    delete newSlide.globalGroup
                    delete newSlide.children
                }
                const currentId = i === 0 ? id : uid()
                newSlides[currentId] = newSlide
                if (i > 0) childrenIds.push(currentId)
            }
            if (childrenIds.length) newSlides[id].children = childrenIds
        })
        return newSlides
    }

    function updateSlidesWithTemplate(template: Template) {
        const firstLayoutSlideId = show.layouts?.[data.remember.layout]?.slides?.[0]?.id || ""
        const firstSlideTemplateId = template?.settings?.firstSlideTemplate || ""
        const previousFirstSlideTemplateId = get(templates)[data.previousData?.template || ""]?.settings?.firstSlideTemplate || ""

        Object.entries(slides).forEach(([id, slide]) => {
            if (!slide) return
            const isGroupLocked = !!slide.locked
            if ((slideId && slideId !== id) || !slide || isGroupLocked) return

            let slideTemplate = template
            let templateMode: "global" | "group" | "slide" = "global"
            if (slide.settings?.template) {
                slideTemplate = clone(get(templates)[slide.settings.template]) || template
                const matchesFirstTemplate = !!firstSlideTemplateId && slide.settings.template === firstSlideTemplateId
                const matchesPreviousFirstTemplate = !!previousFirstSlideTemplateId && slide.settings.template === previousFirstSlideTemplateId
                templateMode = matchesFirstTemplate || matchesPreviousFirstTemplate ? "global" : "slide"
            } else {
                const isChild = slide.group === null
                let globalGroup = slide.globalGroup
                if (isChild) {
                    const parent = Object.values(show.slides || {}).find((a) => a?.children?.includes(id))
                    globalGroup = parent?.globalGroup
                }
                if (globalGroup && get(groups)[globalGroup]?.template) {
                    slideTemplate = clone(get(templates)[get(groups)[globalGroup]?.template || ""]) || template
                    templateMode = "group"
                    createItems = true
                }
            }

            const isFirstSlide = templateMode === "global" && id === firstLayoutSlideId
            let appliedFirstOverride = false
            if (isFirstSlide && firstSlideTemplateId) {
                const overrideTemplate = clone(get(templates)[firstSlideTemplateId || ""])
                if (overrideTemplate?.items?.length) {
                    slideTemplate = overrideTemplate
                    appliedFirstOverride = true
                    if (!show.slides[id].settings) show.slides[id].settings = {}
                    show.slides[id].settings.template = firstSlideTemplateId
                }
            } else if (!isFirstSlide && slide.settings?.template === firstSlideTemplateId) {
                if (show.slides[id].settings) {
                    delete show.slides[id].settings.template
                    if (!Object.keys(show.slides[id].settings).length) delete (show.slides[id] as any).settings
                }
            }

            if (!slideTemplate?.items?.length) return
            const newTemplate = data.previousData.template !== data.id
            if (shiftItems && !slide.settings?.template && !newTemplate) slide.items = [...slide.items.slice(1), slide.items[0]].filter((a) => a)
            if (!shiftItems && newTemplate && !slide.settings?.template && slideTemplate.items?.length > 1) {
                const previousTemplateItems = get(templates)[data.previousData.template]?.items || []
                const newTemplateItems = slideTemplate.items || []
                slide.items = clone(rearrangeContent(slide.items, previousTemplateItems, newTemplateItems))
            }

            const changeOverflowItems = !!(slide.settings?.template || createItems)
            const mode = slideTemplate?.settings?.mode
            let newItems = mergeWithTemplate(slide.items, slideTemplate.items, changeOverflowItems, obj.save !== false, createItems, mode, slide.customDynamicValues)

            if (changeOverflowItems) {
                const templateItemCount = getItemsCountByType(slideTemplate.items)
                const slideItemCount = getItemsCountByType(newItems)
                newItems = newItems
                    .reverse()
                    .filter((a) => {
                        const type = a.type || "text"
                        if (templateItemCount[type] - slideItemCount[type] >= 0) return true
                        if (type === "text" && !isEmptyOrSpecial(a)) return true
                        if (type === "media" && a.src) return true
                        slideItemCount[type]--
                        return false
                    })
                    .reverse()
            }

            show.slides[id].items = clone(newItems)
            if (!show.slides[id].settings) show.slides[id].settings = {}
            if (slideTemplate.settings?.backgroundColor) show.slides[id].settings.color = slideTemplate.settings?.backgroundColor

            const isFirst = templateMode === "global" && id === firstLayoutSlideId
            const firstTemplateForUpdate = isFirst && firstSlideTemplateId && (appliedFirstOverride || slide.settings?.template === firstSlideTemplateId) ? firstSlideTemplateId : undefined
            show.slides[id] = updateSlideFromTemplate(show.slides[id], slideTemplate, isFirst, changeOverflowItems, firstTemplateForUpdate)

            const slideRefs = ref.filter((a) => a.id === id)
            const oldTemplate = get(templates)[previousTemplateId || ""] || {}
            slideRefs.forEach((slideRef) => {
                const newLayoutData = updateLayoutsFromTemplate(show.layouts, show.media, slideTemplate, oldTemplate, data.remember.layout, slideRef, templateMode, changeOverflowItems)
                show.layouts = newLayoutData.layouts
                show.media = newLayoutData.media
            })
        })

        if (obj.save === false && JSON.stringify(show) === previousShow) return
        showsCache.update((a) => {
            a[data.remember.showId] = show
            return a
        })
    }
}

function handleShowLayout(obj, data, initializing) {
    const deleting = !!obj.oldData
    data = clone((deleting ? obj.oldData : obj.newData) || {})

    if (initializing) {
        data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
    }

    if (deleting) {
        const previousData = data.previousData
        if (!previousData) return errorMsg("missing previousData")
        _show(data.remember.showId).set({ key: "layouts", value: previousData.layouts || {} })
    } else {
        const show = get(showsCache)[data.remember.showId]
        if (show) data.previousData = { layouts: clone(show.layouts) }
        updateLayoutSlides()
    }

    if (!initializing) return
    if (deleting) obj.oldData = clone(data)
    else obj.newData = clone(data)

    function updateLayoutSlides() {
        showsCache.update((a) => {
            if (!a[data.remember.showId]) return a
            const layoutSlides: SlideData[] = a[data.remember.showId].layouts?.[data.remember.layout].slides || []
            let currentIndex = -1
            layoutSlides.forEach((l, i) => {
                if (!l) return
                if (!a[data.remember.showId].slides[l.id]) {
                    console.error("MISSING SLIDE")
                    return
                }
                currentIndex++
                l = updateValues(l, currentIndex)
                const children = a[data.remember.showId].slides[l.id]?.children
                if (!children?.length) return
                if (!l.children) l.children = {}
                children.forEach((child) => {
                    currentIndex++
                    l.children![child] = updateValues(l.children![child] || {}, currentIndex)
                })
                a[data.remember.showId].layouts[data.remember.layout].slides[i] = l
            })
            return a
        })
    }

    function updateValues(l: any, currentIndex = -1) {
        const indexes: number[] = data.indexes || []
        const valueIndex: number = indexes.findIndex((a) => a === currentIndex)
        if (currentIndex >= 0 && indexes.length && valueIndex < 0) return l
        const keys: string[] = data.keys || [data.key]
        let values = data.data
        if (!Array.isArray(values)) values = [values]
        keys.forEach((key, i) => {
            let value = valueIndex < 0 ? values[i] : data.dataIsArray ? values : data.dataIsArray === false ? values[valueIndex] || values[i] : values[i]?.[valueIndex] || values[valueIndex] || values[i]
            if (!data.dataIsArray && typeof values[i] === "string") value = values[i]
            if (value === undefined) delete l[key]
            else if (data.key && data.keys) {
                if (!l[data.key]) l[data.key] = {}
                l[data.key][key] = value
            } else l[key] = value
        })
        return l
    }
}

function handleShowItems(obj, data, initializing) {
    const deleting = !!obj.oldData
    data = (deleting ? obj.oldData : obj.newData) || {}
    const key: string | null = data.key || null

    if (initializing) {
        data.remember = { showId: data.showId || get(activeShow)?.id }
    }

    if (!deleting) {
        data.previousData = clone(_show(data.remember.showId).slides(data.slides).items(data.items).get()[0])
        _show(data.remember.showId).slides(data.slides).items(data.items).set({ key, values: data.data })
    } else {
        if (!data.previousData) return
        _show(data.remember.showId).slides(data.slides).items(data.items).set({ values: data.previousData })
    }

    if (!initializing) return
    if (deleting) obj.oldData = clone(data)
    else obj.newData = clone(data)
}

function errorMsg(msg = "") {
    console.error("HISTORY ERROR:", msg)
}

function filterIndexes(data: any, subkey = "", { indexes, keys }) {
    if (!data) return data
    if (!indexes?.length && !keys?.length) return subkey && data ? data[subkey] : data

    let filteredData: any = null

    if (indexes?.length) {
        if (!Array.isArray(data)) {
            console.error("HISTORY ERROR: got indexes, but not an array")
            return data
        }

        filteredData = data.filter((_, i) => indexes.includes(i))

        if (subkey) filteredData = filteredData.map((a) => a?.[subkey])
    }

    if (keys?.length) {
        filteredData = {}

        keys.forEach((key) => {
            if (subkey) {
                const subValue = data[key]?.[subkey]
                filteredData[key] = subValue === undefined ? data[key] : subValue
            } else filteredData[key] = data[key]
        })
    }

    return filteredData
}

// move text value to any template textbox with matching text content
function rearrangeContent(content: Item[], prevState: Item[], newState: Item[]) {
    const indexMap: { [key: string]: number } = {}

    function getValue(value: string, count: number) {
        return value + (count > 0 ? "__" + count : "")
    }

    // create a map of previous state values to their indices
    prevState.forEach((item, index) => {
        const value = getItemText(item)
        let count = 0
        while (indexMap[getValue(value, count)] !== undefined) count++
        indexMap[getValue(value, count)] = index
    })

    // create a temporary array to store the rearranged content
    const tempContent: Item[] = new Array(content.length).fill(null)
    const usedIndices = new Set<number>()

    newState.forEach((item, newIndex) => {
        const value = getItemText(item)
        if (indexMap[value] === undefined) return
        // must be of text type
        if (!content[newIndex]?.lines) return

        let count = 0
        while (usedIndices.has(indexMap[getValue(value, count)])) count++
        const contentIndex = indexMap[getValue(value, count)]
        if (contentIndex < content.length && !usedIndices.has(contentIndex) && content[contentIndex]?.lines) {
            if (content[contentIndex]) {
                tempContent[newIndex] = clone({ ...content[newIndex], lines: clone(content[contentIndex].lines) })
            }
            usedIndices.add(contentIndex)
        }
    })

    // fill any undefined positions with the original content
    let tempIndex = 0
    for (let i = 0; i < content.length; i++) {
        if (tempContent[i] === null) {
            while (usedIndices.has(tempIndex)) tempIndex++
            if (tempIndex < content.length) {
                if (content[tempIndex]) tempContent[i] = clone(content[tempIndex])
                usedIndices.add(tempIndex)
            }
            tempIndex++
        }
    }

    return tempContent
}

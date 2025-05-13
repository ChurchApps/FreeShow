import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Slide, SlideData, Template } from "../../../types/Show"
import { breakLongLines, removeItemValues, splitItemInTwo } from "../../show/slides"
import { activeEdit, activePage, activePopup, activeProject, activeShow, alertMessage, cachedShowsData, deletedShows, driveData, groups, notFound, projects, refreshEditSlide, renamedShows, shows, showsCache, templates } from "../../stores"
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
import { _show } from "./shows"

// TODO: move history switch to actions

export const historyActions = ({ obj, undo = null }: any) => {
    let data: any = {}
    const initializing: boolean = undo === null

    if (obj) {
        data = obj.newData || {}
        // if (initializing && !obj.oldData) obj.oldData = clone(obj.newData) // WIP
    }

    const actions = {
        UPDATE: () => {
            // create / delete / duplicate a full store (or a full key, or set indexes)
            if (!obj.location?.id) return error("no updater id")
            const updater = _updaters[obj.location.id]
            if (!updater) return error("missing updater: " + obj.location.id)

            let id = data.id
            const deleting: boolean = id !== undefined

            data = clone(deleting ? obj.oldData : data) || {}

            const key = data.key
            const subkey = data.subkey
            // insert in array
            let index = data.index
            // replace value[s] in array
            const indexes = data.indexes
            const keys = data.keys

            if (!deleting) {
                const empty = !data?.data
                data = { ...data, data: data?.data ?? clone(updater.empty) }
                id = obj.oldData?.id || uid()
                if (keys && !key) id = "keys"

                if (initializing && obj.location.id === "show") customActionActivation("show_created")
                if (initializing && empty && updater.initialize) data.data = updater.initialize(data.data, id)

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

            // update small shows cache
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

            /// //

            function revertOrDeleteElement(a) {
                const previousData = clone(data.previousData)

                if (key) {
                    if (!a[id]) return a

                    data = { ...data, data: filterIndexes(clone(a[id][key]), subkey, { indexes, keys }) }

                    // reverting value with array index will restore the whole array
                    if (previousData && index !== undefined) index = undefined

                    if (previousData !== undefined) return updateKeyData(a, previousData)
                    else {
                        if (subkey) delete a[id][key][subkey]
                        else delete a[id][key]
                    }

                    return a
                }

                if (keys) {
                    // if just keys, but no "key"
                    const currentData = {}
                    keys.forEach((currentKey) => {
                        currentData[currentKey] = clone(a[currentKey])

                        if (previousData) {
                            const replacerValue = previousData[currentKey] || previousData
                            a[currentKey] = replacerValue
                        } else {
                            delete a[currentKey]
                        }
                    })

                    data = { ...data, data: clone(currentData) }

                    return a
                }

                data = { ...data, data: clone(a[id]) }

                if (previousData) a[id] = previousData
                else {
                    if (updater.cloudCombine) a[id] = { id, deleted: true, modified: Date.now() }
                    else delete a[id]
                }

                return a
            }

            function updateElement(a) {
                // TODO: check for duplicates!!???
                if (key) {
                    data.previousData = clone(filterIndexes(a[id]?.[key] ?? {}, subkey, { indexes, keys }))
                    a = updateKeyData(a, data.data)
                } else if (keys) {
                    // if just keys, but no "key"
                    data.previousData = {}
                    keys.forEach((currentKey) => {
                        data.previousData[currentKey] = a[currentKey]
                        const replacerValue = data.data[currentKey] || data.data
                        a[currentKey] = replacerValue
                    })
                } else {
                    data.previousData = clone(a[id])
                    a[id] = data.data
                }

                if (subkey && index !== undefined && index > -1 && !Array.isArray(a[id][key][subkey])) delete data.previousData

                if (initializing && updater.timestamp && a[id]) a[id].modified = Date.now()
                if (data.previousData === data.data) error("Previous data is the same as current data. Try using clone()!")
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
                            if (index === -1) keyData[id][key][currentKey][subkey].push(...replacerValue)
                            else keyData[id][key][currentKey][subkey] = replacerValue
                            return
                        }

                        if (index === -1) keyData[id][key][currentKey].push(...replacerValue)
                        else keyData[id][key][currentKey] = replacerValue
                    })
                    return keyData
                }

                if (subkey) {
                    if (!keyData[id][key]) keyData[id][key] = {}

                    // insert at index
                    if (index !== undefined && Array.isArray(keyData[id][key][subkey])) {
                        if (index === -1) keyData[id][key][subkey].push(newValue)
                        else keyData[id][key][subkey].splice(index, 0, newValue)
                        return keyData
                    }

                    keyData[id][key][subkey] = newValue
                    return keyData
                }

                // insert at index
                if (index !== undefined && Array.isArray(keyData[id][key])) {
                    if (index === -1) keyData[id][key].push(newValue)
                    else keyData[id][key].splice(index, 0, newValue)
                    return keyData
                }

                keyData[id][key] = newValue
                return keyData
            }
        },
        SHOWS: async () => {
            // bulk add/remove/duplicate shows
            const showsList = obj.newData?.data || obj.oldData?.data || []
            if (!showsList.length) return

            let replace: boolean = obj.newData?.replace === true
            let deleting = !obj.newData?.data?.length
            const projectImport = obj.newData?.projectImport === true
            if (obj.oldData?.replace) replace = deleting = true

            if (replace && initializing) obj.oldData = { data: clone(obj.newData.data) }

            // check for duplicate names inside itself
            if (!deleting) {
                showsList.forEach(({ show }, i) => {
                    if (!show) return

                    let name = show.name
                    if (!name) return

                    let number = 1
                    while (showsList.find((a: any, index: number) => a.show?.name === (number > 1 ? name + " " + number : name) && index !== i)) number++
                    name = number > 1 ? name + " " + number : name

                    showsList[i].show.name = name

                    // if renaming to another newly deleted show (with same name) - don't delete!
                    const deletedIndex = get(deletedShows).findIndex((a) => a.name === name)
                    if (deletedIndex > -1) {
                        deletedShows.update((a) => {
                            a.splice(deletedIndex, 1)
                            return a
                        })
                    }
                })

                // reset this on redo
                notFound.set({ show: [], bible: [] })
            }

            const duplicates: string[] = []
            const oldShows: any = {}
            const rename: { [key: string]: { name: string; oldName: string } } = {}

            // load shows cache (to save in undo history)
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

                        // return if old show is modified after new show & not importing project
                        if (initializing && !projectImport && get(shows)[id]?.timestamps?.modified && show.timestamps?.modified && get(shows)[id].timestamps.modified! > show.timestamps.modified) return

                        if (replace) {
                            if (initializing) obj.oldData.data[i].show = clone(a[id])
                            a[id] = { ...a[id], ...show }

                            // rename
                            const oldName = get(shows)[id]?.name
                            if (show.name !== undefined && oldName && oldName !== show.name) {
                                rename[id] = { name: show.name || id, oldName }
                            }
                            return
                        }

                        a[id] = show

                        // this can slow down large show imports a little bit
                        saveTextCache(id, show)
                    }
                })
                return a
            })

            shows.update((a) => {
                showsList.forEach(({ show, id }, i) => {
                    if (deleting && !replace) {
                        // store show
                        if (!obj.oldData?.data[i]?.show) obj.oldData.data[i] = { id, show: oldShows[id] }

                        if (!a[id]) return

                        // add to deleted so the file can be deleted on save
                        deletedShows.set([...get(deletedShows), { id, name: a[id].name }])
                        delete a[id]

                        return
                    }

                    if (!show) return

                    // remove from deleted when restored
                    deletedShows.set(get(deletedShows).filter((deleted) => deleted.id !== id))

                    // return if old show is modified after new show
                    const oldModified = a[id]?.timestamps?.modified || 0
                    const newModified = show.timestamps?.modified || 0
                    if (initializing && newModified && oldModified > newModified) return

                    const oldShow = a[id] ? clone(a[id]) : null
                    if (oldShow?.timestamps) delete (oldShow as any).timestamps.used

                    a[id] = {
                        name: show.name || a[id]?.name || "",
                        category: show.category === undefined ? a[id]?.category : show.category,
                        timestamps: show.timestamps || a[id]?.timestamps,
                        quickAccess: show.quickAccess || a[id]?.quickAccess,
                    }

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

            // rename shows file
            const renamedIds = Object.keys(rename)
            if (renamedIds.length) {
                // renaming multiple times
                const newRenamed = get(renamedShows).filter((a) => !renamedIds.includes(a.id))
                const newRenamedList = keysToID(rename).map((a) => {
                    const previous = get(renamedShows).find((r) => r.id === a.id)
                    if (!previous) return a
                    return { ...a, oldName: previous.oldName }
                })

                renamedShows.set([...newRenamed, ...newRenamedList])
            }

            // TODO: choose which version to overwrite or just skip
            if (initializing && duplicates.length) {
                // && replace ??
                let text = "Overwritten " + duplicates.length + " show"
                if (duplicates.length > 1) text += "s"
                setTimeout(() => {
                    alertMessage.set(text + ":<br>- " + duplicates.join("<br>- "))
                    activePopup.set("alert")
                }, 2000)
            }

            if (!deleting && Object.keys(get(showsCache)).length >= 100) {
                // store all to files
                if (initializing) save()
                // delete showsCache (to reduce lag)
                setTimeout(() => {
                    showsCache.set({})
                    activeShow.set(null)
                }, 2000)
            }

            if (deleting && initializing) {
                // remove any show in the active project
                // only active because of undo
                if (get(activeProject)) {
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
        },
        SLIDES: () => {
            // add/remove/duplicate slide(s)
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
                    return
                }

                if (!slides.length) {
                    slides = [createSlide()]
                    data.data = clone(slides)
                }
            } else {
                data.previousData = {
                    slides: clone(_show(showId).get("slides")),
                    layouts: clone(_show(showId).get("layouts")),
                }
            }

            if (!slides[0]) return

            // sort in descending order so indexes are correct while adding/removing
            slides = slides.sort((a, b) => (a.index < b.index ? 1 : -1))
            if (data.layouts) data.layouts.reverse()
            if (data.layout?.backgrounds?.[1]) data.layout.backgrounds.reverse()

            slides.forEach((slide, i) => {
                let slideId = slide.id
                delete slide.id
                const slideIndex = slide.index ?? index
                delete slide.index

                // check if already exists!!
                // if (!obj.newData.unique)
                // _show(showId)
                //     .slides()
                //     .get()
                //     .forEach((a) => {
                //         if (JSON.stringify(a) === JSON.stringify(slide)) id = slide.id
                //     })

                // add custom
                const isParent = slide.group !== null
                if (!slideId) {
                    error("missing default slide id, may break undo")
                    slideId = uid()
                }

                if (deleting) {
                    // update layout
                    showsCache.update((a) => {
                        if (!a[showId]?.layouts?.[layout]) return a

                        const layoutSlides = a[showId].layouts[layout].slides
                        let newSlides = clone(layoutSlides).filter((layoutSlide, layoutSlideIndex) => (slideIndex !== undefined ? layoutSlideIndex !== slideIndex : layoutSlide.id !== slideId))

                        if (type === "delete") {
                            Object.keys(a[showId].slides).forEach((currentSlideId) => {
                                const currentSlide = a[showId].slides[currentSlideId]

                                if (currentSlideId !== slideId) {
                                    // remove from other slides
                                    const childIndex = currentSlide.children?.indexOf(slideId) ?? -1
                                    if (childIndex >= 0) currentSlide.children!.splice(childIndex, 1)
                                    return
                                }

                                if (isParent) {
                                    // make first child a parent
                                    if (!currentSlide.children?.length) return
                                    const firstChildId = currentSlide.children[0]
                                    const newChildren = clone(currentSlide.children.slice(1))

                                    // make parent
                                    a[showId].slides[firstChildId].globalGroup = currentSlide.globalGroup
                                    a[showId].slides[firstChildId].group = currentSlide.group
                                    a[showId].slides[firstChildId].color = currentSlide.color
                                    a[showId].slides[firstChildId].children = newChildren

                                    // add to layout
                                    newSlides = clone(layoutSlides).map((layoutSlideRef) => {
                                        if (layoutSlideRef.id !== slideId) return layoutSlideRef

                                        // clone layout data
                                        const newLayoutChildren = clone(layoutSlideRef.children || {})
                                        const newLayoutRef = { id: firstChildId, ...newLayoutChildren[firstChildId], children: {} }
                                        delete newLayoutChildren[firstChildId]
                                        newLayoutRef.children = newLayoutChildren

                                        return newLayoutRef
                                    })

                                    return
                                }
                            })
                        }

                        // layout
                        a[showId].layouts[layout].slides = newSlides

                        return a
                    })

                    // TODO: check if slide is active in edit and decrease index...
                } else {
                    const slideData = clone(slide)
                    if (data.addItems === false) slideData.items = []

                    _show(showId).slides([slideId]).add([slideData], isParent)

                    // layout
                    const layoutValue = data.layouts?.[i] || {}
                    layoutValue.id = slideId

                    // TODO: add media to show if it doesent have it
                    // if (data.background && !_show(showId).media([data.background]).get()[0]) {
                    // get bg path
                    //     let bgId = _show(showId).media().add(path)
                    //     layoutValue.background = bgId
                    // }

                    // backgrounds
                    if (data.layout?.backgrounds?.length) {
                        const background = data.layout.backgrounds[i] || data.layout.backgrounds[0]

                        let id = ""
                        const cloudId = get(driveData).mediaId
                        if (layoutValue.background && cloudId && cloudId !== "default") id = layoutValue.background

                        // find existing
                        const existingBackgrounds = _show(showId).get("media")
                        const existingId = Object.keys(existingBackgrounds).find((mediaId) => existingBackgrounds[mediaId].path === background.path)
                        if (existingId) id = existingId

                        const bgId = _show(showId).media().add(background, id)
                        layoutValue.background = bgId
                    }

                    if (isParent) {
                        // get layout slides index (without children)
                        const refAtIndex = ref[slideIndex - 1]?.parent || ref[slideIndex - 1]
                        const slideLayoutIndex = refAtIndex ? refAtIndex.index + 1 : (slideIndex ?? ref.length)

                        // add to layout at index
                        _show(showId).layouts([layout]).slides([slideLayoutIndex]).add([layoutValue])

                        // set to correct index
                        const updatedRef = _show(showId).layouts([layout]).ref()[0]
                        index = updatedRef.find((a) => a.id === layoutValue.id)?.layoutIndex ?? index
                    } else if (slide.oldChild) {
                        const parent = ref.find((a) => a.children?.includes(slide.oldChild))
                        if (parent) {
                            let newChildren = clone(_show(showId).slides([parent.id]).get()[0]?.children || [])
                            let oldIndex = newChildren.indexOf(slide.oldChild)
                            if (oldIndex < 0) oldIndex = newChildren.length

                            newChildren = addToPos(newChildren, [slideId], oldIndex)

                            _show(showId).slides([parent.id]).set({ key: "children", value: newChildren })

                            // WIP get children layout style when copying
                            // get layout style
                            // let newLayoutChildren = _show(showId).layouts([layout]).slides([parent.index]).get()[0].children || {}
                            // newLayoutChildren[id] = parent.data.children?.[slide.oldChild] || {}
                            // _show(showId).layouts([layout]).slides([parent.index]).set({ key: "children", value: newLayoutChildren })
                        } else {
                            _show(showId).slides([slideId]).set({ key: "group", value: "" })
                            _show(showId)
                                .layouts([layout])
                                .slides()
                                .add([{ ...layoutValue, id: slideId }])
                        }
                    }

                    increaseEditIndex()

                    // move outputs slide index
                    // TODO: not working when child outputted and added
                    // TODO: drag groups! -- ?????
                    // console.log(count)
                    // outputs.update((a) => {
                    //   Object.keys(a).forEach((id: string) => {
                    //     let currentIndex = a[id].out?.slide?.index
                    //     console.log(currentIndex)
                    //     if (currentIndex !== undefined) {
                    //       a[id].out!.slide!.index! = a[id].out!.slide!.index! + count
                    //       console.log(a[id].out!.slide!.index!)
                    //     }
                    //   })
                    //   console.log(a)
                    //   return a
                    // })
                }
            })

            if (deleting) {
                if (type === "delete" || type === "delete_group") {
                    _show(showId)
                        .slides(data.data.map((a) => a.id))
                        .remove()
                }
            } else {
                // move edit index
                setTimeout(() => {
                    activeEdit.update((a) => {
                        a.slide = index
                        return a
                    })
                }, 10)

                // TODO: go to remember (show & layout)
            }

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)

            /// //

            function createSlide() {
                const isParent = !ref.length || data.replace?.parent
                const id = data.id || uid()

                if (!isParent) {
                    const parent = ref[index - 1]?.parent || ref[index - 1]

                    if (!parent) return
                    const parentSlide = _show(showId).slides([parent.id]).get()[0]

                    let value: string[] = [id]
                    const childIndex = parent.layoutIndex < index ? index - parent.layoutIndex - 1 : index
                    if (parentSlide.children) value = addToPos(parentSlide.children, value, childIndex)

                    // timeout is to allow slide to be updated when active in output
                    setTimeout(() => {
                        _show(showId).slides([parent.id]).set({ key: "children", value })
                    }, 10)
                }

                let items: any[] = data.replace?.items || []
                // copy previous slide layout
                if (!items.length && ref.length && index - 1 >= 0) {
                    items = clone(
                        _show(showId)
                            .slides([ref[index - 1].id])
                            .items()
                            .get()[0]
                    )
                    items = removeItemValues(items)
                }

                const slide: Slide = { ...EMPTY_SHOW_SLIDE, items }
                if (isParent) slide.globalGroup = "verse"
                else slide.group = null

                return { id, ...slide }
            }

            // increase index (to move edit slide) if there are added more (children) slides before this
            function increaseEditIndex() {
                let count = 1
                count = -1

                const parent = ref[index - 1]?.parent || ref[index - 1]
                if (!parent || data.replace?.parent) return
                ref.forEach((slide) => {
                    if (slide.id === parent.id && slide.layoutIndex < index) count++
                })

                if (count > 0) index += count
                else count = 1

                // data.index = index
            }
        },
        TEMPLATE: () => {
            // set a template on a slide/show
            const deleting = !!obj.oldData
            data = (deleting ? obj.oldData : obj.newData) || {}

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            let show = get(showsCache)[data.remember.showId]
            if (!show) return
            const previousShow: string = JSON.stringify(show)
            let slides = show.slides || {}

            let ref = _show(data.remember.showId).layouts([data.remember.layout]).ref()[0]
            const slideId: string = data.indexes ? ref[data.indexes[0]]?.id : ""

            const createItems = !!data.data?.createItems
            const shiftItems = !!data.data?.shiftItems
            const previousTemplateId = show.settings?.template

            if (deleting) {
                const previousData = data.previousData
                if (!previousData) return error("missing previousData")

                _show(data.remember.showId).set({ key: "slides", value: previousData.slides || {} })
                _show(data.remember.showId).set({ key: "settings.template", value: previousData.template })
            } else {
                data.previousData = clone({ template: previousTemplateId, slides })
                const templateId: string = data.id

                if (templateId && !slideId && previousTemplateId !== templateId) _show(data.remember.showId).set({ key: "settings.template", value: slideId ? null : templateId })

                const template = clone(get(templates)[templateId])
                if (template?.settings?.maxLinesPerSlide) splitToMaxLines(template.settings.maxLinesPerSlide)
                if (template?.settings?.breakLongLines) {
                    slides = breakLongLines(data.remember.showId, template.settings.breakLongLines)
                    show.slides = slides
                }
                updateSlidesWithTemplate(template)

                if (get(activePage) === "edit") refreshEditSlide.set(true)
            }

            // update cached show
            cachedShowsData.update((a) => {
                const customId = getShowCacheId(data.remember.showId, null, data.remember.layout)
                if (a[customId]?.template?.slidesUpdated) a[customId].template.slidesUpdated = true
                return a
            })

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)

            function splitToMaxLines(maxLines: number) {
                let itemIndex = -1
                // find match
                let slideMatch = ref.find((slideRef) => {
                    itemIndex = slides[slideRef.id]?.items?.findIndex((a) => (a.lines?.length || 0) > maxLines)
                    return itemIndex > -1
                })

                let breaker = 0
                while (slideMatch && breaker < 250) {
                    breaker++
                    splitItemInTwo(slideMatch, itemIndex, [], maxLines)

                    // update
                    ref = _show(data.remember.showId).layouts([data.remember.layout]).ref()[0] || []
                    slides = get(showsCache)[data.remember.showId]?.slides || {}
                    // find match
                    slideMatch = ref.find((slideRef) => {
                        itemIndex = slides[slideRef.id]?.items?.findIndex((a) => (a.lines?.length || 0) > maxLines)
                        return itemIndex > -1
                    })
                }

                // update
                show = get(showsCache)[data.remember.showId]
            }

            function updateSlidesWithTemplate(template: Template) {
                Object.entries(slides).forEach(([id, slide]) => {
                    if ((slideId && slideId !== id) || !slide) return

                    // show template
                    let slideTemplate = template
                    let templateMode: "global" | "group" | "slide" = "global"
                    // slide template
                    if (slide.settings?.template) {
                        slideTemplate = clone(get(templates)[slide.settings.template]) || template
                        templateMode = "slide"
                    } else {
                        // group template
                        const isChild = slide.group === null
                        let globalGroup = slide.globalGroup
                        if (isChild) {
                            const parent = Object.values(show.slides || {}).find((a) => a.children?.includes(id))
                            globalGroup = parent?.globalGroup
                        }
                        if (globalGroup && get(groups)[globalGroup]?.template) {
                            slideTemplate = clone(get(templates)[get(groups)[globalGroup]?.template || ""]) || template
                            templateMode = "group"
                        }
                    }

                    if (!slideTemplate?.items?.length) return

                    // roll items around
                    const newTemplate = data.previousData.template !== data.id
                    if (shiftItems && !slide.settings?.template && !newTemplate) slide.items = [...slide.items.slice(1), slide.items[0]].filter((a) => a)

                    // shift items to any template textbox with matching "name" (content), if any
                    if (!shiftItems && newTemplate && !slide.settings?.template && slideTemplate.items?.length > 1) {
                        const previousTemplateItems = get(templates)[data.previousData.template]?.items || []
                        const newTemplateItems = slideTemplate.items || []
                        slide.items = clone(rearrangeContent(slide.items, previousTemplateItems, newTemplateItems))
                        // WIP text style (font size) won't update first time
                    }

                    const changeOverflowItems = !!(slide.settings?.template || createItems)
                    let newItems = mergeWithTemplate(slide.items, slideTemplate.items, changeOverflowItems, obj.save !== false, createItems)

                    // remove items if not in template (and textbox is empty)
                    if (changeOverflowItems) {
                        const templateItemCount = getItemsCountByType(slideTemplate.items)
                        const slideItemCount = getItemsCountByType(newItems)
                        newItems = newItems.filter((a) => {
                            const type = a.type || "text"
                            if (templateItemCount[type] - slideItemCount[type] >= 0) return true
                            if (type === "text" && !isEmptyOrSpecial(a)) return true
                            if (type === "media" && a.src) return true

                            // remove item
                            slideItemCount[type]--
                            return false
                        })
                    }

                    show.slides[id].items = clone(newItems)

                    // TemplateSettings / updateSlideFromTemplate()
                    // if (slideTemplate.settings?.resolution) show.slides[id].settings.resolution = slideTemplate.settings?.resolution
                    if (slideTemplate.settings?.backgroundColor) show.slides[id].settings.color = slideTemplate.settings?.backgroundColor

                    const isFirst = templateMode === "global" && !!show.layouts[data.remember.layout].slides?.find((a) => a?.id === id)
                    show.slides[id] = updateSlideFromTemplate(show.slides[id], slideTemplate, isFirst, changeOverflowItems)

                    const slideRefs = ref.filter((a) => a.id === id)
                    const oldTemplate = get(templates)[previousTemplateId || ""] || {}
                    slideRefs.forEach((slideRef) => {
                        // set custom values
                        const newLayoutData = updateLayoutsFromTemplate(show.layouts, show.media, slideTemplate, oldTemplate, data.remember.layout, slideRef, templateMode, changeOverflowItems)

                        show.layouts = newLayoutData.layouts
                        show.media = newLayoutData.media
                    })
                })

                // don't update if show has not changed
                if (obj.save === false && JSON.stringify(show) === previousShow) return

                showsCache.update((a) => {
                    a[data.remember.showId] = show
                    return a
                })
            }
        },
        SHOW_LAYOUT: () => {
            // change the layout of a show
            const deleting = !!obj.oldData
            data = clone((deleting ? obj.oldData : obj.newData) || {})
            // console.log(obj, deleting)

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            if (deleting) {
                const previousData = data.previousData
                if (!previousData) return error("missing previousData")

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
                    // for overlays, add full array
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
        },
        SHOW_ITEMS: () => {
            // change the values of show items
            const deleting = !!obj.oldData
            data = (deleting ? obj.oldData : obj.newData) || {}

            const key: string | null = data.key || null

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id }
            }

            if (!deleting) {
                data.previousData = clone(_show(data.remember.showId).slides(data.slides).items(data.items).get()[0])

                _show().slides(data.slides).items(data.items).set({ key, values: data.data })
            } else {
                if (!data.previousData) return

                _show().slides(data.slides).items(data.items).set({ values: data.previousData })
            }

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)
        },
    }

    // function initialize(value, { key, index = null }) {
    //     if (!initializing) return
    //     if (index !== null) {
    //         obj.oldData[index][key] = value
    //     } else {
    //         obj.oldData[key] = value
    //     }

    //     // obj.oldData = clone(obj.oldData)
    // }

    // function setKeyOrData({ data, key, value, index = null }, object) {
    //     if (key) {
    //         initialize(object[key], { key: "value", index })
    //         object[key] = value
    //         return object
    //     }

    //     if (data) {
    //         initialize(object, { key: "data" })
    //         return data
    //     }

    //     error("no data")
    //     return object
    // }

    function error(msg = "") {
        console.error(obj.id, "HISTORY ERROR:", msg)
    }

    if (obj) console.info("HISTORY " + (initializing ? "INIT" : undo ? "UNDO" : "REDO") + ` [${obj.id}]:`, clone(obj))

    return actions
}

function filterIndexes(data: any, subkey = "", { indexes, keys }) {
    if (!indexes?.length && !keys?.length) return subkey ? data[subkey] : data

    let filteredData: any = null

    if (indexes?.length) {
        if (!Array.isArray(data)) {
            console.error("HISTORY ERROR: got indexes, but not an array")
            return data
        }

        filteredData = data.filter((_, i) => indexes.includes(i))

        if (subkey) filteredData = filteredData.map((a) => a[subkey])
    }

    if (keys?.length) {
        filteredData = {}

        keys.forEach((key) => {
            if (subkey) filteredData[key] = data[key]?.[subkey] === undefined ? data[key] : data[key][subkey]
            else filteredData[key] = data[key]
        })
    }

    return filteredData
}

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

        let count = 0
        while (usedIndices.has(indexMap[getValue(value, count)])) count++
        const contentIndex = indexMap[getValue(value, count)]
        if (contentIndex < content.length && !usedIndices.has(contentIndex)) {
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

import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../../types/Show"
import { removeItemValues } from "../../show/slides"
import { activeEdit, activePage, activePopup, activeShow, alertMessage, cachedShowsData, deletedShows, driveData, groups, notFound, refreshEditSlide, renamedShows, shows, showsCache, templates } from "../../stores"
import { save } from "../../utils/save"
import { EMPTY_SHOW_SLIDE } from "../../values/empty"
import { customActionActivation } from "../actions/actions"
import { clone, keysToID } from "./array"
import { _updaters } from "./historyHelpers"
import { addToPos } from "./mover"
import { getItemsCountByType, isEmptyOrSpecial, mergeWithTemplate, updateLayoutsFromTemplate, updateSlideFromTemplate } from "./output"
import { loadShows, saveTextCache } from "./setShow"
import { getShowCacheId } from "./show"
import { _show } from "./shows"

// TODO: move history switch to actions

export const historyActions = ({ obj, undo = null }: any) => {
    let data: any = {}
    let initializing: boolean = undo === null

    if (obj) {
        data = obj.newData || {}
        // if (initializing && !obj.oldData) obj.oldData = clone(obj.newData) // WIP
    }

    const actions = {
        UPDATE: () => {
            // create / delete / duplicate a full store (or a full key, or set indexes)
            if (!obj.location?.id) return error("no updater id")
            let updater = _updaters[obj.location.id]
            if (!updater) return error("missing updater: " + obj.location.id)

            let id = data.id
            let deleting: boolean = id !== undefined

            data = clone(deleting ? obj.oldData : data) || {}
            console.log(data)

            let key = data.key
            let subkey = data.subkey
            // insert in array
            let index = data.index
            // replace value[s] in array
            let indexes = data.indexes
            let keys = data.keys

            if (!deleting) {
                let empty = !data?.data
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
                let changed: any = updater.deselect(id, data)
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

            /////

            function revertOrDeleteElement(a) {
                let previousData = clone(data.previousData)

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
                    let currentData = {}
                    keys.forEach((currentKey) => {
                        currentData[currentKey] = clone(a[currentKey])

                        if (previousData) {
                            let replacerValue = previousData[currentKey] || previousData
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
                else delete a[id]

                return a
            }

            function updateElement(a) {
                // TODO: check for duplicates!!???
                if (key) {
                    data.previousData = clone(filterIndexes(a[id][key] ?? {}, subkey, { indexes, keys }))
                    a = updateKeyData(a, data.data)
                } else if (keys) {
                    // if just keys, but no "key"
                    data.previousData = {}
                    keys.forEach((currentKey) => {
                        data.previousData[currentKey] = a[currentKey]
                        let replacerValue = data.data[currentKey] || data.data
                        a[currentKey] = replacerValue
                    })
                } else {
                    data.previousData = clone(a[id])
                    a[id] = data.data
                }

                if (subkey && index !== undefined && index > -1 && !Array.isArray(a[id][key][subkey])) delete data.previousData

                if (data.previousData === data.data) error("Previous data is the same as current data. Try using clone()!")
                return a
            }

            function updateKeyData(a, newValue) {
                console.log(newValue, indexes, keys, a[id][key], subkey)

                if (indexes?.length && Array.isArray(a[id][key])) {
                    if (!a[id][key].length && newValue.length) {
                        a[id][key] = newValue
                        return a
                    }

                    a[id][key] = a[id][key].map((value, i) => {
                        if (indexes?.length && !indexes.includes(i)) return value
                        let currentIndex = indexes.findIndex((a) => a === i)
                        let replacerValue = Array.isArray(newValue) ? newValue[currentIndex] : newValue

                        if (subkey) {
                            value[subkey] = replacerValue
                            return value
                        }

                        return replacerValue
                    })

                    a[id][key] = a[id][key].filter((a) => a !== undefined)

                    return a
                }

                if (keys?.length) {
                    keys.forEach((currentKey) => {
                        let replacerValue = typeof newValue === "string" || newValue?.[currentKey] === undefined ? newValue : newValue[currentKey]
                        if (index === -1 && !Array.isArray(replacerValue)) replacerValue = [replacerValue]

                        if (subkey) {
                            if (index === -1) a[id][key][currentKey][subkey].push(...replacerValue)
                            else a[id][key][currentKey][subkey] = replacerValue
                            return
                        }

                        if (index === -1) a[id][key][currentKey].push(...replacerValue)
                        else a[id][key][currentKey] = replacerValue
                    })
                    return a
                }

                if (subkey) {
                    if (!a[id][key]) a[id][key] = {}

                    // insert at index
                    if (index !== undefined && Array.isArray(a[id][key][subkey])) {
                        if (index === -1) a[id][key][subkey].push(newValue)
                        else a[id][key][subkey].splice(index, 0, newValue)
                        return a
                    }

                    a[id][key][subkey] = newValue
                    return a
                }

                // insert at index
                if (index !== undefined && Array.isArray(a[id][key])) {
                    if (index === -1) a[id][key].push(newValue)
                    else a[id][key].splice(index, 0, newValue)
                    return a
                }

                a[id][key] = newValue
                return a
            }
        },
        SHOWS: async () => {
            // bulk add/remove/duplicate shows
            let showsList = obj.newData?.data || obj.oldData?.data || []
            if (!showsList.length) return

            let replace: boolean = obj.newData?.replace === true
            let deleting: boolean = !obj.newData?.data?.length
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
                })

                // reset this on redo
                notFound.set({ show: [], bible: [] })
            }

            let duplicates: string[] = []
            let oldShows: any = {}
            let rename: any = {}

            // load shows cache
            if (deleting && showsList.length < 20) {
                await loadShows(showsList.map((a) => a.id))
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

                        // return if old show is modified after old show
                        if (initializing && get(shows)[id]?.timestamps?.modified && show.timestamps?.modified && get(shows)[id].timestamps.modified! > show.timestamps.modified) return

                        if (replace) {
                            if (initializing) obj.oldData.data[i].show = clone(a[id])
                            a[id] = { ...a[id], ...show }

                            // rename
                            let oldName = get(shows)[id]?.name
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
                    deletedShows.set(get(deletedShows).filter((a) => a.id !== id))

                    // return if old show is modified after old show
                    if (initializing && a[id]?.timestamps?.modified && show.timestamps?.modified && a[id].timestamps.modified > show.timestamps.modified) return

                    let oldShow = a[id] ? clone(a[id]) : null
                    if (oldShow?.timestamps) delete oldShow.timestamps.used

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

                    let newShow = clone(a[id])
                    if (newShow?.timestamps) delete newShow.timestamps.used

                    if (initializing && !replace && oldShow && JSON.stringify(oldShow) !== JSON.stringify(newShow)) duplicates.push(show.name)
                })
                return a
            })

            // rename shows file
            let renamedIds = Object.keys(rename)
            if (renamedIds.length) {
                // renaming multiple times
                let newRenamed = get(renamedShows).filter((a) => !renamedIds.includes(a.id))
                let newRenamedList = keysToID(rename).map((a) => {
                    let previous = get(renamedShows).find((r) => r.id === a.id)
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
                // then delete showsCache
                setTimeout(() => {
                    showsCache.set({})
                    activeShow.set(null)
                }, 2000)
            }
        },
        SLIDES: () => {
            // add/remove/duplicate slide(s)
            let deleting: boolean = !!obj.oldData
            data = (deleting ? obj.oldData : obj.newData) || {}

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            let slides = clone(data?.data) || []

            let { showId, layout } = data.remember
            if (!showId || !layout) return
            let ref: any[] = _show(showId).layouts([layout]).ref()[0]
            if (!deleting) data.index = data.index ?? ref.length
            let index = data.index

            let type: "delete" | "delete_group" | "remove" = data.type || "delete"

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
            if (data.layout?.backgrounds?.[1]) data.layout.backgrounds.reverse()

            slides.forEach((slide, i) => {
                let id = slide.id
                delete slide.id
                let slideIndex = slide.index ?? index
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
                let isParent = slide.group !== null
                if (!id) {
                    error("missing default slide id, may break undo")
                    id = uid()
                }

                if (deleting) {
                    // update layout
                    showsCache.update((a) => {
                        if (!a[showId]) return a

                        let slides = a[showId].layouts[layout].slides
                        let newSlides = clone(slides).filter((a, i) => (slideIndex !== undefined ? i !== slideIndex : a.id !== id))

                        if (type === "delete") {
                            Object.keys(a[showId].slides).forEach((slideId) => {
                                let slide = a[showId].slides[slideId]

                                if (slideId !== id) {
                                    // remove from other slides
                                    let childIndex = slide.children?.indexOf(id) ?? -1
                                    if (childIndex >= 0) slide.children!.splice(childIndex, 1)
                                    return
                                }

                                if (isParent) {
                                    // make first child a parent
                                    if (!slide.children?.length) return
                                    let firstChildId = slide.children[0]
                                    let newChildren = clone(slide.children.slice(1))

                                    // make parent
                                    a[showId].slides[firstChildId].globalGroup = slide.globalGroup
                                    a[showId].slides[firstChildId].group = slide.group
                                    a[showId].slides[firstChildId].color = slide.color
                                    a[showId].slides[firstChildId].children = newChildren

                                    // add to layout
                                    newSlides = clone(slides).map((layoutSlideRef) => {
                                        if (layoutSlideRef.id !== id) return layoutSlideRef

                                        // clone layout data
                                        let newChildren: any = clone(layoutSlideRef.children || {})
                                        let newLayoutRef = { id: firstChildId, ...newChildren[firstChildId], children: {} }
                                        delete newChildren[firstChildId]
                                        newLayoutRef.children = newChildren

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
                    _show(showId).slides([id]).add([slide], isParent)

                    // layout
                    let layoutValue: any = data.layouts?.[i] || {}
                    layoutValue.id = id

                    // TODO: add media to show if it doesent have it
                    // if (data.background && !_show(showId).media([data.background]).get()[0]) {
                    // get bg path
                    //     let bgId = _show(showId).media().add(path)
                    //     layoutValue.background = bgId
                    // }

                    // backgrounds
                    if (data.layout?.backgrounds?.length) {
                        let background = data.layout.backgrounds[i] || data.layout.backgrounds[0]

                        let id: string = ""
                        let cloudId = get(driveData).mediaId
                        if (layoutValue.background && cloudId && cloudId !== "default") id = layoutValue.background

                        // find existing
                        let existingBackgrounds = _show(showId).get("media")
                        let existingId = Object.keys(existingBackgrounds).find((id) => existingBackgrounds[id].path === background.path)
                        if (existingId) id = existingId

                        let bgId = _show(showId).media().add(background, id)
                        layoutValue.background = bgId
                    }

                    if (isParent) {
                        // get layout slides index (without children)
                        let refAtIndex = ref[slideIndex - 1]?.parent || ref[slideIndex - 1]
                        let slideLayoutIndex = refAtIndex ? refAtIndex.index + 1 : 0
                        console.log(refAtIndex, slideLayoutIndex)

                        // add to layout at index
                        // _show(showId).layouts([layout]).slides().add([layoutValue], null, slideIndex)
                        _show(showId).layouts([layout]).slides([slideLayoutIndex]).add([layoutValue])
                        // } else {
                        //     // add as child
                        //     console.log(slideIndex)
                        //     let parentSlideId = ref[slideIndex - 1]?.id
                        //     if (!parentSlideId) return
                        //     showsCache.update((a) => {
                        //         let children = a[showId].slides[parentSlideId].children
                        //         if (!children) a[showId].slides[parentSlideId].children = []
                        //         else if (children?.includes(id)) return a

                        //         a[showId].slides[parentSlideId].children!.push(id)
                        //         return a
                        //     })
                    } else if (slide.oldChild) {
                        let parent = ref.find((a) => a.children?.includes(slide.oldChild))
                        if (parent) {
                            let newChildren = clone(_show(showId).slides([parent.id]).get()[0]?.children || [])
                            let oldIndex = newChildren.indexOf(slide.oldChild)
                            if (oldIndex < 0) oldIndex = newChildren.length

                            newChildren = addToPos(newChildren, [id], oldIndex)

                            _show(showId).slides([parent.id]).set({ key: "children", value: newChildren })

                            // WIP get children layout style when copying
                            // get layout style
                            // let newLayoutChildren = _show(showId).layouts([layout]).slides([parent.index]).get()[0].children || {}
                            // newLayoutChildren[id] = parent.data.children?.[slide.oldChild] || {}
                            // _show(showId).layouts([layout]).slides([parent.index]).set({ key: "children", value: newLayoutChildren })
                        } else {
                            _show(showId).slides([id]).set({ key: "group", value: "" })
                            _show(showId).layouts([layout]).slides().add([{ id }])
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

            /////

            function createSlide() {
                let isParent = !ref.length || data.replace?.parent
                let id = data.id || uid()

                if (!isParent) {
                    let parent = ref[index - 1]?.parent || ref[index - 1]

                    if (!parent) return
                    let parentSlide = _show(showId).slides([parent.id]).get()[0]

                    let value: string[] = [id]
                    let childIndex = parent.layoutIndex < index ? index - parent.layoutIndex - 1 : index
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

                let slide: Slide = { ...EMPTY_SHOW_SLIDE, items }
                if (isParent) slide.globalGroup = "verse"
                else slide.group = null

                return { id, ...slide }
            }

            // increase index (to move edit slide) if there are added more (children) slides before this
            function increaseEditIndex() {
                let count: number = 1
                count = -1

                let parent = ref[index - 1]?.parent || ref[index - 1]
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
            let deleting: boolean = !!obj.oldData
            data = (deleting ? obj.oldData : obj.newData) || {}

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            let show = get(showsCache)[data.remember.showId]
            if (!show) return
            let previousShow: string = JSON.stringify(show)
            let slides: any = show.slides || {}

            let ref = _show(data.remember.showId).layouts([data.remember.layout]).ref()[0]
            let slideId: string = data.indexes ? ref[data.indexes[0]]?.id : ""

            let createItems: boolean = !!data.data?.createItems

            if (deleting) {
                let previousData = data.previousData
                if (!previousData) return error("missing previousData")

                _show(data.remember.showId).set({ key: "slides", value: previousData.slides || {} })
                _show(data.remember.showId).set({ key: "settings.template", value: previousData.template })
            } else {
                data.previousData = clone({ template: show.settings?.template, slides: slides })
                let templateId: string = data.id

                if (templateId && !slideId && show.settings?.template !== templateId) _show(data.remember.showId).set({ key: "settings.template", value: slideId ? null : templateId })

                let template = clone(get(templates)[templateId])
                updateSlidesWithTemplate(template)

                if (get(activePage) === "edit") refreshEditSlide.set(true)
            }

            // update cached show
            cachedShowsData.update((a) => {
                let customId = getShowCacheId(data.remember.showId, null, data.remember.layout)
                if (a[customId]?.template?.slidesUpdated) a[customId].template.slidesUpdated = true
                return a
            })

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)

            function updateSlidesWithTemplate(template: any) {
                Object.entries(slides).forEach(([id, slide]: any) => {
                    if ((slideId && slideId !== id) || !slide) return

                    // show template
                    let slideTemplate = template
                    let isGlobalTemplate = true
                    // slide template
                    if (slide.settings?.template) {
                        slideTemplate = clone(get(templates)[slide.settings.template]) || template
                        isGlobalTemplate = false
                    } else {
                        // group template
                        let isChild = slide.group === null
                        let globalGroup = slide.globalGroup
                        if (isChild) {
                            let parent = Object.values(show.slides || {}).find((a) => a.children?.includes(id))
                            globalGroup = parent?.globalGroup
                        }
                        if (globalGroup && get(groups)[globalGroup]?.template) {
                            slideTemplate = clone(get(templates)[get(groups)[globalGroup]?.template]) || template
                            isGlobalTemplate = false
                        }
                    }

                    if (!slideTemplate?.items?.length) return

                    // roll items around
                    let newTemplate = data.previousData.template !== data.id
                    if (createItems && !slide.settings?.template && !newTemplate) slide.items = [...slide.items.slice(1), slide.items[0]].filter((a) => a)

                    let changeOverflowItems = slide.settings?.template || createItems
                    let newItems = mergeWithTemplate(slide.items, slideTemplate.items, changeOverflowItems, obj.save !== false)

                    // remove items if not in template (and textbox is empty)
                    if (changeOverflowItems) {
                        let templateItemCount = getItemsCountByType(slideTemplate.items)
                        let slideItemCount = getItemsCountByType(newItems)
                        newItems = newItems.filter((a) => {
                            let type = a.type || "text"
                            if (templateItemCount[type] - slideItemCount[type] >= 0) return true
                            if (type === "text" && !isEmptyOrSpecial(a)) return true

                            // remove item
                            slideItemCount[type]--
                            return false
                        })
                    }

                    show.slides[id].items = clone(newItems)

                    if (!isGlobalTemplate) return

                    // set custom values
                    let isFirst = !!Object.values(show.layouts || {}).find((layout) => layout.slides[0]?.id === id)
                    show.slides[id] = updateSlideFromTemplate(show.slides[id], slideTemplate, isFirst, changeOverflowItems)
                    let newLayoutData = updateLayoutsFromTemplate(show.layouts, show.media, slideTemplate, changeOverflowItems)
                    show.layouts = newLayoutData.layouts
                    show.media = newLayoutData.media
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
            let deleting: boolean = !!obj.oldData
            data = clone((deleting ? obj.oldData : obj.newData) || {})
            // console.log(obj, deleting)

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            if (deleting) {
                let previousData = data.previousData
                if (!previousData) return error("missing previousData")

                _show(data.remember.showId).set({ key: "layouts", value: previousData.layouts || {} })
            } else {
                let show = get(showsCache)[data.remember.showId]
                if (show) data.previousData = { layouts: clone(show.layouts) }

                updateLayoutSlides()
            }

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)

            function updateLayoutSlides() {
                showsCache.update((a: any) => {
                    if (!a[data.remember.showId]) return a
                    let layoutSlides = a[data.remember.showId].layouts[data.remember.layout].slides

                    let currentIndex = -1
                    layoutSlides.forEach((l: any, i: number) => {
                        currentIndex++
                        l = updateValues(l, currentIndex)

                        let children: string[] = a[data.remember.showId].slides[l.id]?.children
                        if (!children?.length) return
                        if (!l.children) l.children = {}
                        children.forEach((child) => {
                            currentIndex++
                            l.children[child] = updateValues(l.children[child] || {}, currentIndex)
                        })

                        a[data.remember.showId].layouts[data.remember.layout].slides[i] = l
                    })
                    return a
                })
            }

            function updateValues(l: any, currentIndex: number = -1) {
                let indexes: number[] = data.indexes || []
                let valueIndex: number = indexes.findIndex((a) => a === currentIndex)
                if (currentIndex >= 0 && indexes.length && valueIndex < 0) return l

                let keys: string[] = data.keys || [data.key]
                let values = data.data
                if (!Array.isArray(values)) values = [values]

                keys.forEach((key, i) => {
                    // for overlays, add full array
                    let value = valueIndex < 0 ? values[i] : data.dataIsArray ? values : values[i]?.[valueIndex] || values[valueIndex] || values[i]
                    console.log(value, valueIndex, values, keys, key, data)

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
            let deleting: boolean = !!obj.oldData
            data = (deleting ? obj.oldData : obj.newData) || {}
            console.log(obj, deleting)

            let key: string | null = data.key || null

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

    // function initialize(value: any, { key, index = null }: any) {
    //     if (!initializing) return
    //     if (index !== null) {
    //         obj.oldData[index][key] = value
    //     } else {
    //         obj.oldData[key] = value
    //     }

    //     // obj.oldData = clone(obj.oldData)
    // }

    // function setKeyOrData({ data, key, value, index = null }, object: any) {
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

    function error(msg: string = "") {
        console.error(obj.id, "HISTORY ERROR:", msg)
    }

    if (obj) console.info("HISTORY " + (initializing ? "INIT" : undo ? "UNDO" : "REDO") + ` [${obj.id}]:`, clone(obj))

    return actions
}

function filterIndexes(data: any, subkey: string = "", { indexes, keys }) {
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

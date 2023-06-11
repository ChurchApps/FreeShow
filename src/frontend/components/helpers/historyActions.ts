import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../../types/Show"
import { removeItemValues } from "../../show/slides"
import { activeEdit, activePopup, activeShow, alertMessage, cachedShowsData, shows, showsCache, templates } from "../../stores"
import { save } from "../../utils/save"
import { clone } from "./array"
import { EMPTY_SHOW_SLIDE } from "./empty"
import { _updaters } from "./historyHelpers"
import { addToPos } from "./mover"
import { _show } from "./shows"

// TODO: move history switch to actions

export const historyActions = ({ obj, undo = null }: any) => {
    let data: any = {}
    let initializing: boolean = undo === null

    if (obj) {
        console.log(obj, undo)
        data = obj.newData || {}
        // if (initializing && !obj.oldData) obj.oldData = clone(obj.newData) // WIP
    }

    const actions = {
        // SAVE: () => {
        //     // don't do anything if creating
        //     if (initializing) return

        //     // if (!get(saved))

        //     // restore
        //     data = undo ? obj.oldData : obj.newData
        //     let id: string = data.id
        //     send(MAIN, ["READ_SAVED_CACHE"], { id })
        // },
        UPDATE: () => {
            // create / delete / duplicate a full store (or a full key, or set indexes)
            if (!obj.location?.id) return error("no updater id")
            let updater = _updaters[obj.location.id]
            if (!updater) return error("missing updater: " + obj.location.id)

            let id = data.id
            let deleting: boolean = id !== undefined

            data = clone(deleting ? obj.oldData : data) || {}
            let key = data.key
            let subkey = data.subkey
            // insert in array
            let index = data.index
            // replace value[s] in array
            let indexes = data.indexes
            let keys = data.keys

            if (!deleting) {
                let empty = !data?.data
                data = { ...data, data: data?.data || clone(updater.empty) }
                id = obj.oldData?.id || uid()
                if (keys && !key) id = "keys"

                if (initializing && empty && updater.initialize) data.data = updater.initialize(data.data)

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

            if (!deleting && updater.select) updater.select(id, data)

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

                    if (previousData) return updateKeyData(a, previousData)
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
                    data.previousData = clone(filterIndexes(a[id][key], subkey, { indexes, keys }))
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
        SHOWS: () => {
            // bulk add/remove/duplicate shows
            let showsList = obj.newData?.data || obj.oldData?.data || []
            if (!showsList.length) return

            let replace: boolean = obj.newData?.replace === true
            let deleting: boolean = !obj.newData?.data?.length
            if (obj.oldData?.replace) replace = deleting = true

            if (replace && initializing) obj.oldData = { data: clone(obj.newData.data) }

            console.log("DELETE SHOWS", deleting, showsList)

            // check for duplicate names inside itself
            if (!deleting) {
                showsList.forEach(({ show }, i) => {
                    if (!show) return

                    let name = show.name
                    if (!name) return

                    let number = 1
                    while (showsList.find((a: any, index: number) => a.show.name === (number > 1 ? name + " " + number : name) && index !== i)) number++
                    name = number > 1 ? name + " " + number : name

                    showsList[i].show.name = name
                })
            }

            let duplicates: string[] = []

            showsCache.update((a) => {
                showsList.forEach(({ show, id }, i: number) => {
                    if (deleting) {
                        if (replace && show) {
                            a[id] = show
                            return
                        }

                        delete a[id]
                    } else {
                        if (!show.slides) return

                        if (replace) {
                            if (initializing) obj.oldData.data[i].show = clone(a[id])
                            a[id] = { ...a[id], ...show }
                            return
                        }

                        if (a[id]) duplicates.push(show.name)
                        a[id] = show
                        // skip text cache for faster import
                        // saveTextCache(id, show)
                    }
                })
                return a
            })

            shows.update((a) => {
                showsList.forEach(({ show, id }, i) => {
                    if (deleting && !replace) {
                        // store show
                        if (!obj.oldData?.data[i]?.show) obj.oldData.data[i] = { id, show: a[id] }

                        delete a[id]

                        return
                    }

                    if (!show) return

                    a[id] = {
                        name: show.name || a[id]?.name || "",
                        category: show.category === undefined ? a[id].category : show.category,
                        timestamps: show.timestamps || a[id].timestamps,
                    }

                    if (show.private) a[id].private = true
                    else if (a[id].private) delete a[id].private
                })
                return a
            })

            // TODO: choose to overwrite or just skip
            if (duplicates.length) {
                let text = "Overwritten " + duplicates.length + " show"
                if (duplicates.length > 1) text += "s"
                setTimeout(() => {
                    alertMessage.set(text + ":<br>- " + duplicates.join("<br>- "))
                    activePopup.set("alert")
                }, 2000)
            }

            if (!deleting && Object.keys(get(showsCache)).length >= 100) {
                // store all to files
                save()
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

                    // backgrounds (not in use ?)
                    if (data.layout?.backgrounds?.length) {
                        let background = data.layout.backgrounds[i] || data.layout.backgrounds[0]
                        let bgId = _show(showId).media().add(background)
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
                data.previousData = { template: show.settings.template, slides: clone(slides) }
                let templateId: string = data.id

                _show(data.remember.showId).set({ key: "settings.template", value: slideId ? null : templateId })

                let template = clone(get(templates)[templateId])
                updateSlidesWithTemplate(template)
            }

            // update cached show
            cachedShowsData.update((a) => {
                a[data.remember.showId].template.slidesUpdated = true
                return a
            })

            if (!initializing) return

            if (deleting) obj.oldData = clone(data)
            else obj.newData = clone(data)

            function updateSlidesWithTemplate(template: any) {
                if (!template?.items?.length) return

                console.log("TEMPLATE", template)

                showsCache.update((a) => {
                    Object.entries(slides).forEach(([id, slide]: any) => {
                        if ((slideId && slideId !== id) || !slide) return

                        template.items.forEach((item: any, i: number) => {
                            if (!slide.items[i] && !createItems) return

                            if (!slide.items[i]) {
                                // remove text from template & add to slide
                                if (item.lines) item.lines = item.lines.map((line) => ({ align: line.align, text: [{ style: line.text?.[0]?.style, value: "" }] }))
                                slide.items.push(item)

                                return
                            }

                            if (item.auto) slide.items[i].auto = true
                            slide.items[i].style = item.style || ""
                            slide.items[i].align = item.align || ""
                            slide.items[i].lines?.forEach((line: any, j: number) => {
                                let templateLine = item.lines?.[j] || item.lines?.[0]
                                line.align = templateLine?.align || ""
                                line.text?.forEach((text: any, k: number) => {
                                    let textStyle: string = templateLine?.text?.[k]?.style || templateLine?.text?.[0]?.style || ""
                                    text.style = textStyle
                                })
                            })
                        })

                        slide.items.forEach((item: any, i: number) => {
                            // remove item if template don't have it and it's empty
                            if (i < template.items.length) return
                            let text: number = item.lines?.reduce((value, line) => (value += line.text?.reduce((value, text) => (value += text.value.length), 0)), 0)
                            if (text) return

                            slide.items.splice(i, 1)
                        })

                        a[data.remember.showId].slides[id] = clone(slide)
                    })

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
                    let value = valueIndex < 0 ? values[i] : data.dataIsArray ? values : values[i]?.[valueIndex] || values[valueIndex]
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

    if (obj) console.info(obj.id, "HISTORY " + (initializing ? "INIT" : undo ? "UNDO" : "REDO") + ":", clone(obj))

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

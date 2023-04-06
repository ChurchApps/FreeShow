import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN } from "../../../types/Channels"
import type { Slide } from "../../../types/Show"
import { removeItemValues } from "../../show/slides"
import { activeEdit, activePopup, activeShow, alertMessage, shows, showsCache } from "../../stores"
import { send } from "../../utils/request"
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
        SAVE: () => {
            // don't do anything if creating
            if (initializing) return

            // TODO: confirm this!!
            // if (!get(saved))

            // restore
            data = undo ? obj.oldData : obj.newData
            let id: string = data.id
            send(MAIN, ["READ_SAVED_CACHE"], { id })
        },
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

                if (subkey && !Array.isArray(a[id][key][subkey])) delete data.previousData

                if (data.previousData === data.data) error("Previous data is the same as current data. Try using clone()!")
                return a
            }

            function updateKeyData(a, newValue) {
                console.log(newValue, indexes, keys, a[id][key], subkey)

                if (indexes?.length && Array.isArray(a[id][key])) {
                    a[id][key] = a[id][key].map((value, i) => {
                        if (indexes?.length && !indexes.includes(i)) return value
                        let currentIndex = indexes.findIndex((a) => a === i)
                        let replacerValue = Array.isArray(newValue) ? newValue[currentIndex] : newValue
                        if (currentIndex < 0 || replacerValue === undefined) error("missing data at index or no value")

                        if (subkey) {
                            value[subkey] = replacerValue
                            return value
                        }

                        return replacerValue
                    })

                    return a
                }

                if (keys?.length) {
                    keys.forEach((currentKey) => {
                        let replacerValue = newValue[currentKey] || newValue

                        if (subkey) {
                            a[id][key][currentKey][subkey] = replacerValue
                            return
                        }

                        a[id][key][currentKey] = replacerValue
                    })
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

            let deleting: boolean = !obj.newData?.data?.length

            // check for duplicate names inside itself
            showsList.forEach(({ show }, i) => {
                let name = show.name
                let number = 1
                while (showsList.find((a: any, index: number) => a.show.name === (number > 1 ? name + " " + number : name) && index !== i)) number++
                name = number > 1 ? name + " " + number : name

                showsList[i].show.name = name
            })

            let duplicates: string[] = []

            showsCache.update((a) => {
                showsList.forEach(({ show, id }) => {
                    if (deleting) delete a[id]
                    else {
                        if (a[id]) duplicates.push(show.name)
                        a[id] = show
                        // skip text cache for faster import
                        // saveTextCache(id, show)
                    }
                })
                return a
            })

            shows.update((a) => {
                showsList.forEach(({ show, id }) => {
                    if (deleting) delete a[id]
                    else {
                        a[id] = {
                            name: show.name,
                            category: show.category,
                            timestamps: show.timestamps,
                        }
                        if (show.private) a[id].private = true
                    }
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
        },
        SLIDES: () => {
            // add/remove/duplicate slide(s)
            let deleting: boolean = !!obj.oldData
            console.log(obj, deleting)
            data = (deleting ? obj.oldData : obj.newData) || {}

            if (initializing) {
                data.remember = { showId: get(activeShow)?.id, layout: _show().get("settings.activeLayout") }
            }

            let slides = clone(data?.data) || []

            let { showId, layout } = data.remember
            console.log(showId, layout)
            if (!showId || !layout) return
            let ref: any[] = _show(showId).layouts([layout]).ref()[0]
            data.index = data.index ?? ref.length
            let index = data.index
            console.log(ref, data.index)

            let type: "remove" | "delete" = data.type || "delete"

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

            console.log(slides)
            if (!slides[0]) return

            slides.forEach((slide, i) => {
                let id = slide.id
                delete slide.id
                let index = slide.index
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
                        a[showId].layouts[layout].slides = slides.filter((a, i) => (index !== undefined ? i !== index : a.id !== id))
                        return a
                    })

                    if (type === "delete" && !isParent) {
                        let parent = ref.filter((a: any) => a.children?.includes(id))[0]
                        console.log(parent)

                        // remove from other slides
                        showsCache.update((a) => {
                            Object.keys(a[showId].slides).forEach((slideId) => {
                                if (slideId === id) return
                                let slide = a[showId].slides[slideId]
                                let index = slide.children?.indexOf(id) ?? -1
                                if (index >= 0) slide.children!.splice(index, 1)
                            })
                            return a
                        })
                    }

                    // TODO: check if slide is active in edit and decrease index...
                } else {
                    _show(showId).slides([id]).add([slide], isParent)

                    // layout
                    let layoutValue: any = { id }

                    // backgrounds
                    if (data.layout?.backgrounds?.length) {
                        let background = data.layout.backgrounds[i] || data.layout.backgrounds[0]
                        let bgId = _show(showId).media().add(background)
                        layoutValue.background = bgId
                    }

                    if (isParent) {
                        // get layout slides index (without children)
                        let slideLayoutIndex = index > 0 ? ref[index - 1]?.index + 1 : 0
                        // add to layout at index
                        // _show(showId).layouts([layout]).slides().add([layoutValue], null, index)
                        _show(showId).layouts([layout]).slides([slideLayoutIndex]).add([layoutValue])
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
                if (type === "delete") {
                    _show(showId)
                        .slides(data.data.map((a) => a.id))
                        .remove()
                }
            } else {
                // move edit index
                activeEdit.update((a) => {
                    a.slide = index
                    return a
                })

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

                    _show(showId).slides([parent.id]).set({ key: "children", value })
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
                console.log(items)

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
                if (!parent) return
                ref.forEach((slide) => {
                    if (slide.id === parent.id && slide.layoutIndex < index) count++
                })

                if (count > 0) index += count
                else count = 1

                // data.index = index
            }
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

        console.log(keys, data, subkey)

        keys.forEach((key) => {
            if (subkey) filteredData[key] = data[key]?.[subkey] || data[key]
            else filteredData[key] = data[key]
        })
    }

    return filteredData
}

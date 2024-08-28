import { get } from "svelte/store"
import { uid } from "uid"
import { activeFocus, activeShow, shows as allShows, driveData, focusMode, showsCache } from "../../stores"
import { addToPos } from "./mover"
import { clone } from "./array"
// import { loadShows } from "./setShow"

/** Shows function */
/** string[] | "active" */
export function _show(id: any = "active") {
    // await loadShows(ids)
    let shows: any = get(showsCache)
    // set id to active show
    if (id === "active" && get(focusMode) && get(showsCache)[get(activeFocus).id]) id = get(activeFocus).id
    else if (id === "active" && get(activeShow) !== null && (get(activeShow)!.type === undefined || get(activeShow)!.type === "show")) id = get(activeShow)!.id

    return {
        /** Get key value in shows of leave blank for full show */
        get: (key: string | null = null) => {
            let a: any = shows[id]
            if (!a) return null
            if (key) {
                let double = key.split(".")
                if (double.length > 1) a = shows[id][double[0]][double[1]]
                else a = shows[id][key]
            }
            return a
        },
        /** Set given shows: {key: value} */
        set: ({ key, value }: any) => {
            let prev: any[] = []
            showsCache.update((a: any) => {
                if (!a[id]) return a

                let double = key.split(".")
                if (double.length > 1) {
                    prev = a[id][double[0]][double[1]]
                    a[id][double[0]][double[1]] = value
                } else {
                    prev = clone(a[id][key])
                    a[id][key] = value
                }

                a[id].timestamps.modified = new Date().getTime()
                return a
            })
            allShows.update((a: any) => {
                let double = key.split(".")
                if (!a[id]) {
                    if (!get(showsCache)[id]) return a
                    a[id] = get(showsCache)[id]
                }

                if (double.length > 1 && a[id][double[0]]?.[double[1]]) a[id][double[0]][double[1]] = value
                else if (a[id][key]) a[id][key] = value

                if (a[id]) a[id].timestamps.modified = new Date().getTime()
                return a
            })
            return prev
        },
        /** Remove key in given shows */
        remove: (key: string) => {
            let prev: any[] = []
            showsCache.update((a: any) => {
                prev = a[id][key]
                delete a[id][key]

                a[id].timestamps.modified = new Date().getTime()
                return a
            })
            return prev
        },
        // delete, add
        /** Slides function */
        slides: (slideIds: string[] = []) => ({
            /** Get slides */
            get: (key: null | string = null, addId: boolean = true) => {
                let a: any[] = []
                if (!shows[id]) return []
                if (!slideIds.length && shows[id].slides) slideIds = Object.keys(shows[id].slides)
                slideIds.forEach((slideId) => {
                    let slide = clone(shows[id].slides[slideId])
                    if (!slide) return

                    if (key) a.push(slide[key])
                    else {
                        if (addId) slide.id = slideId
                        a.push(slide)
                    }
                })
                return a
            },
            /** Set slides: {key: value} */
            set: ({ key, value }: any) => {
                let prev: any[] = []
                showsCache.update((a: any) => {
                    if (!slideIds.length) slideIds = Object.keys(a[id].layouts)
                    slideIds.forEach((slideId) => {
                        if (!a[id].slides[slideId]) return

                        prev.push(a[id].slides[slideId][key])
                        if (value === undefined) delete a[id].slides[slideId][key]
                        else a[id].slides[slideId][key] = value
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return prev
            },
            /** Add new slide */
            add: (slides: null | any[] = null, parent: boolean = false) => {
                let group: null | string = null
                if (parent) group = ""
                if (!slides) slides = [{ group, color: null, settings: {}, notes: "", items: [] }]
                if (!slideIds.length) slideIds = [uid()]
                showsCache.update((a: any) => {
                    slideIds.forEach((slideId: string, i: number) => {
                        a[id].slides[slideId] = slides![i] || slides![0]
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return slideIds[0]
            },
            /** Remove slide */
            remove: () => {
                let slides: any = { ids: [], slides: [] }
                showsCache.update((a: any) => {
                    if (!slideIds.length) slideIds = Object.keys(a[id].slides)
                    slideIds.forEach((slideId) => {
                        slides.ids.push(slideId)
                        slides.slides.push(a[id].slides[slideId])
                        delete a[id].slides[slideId]
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return slides
            },
            /** Items function */
            items: (indexes: number[] = []) => ({
                /** Get slides items */
                get: (key: string | null = null, addId: boolean = true) => {
                    let a: any[] = []
                    if (!shows[id]) return []
                    if (!slideIds.length) slideIds = Object.keys(shows[id].slides || {})
                    slideIds.forEach((slideId, i) => {
                        a.push([])
                        if (!shows[id].slides[slideId]) return

                        // if (!indexes.length) a[i].push(...shows[id].slides[slideId].items)
                        if (!indexes.length) indexes = [...Object.keys(shows[id].slides[slideId].items)] as any
                        indexes.forEach((index) => {
                            if (!shows[id].slides[slideId]?.items) return
                            if (key) a[i].push(shows[id].slides[slideId].items[index][key])
                            else {
                                a[i].push({ ...shows[id].slides[slideId].items[index] })
                                if (addId) a[i][a[i].length - 1].id = slideId
                            }
                        })
                    })
                    return a
                },
                /** Set slides items: {key: value} */
                set: ({ key, values }: any) => {
                    let prev: any = { values: [] }
                    if (key) prev.key = key
                    showsCache.update((a: any) => {
                        if (!a[id]) return a
                        if (!slideIds.length) slideIds = Object.keys(a[id].layouts)
                        slideIds.forEach((slideId) => {
                            if (!a[id].slides[slideId]) return
                            if (!indexes.length) indexes = [...Object.keys(shows[id].slides[slideId].items)] as any
                            indexes.forEach((index, i) => {
                                let value = values[i] || values[0]
                                if (key) {
                                    if (!a[id].slides[slideId].items[index]) return

                                    if (key.includes(".")) {
                                        let splitted = key.split(".")
                                        prev.values.push(a[id].slides[slideId].items[index][splitted[0]]?.[splitted[1]] ? clone(a[id].slides[slideId].items[index][splitted[0]][splitted[1]]) : null)
                                        if (!a[id].slides[slideId].items[index][splitted[0]]) a[id].slides[slideId].items[index][splitted[0]] = {}
                                        a[id].slides[slideId].items[index][splitted[0]][splitted[1]] = value
                                    } else {
                                        prev.values.push(a[id].slides[slideId].items[index][key] ? clone(a[id].slides[slideId].items[index][key]) : null)
                                        if (value === undefined) delete a[id].slides[slideId].items[index][key]
                                        else a[id].slides[slideId].items[index][key] = value
                                    }
                                } else {
                                    prev.values.push(a[id].slides[slideId].items[index] ? clone(a[id].slides[slideId].items[index]) : null)
                                    a[id].slides[slideId].items[index] = value
                                }
                            })
                        })

                        a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                    return prev
                },
                /** Add items */
                add: (items: any[]) => {
                    showsCache.update((a: any) => {
                        slideIds.forEach((slideId) => {
                            items.forEach((item: any) => {
                                if (!a[id]?.slides?.[slideId]) return
                                a[id].slides[slideId].items.push(item)
                            })
                        })

                        if (a[id]) a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                },
                /** Remove items */
                remove: () => {
                    let prev: any = []
                    showsCache.update((a: any) => {
                        if (!a[id]) return a
                        if (!slideIds.length) slideIds = Object.keys(a[id].slides)
                        slideIds.forEach((slideId) => {
                            indexes.forEach((index) => {
                                if (!a[id].slides[slideId]) return

                                prev.push(a[id].slides[slideId].items[index])
                                a[id].slides[slideId].items.splice(index, 1)
                            })
                        })

                        a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                    return prev
                },
                /** Lines function */
                lines: (lines: any[] = []) => ({
                    /** Get slides items lines */
                    get: () => {
                        let a: any[] = []
                        if (!slideIds.length && shows[id]?.slides) slideIds = Object.keys(shows[id].slides || {})
                        slideIds.forEach((slideId, i) => {
                            a.push([])
                            if (!shows[id].slides[slideId]) return
                            if (!indexes.length) indexes = Object.keys(shows[id].slides[slideId].items) as any
                            indexes.forEach((index) => {
                                if (!lines.length) lines = Object.keys(shows[id].slides[slideId].items[index]?.lines || {})
                                lines.forEach((line) => {
                                    if (shows[id].slides[slideId]?.items?.[index]?.lines?.[line]) {
                                        a[i].push(shows[id].slides[slideId].items[index].lines[line])
                                    }
                                })
                            })
                        })
                        return a
                    },
                    /** Set slides items lines: {key: value} */
                    set: ({ key, values }: any) => {
                        let prev: any = { key, values: [] }
                        showsCache.update((a: any) => {
                            if (!slideIds.length) slideIds = Object.keys(a[id].layouts)
                            slideIds.forEach((slideId) => {
                                if (!a[id].slides[slideId]) return
                                if (!indexes.length) indexes = a[id].slides[slideId].items.map((_: any, i: number) => i)
                                indexes.forEach((index, i) => {
                                    prev.values.push([])
                                    if (!lines?.length) lines = Object.keys(a[id].slides[slideId].items[index].lines)
                                    lines.forEach((line, lineIndex) => {
                                        if (key) {
                                            if (a[id].slides[slideId].items[index].lines?.[line]) {
                                                // console.log(a[id].slides[slideId].items[index].lines[line], key, values, i)
                                                // console.log(lines, line, key, a[id].slides[slideId].items[index].lines[line][key], i, lineIndex, values, values[i]?.[lineIndex])
                                                // console.log(a[id].slides[slideId].items[index].lines[line].text?.[0]?.style)

                                                if (a[id].slides[slideId].items[index].lines[line][key] !== undefined) {
                                                    prev.values[prev.values.length - 1].push(clone(a[id].slides[slideId].items[index].lines[line][key]))
                                                    a[id].slides[slideId].items[index].lines[line][key] = values[i] ? (values[i][lineIndex] !== undefined ? values[i][lineIndex] : values[i][0]) : values[0][0]
                                                } else prev.values[prev.values.length - 1].push(null)
                                            } else prev.values[prev.values.length - 1].push(null)
                                        } else {
                                            prev.values[prev.values.length - 1].push(a[id].slides[slideId].items[index] ? clone(a[id].slides[slideId].items[index].lines[line]) : null)
                                            a[id].slides[slideId].items[index].lines[line] = values[i] ? (values[i][lineIndex] !== undefined ? values[i][lineIndex] : values[i][0]) : values[0][0]
                                        }
                                    })
                                })
                            })

                            a[id].timestamps.modified = new Date().getTime()
                            return a
                        })
                        return prev
                    },
                    /** Add items */
                    add: ({ lineIndexes, items }: any) => {
                        showsCache.update((a: any) => {
                            slideIds.forEach((slideId) => {
                                indexes.forEach((index) => {
                                    items.forEach((item: any, i: number) => {
                                        if (!a[id].slides[slideId]) return
                                        a[id].slides[slideId].items[index].lines[lineIndexes[i]] = item
                                    })
                                })
                            })

                            a[id].timestamps.modified = new Date().getTime()
                            return a
                        })
                    },
                    /** Remove items */
                    remove: () => {
                        let prev: any = { lineIndexes: [], items: [] }
                        showsCache.update((a: any) => {
                            if (!slideIds.length) slideIds = Object.keys(a[id].slides)
                            slideIds.forEach((slideId) => {
                                indexes.forEach((index) => {
                                    if (!shows[id].slides[slideId]) return
                                    if (!lines.length) lines = Object.keys(shows[id].slides[slideId].items[index].lines)
                                    lines.forEach((line) => {
                                        prev.lineIndexes.push(line)
                                        prev.items.push(a[id].slides[slideId].items[index].lines[line])
                                        delete a[id].slides[slideId].items[index].lines[line]
                                    })
                                })
                            })

                            a[id].timestamps.modified = new Date().getTime()
                            return a
                        })
                        return prev
                    },
                }),
            }),
        }),
        /** Layouts function */
        /** string[] | "active" */
        layouts: (layoutIds: any = []) => ({
            /** Get layouts */
            get: (key: string | null = null, includeId: boolean = false) => {
                let a: any[] = []
                if (layoutIds === "active") layoutIds = shows[id]?.settings?.activeLayout ? [shows[id].settings.activeLayout] : []
                else if (!layoutIds.length) layoutIds = Object.keys(shows[id]?.layouts || {})
                layoutIds.forEach((layoutId: any) => {
                    let layout = shows[id]?.layouts[layoutId]
                    if (!layout) return
                    if (key) layout = layout[key]
                    if (includeId) layout = { layoutId, ...layout }
                    a.push(layout)
                })
                return a
            },
            /** Get full ref layout */
            ref: () => {
                let a: any[] = []
                if (shows[id]?.layouts) {
                    if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                    else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                    layoutIds.forEach((layoutId: any, i: number) => {
                        a.push([])
                        let layoutIndex: number = -1
                        shows[id].layouts[layoutId]?.slides?.forEach((layoutSlide: any, index: number) => {
                            if (!shows[id].slides[layoutSlide.id]) {
                                console.log("MISSING SLIDE")
                                return
                            }

                            layoutIndex++
                            let slide = shows[id].slides[layoutSlide.id]
                            let children = slide?.children || []
                            // fix bug where some childs are stored as an array
                            let newChildren: any[] = []
                            children.forEach((a) => {
                                if (Array.isArray(a)) newChildren.push(...a)
                                else newChildren.push(a)
                            })
                            if (newChildren.length && JSON.stringify(children) !== JSON.stringify(newChildren)) _show().slides([layoutSlide.id]).set({ key: "children", value: newChildren })
                            children = newChildren

                            a[i].push({ type: "parent", layoutId, index, layoutIndex, id: layoutSlide.id, children, data: layoutSlide })
                            if (children) {
                                children.forEach((childId: string, jndex: number) => {
                                    layoutIndex++

                                    // array bug
                                    if (Array.isArray(childId)) childId = childId[0]

                                    // check if layout is a "real" slide
                                    if (!shows[id].slides[childId]) {
                                        // remove empty slide
                                        showsCache.update((a) => {
                                            a[id].slides[layoutSlide.id].children?.splice(jndex, 1)
                                            if (a[id].layouts[layoutId].slides[index].children?.[childId]) {
                                                delete a[id].layouts[layoutId].slides[index].children[childId]
                                            }
                                            return a
                                        })
                                        return
                                    }

                                    a[i].push({
                                        type: "child",
                                        layoutId,
                                        index: jndex,
                                        layoutIndex,
                                        id: childId,
                                        parent: { id: layoutSlide.id, index, layoutIndex: layoutIndex - jndex - 1 },
                                        data: layoutSlide.children?.[childId] || {},
                                    })
                                })
                            }
                        })
                    })
                }
                return a
            },
            /** Set layouts: {key: value} */
            set: ({ key, value }: any) => {
                let prev: any[] = []
                showsCache.update((a: any) => {
                    if (!a[id]) return a
                    if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                    else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                    layoutIds.forEach((layoutId: any) => {
                        prev.push({ key, value: a[id].layouts[layoutId][key] })
                        a[id].layouts[layoutId][key] = value
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return prev
            },
            /** Add layout */
            add: (layoutId: string = uid(), layout: any = null) => {
                showsCache.update((a: any) => {
                    a[id].layouts[layoutId] = layout || { name: "", notes: "", slides: [] }

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return layoutId
            },
            remove: (layoutId: string) => {
                let prev: any[] = []
                showsCache.update((a: any) => {
                    prev.push(a[id].layouts[layoutId])
                    delete a[id].layouts[layoutId]

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return prev
            },
            /** Layouts slides function */
            slides: (indexes: any[] = []) => ({
                /** Get layout slides */
                get: () => {
                    let a: any[] = []
                    if (shows[id]) {
                        if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                        else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                        a.push([])
                        layoutIds.forEach((layoutId: any, i: number) => {
                            if (!indexes.length) indexes = Object.keys(shows[id].layouts[layoutId].slides)
                            indexes.forEach((index: number) => {
                                a[i].push(shows[id].layouts[layoutId].slides[index])
                            })
                        })
                    }
                    return a
                },
                /** Set layout slides: {key: value} */
                set: ({ key, value }: any) => {
                    let prev: any[] = []
                    showsCache.update((a: any) => {
                        if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                        else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                        layoutIds.forEach((layoutId: any, i: number) => {
                            if (i === 0) prev[i] = []
                            if (!indexes.length) indexes = Object.keys(shows[id].layouts[layoutId].slides)
                            indexes.forEach((index: number) => {
                                prev[i].push(a[id].layouts[layoutId].slides[index][key])
                                if (value === null) delete a[id].layouts[layoutId].slides[index][key]
                                else a[id].layouts[layoutId].slides[index][key] = value
                            })
                        })

                        a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                    return prev
                },
                /** Add slide to layouts */
                add: (layouts: any[], parent: null | number = null, addToIndex: number = -1) => {
                    const removeId = (object: any) => {
                        delete object.id
                        return object
                    }
                    showsCache.update((a: any) => {
                        if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                        else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                        layoutIds.forEach((layoutId: any) => {
                            let slides = a[id].layouts[layoutId].slides
                            if (parent !== null) slides = slides[parent].children || []
                            if (addToIndex < 0) addToIndex = slides.length
                            if (indexes.length) {
                                indexes
                                    .sort((a, b) => a - b)
                                    .forEach((index: number, i) => {
                                        console.log(a[id].layouts[layoutId].slides, [layouts[i]], index)
                                        if (parent === null) a[id].layouts[layoutId].slides = addToPos(a[id].layouts[layoutId].slides, [layouts[i]], index)
                                        else {
                                            if (!a[id].layouts[layoutId].slides[parent].children) a[id].layouts[layoutId].slides[parent].children = {}
                                            a[id].layouts[layoutId].slides[parent].children[layouts[i].id] = removeId(layouts[i]) || {}
                                        }
                                        console.log(a[id].layouts[layoutId].slides)
                                    })
                            } else {
                                if (parent === null) a[id].layouts[layoutId].slides = addToPos(slides, layouts, addToIndex)
                                else {
                                    if (!a[id].layouts[layoutId].slides[parent].children) a[id].layouts[layoutId].slides[parent].children = {}
                                    a[id].layouts[layoutId].slides[parent].children[layouts[0].id] = removeId(layouts[0]) || {}
                                }
                                // else a[id].layouts[layoutId].slides[parent].children = addToPos(slides, layouts, addToIndex)
                                // layouts.forEach((layout, i) => {
                                //   let index: number = indexes[i]
                                //   if (index === undefined) index = addToIndex
                                // })
                            }
                        })

                        a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                },
                /** Remove slides in layouts */
                remove: (key: null | string = null, deleteAll: boolean = true) => {
                    // let prev: any = { indexes: [], layouts: [] }
                    let prev: any = {}
                    showsCache.update((a: any) => {
                        if (!a[id]) return a
                        if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                        else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
                        layoutIds.forEach((layoutId: any, i: number) => {
                            prev[layoutId] = { indexes: [], layouts: [] }
                            if (!indexes[i]?.length && deleteAll) indexes[i] = Object.keys(shows[id].layouts[layoutId].slides)
                            indexes[i]
                                .sort((a: any, b: any) => b - a)
                                .forEach((index: number) => {
                                    prev[layoutId].indexes.push(index)
                                    if (key) {
                                        prev[layoutId].layouts.push(a[id].layouts[layoutId].slides[index][key])
                                        delete a[id].layouts[layoutId].slides[index][key]
                                    }
                                    prev[layoutId].layouts.push(a[id].layouts[layoutId].slides[index])
                                    a[id].layouts[layoutId].slides.splice(index, 1)
                                })
                        })

                        a[id].timestamps.modified = new Date().getTime()
                        return a
                    })
                    return prev
                },
                /** Layout slides children function */
                children: (children: string[] = []) => ({
                    /** Set layout slides children: {key: value} */
                    set: ({ key, value }: any) => {
                        let prev: any[] = []
                        showsCache.update((a: any) => {
                            if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
                            else if (!layoutIds.length) layoutIds = Object.keys(a[id].layouts)
                            layoutIds.forEach((layoutId: any, i: number) => {
                                if (i === 0) prev[i] = []
                                if (!indexes.length) indexes = Object.keys(shows[id].layouts[layoutId].slides)
                                indexes.forEach((index: number) => {
                                    children.forEach((child: string) => {
                                        if (!a[id].layouts[layoutId].slides[index].children) a[id].layouts[layoutId].slides[index].children = {}
                                        if (!a[id].layouts[layoutId].slides[index].children[child]) a[id].layouts[layoutId].slides[index].children[child] = {}
                                        prev[i].push(a[id].layouts[layoutId].slides[index].children[child][key] || null)
                                        a[id].layouts[layoutId].slides[index].children[child][key] = value
                                    })
                                })
                            })

                            a[id].timestamps.modified = new Date().getTime()
                            return a
                        })
                        return prev
                    },
                }),
            }),
        }),
        /** Media function */
        media: (mediaIds: string[] = []) => ({
            /** Get media */
            get: () => {
                let a: any[] = []
                if (!mediaIds.length) mediaIds = Object.keys(shows[id].media)
                mediaIds.forEach((mediaId) => {
                    a.push({ key: mediaId, ...shows[id].media[mediaId] })
                })
                return a
            },
            /** Set media: {key: value} */
            set: ({ key, value }: any) => {
                // let prev: any[] = []
                showsCache.update((a: any) => {
                    if (!mediaIds.length) mediaIds = Object.keys(a[id].layouts)
                    mediaIds.forEach((mediaId) => {
                        // if (i === 0) prev[i] = []
                        // prev[i].push(a[id].media[mediaId][key])
                        if (value === undefined) delete a[id].media[mediaId][key]
                        else a[id].media[mediaId][key] = value
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                // return prev
            },
            /** Add new media */
            add: (object: any, bgid: string = "") => {
                if (!bgid) bgid = uid()
                showsCache.update((a: any) => {
                    let cloudId = get(driveData).mediaId
                    if (cloudId && cloudId !== "default") {
                        object.cloud = a[id].media[bgid]?.cloud || {}
                        if (!object.cloud[cloudId]) object.cloud[cloudId] = {}
                        object.cloud[cloudId] = object.path
                    }

                    a[id].media[bgid] = object

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return bgid
            },
            /** Remove media */
            remove: () => {
                let media: any[] = []
                showsCache.update((a: any) => {
                    if (!mediaIds.length) mediaIds = Object.keys(a[id].media)
                    mediaIds.forEach((mediaId, i) => {
                        if (i === 0) media[i] = []
                        media[i].push(a[id].media[mediaId])
                        delete a[id].media[mediaId]
                    })

                    a[id].timestamps.modified = new Date().getTime()
                    return a
                })
                return media
            },
        }),
    }
}

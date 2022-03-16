import { get } from "svelte/store"
import { uid } from "uid"
import { showsCache, activeShow } from "../../stores"
import { addToPos } from "./mover"
// import { loadShows } from "./setShow"

/** Shows function */
/** string[] | "active" */
export function _show(id: any) {
  // await loadShows(ids)
  let shows: any = get(showsCache)
  if (id === "active" && get(activeShow) !== null && (get(activeShow)!.type === undefined || get(activeShow)!.type === "show")) id = get(activeShow)!.id
  return {
    /** Get key value in shows of leave blank for full show */
    get: (key: string | null = null) => {
      let a: any = shows[id]
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
        let double = key.split(".")
        if (double.length > 1) {
          prev = a[id][double[0]][double[1]]
          a[id][double[0]][double[1]] = value
        } else {
          prev = a[id][key]
          a[id][key] = value
        }
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
        return a
      })
      return prev
    },
    // delete, add
    /** Slides function */
    slides: (slideIds: string[] = []) => ({
      /** Get slides */
      get: (key: null | string = null) => {
        let a: any[] = []
        if (!slideIds.length) slideIds = Object.keys(shows[id].slides)
        slideIds.forEach((slideId) => {
          if (key) a.push(shows[id].slides[slideId][key])
          else a.push(shows[id].slides[slideId])
        })
        return a
      },
      /** Set slides: {key: value} */
      set: ({ key, value }: any) => {
        let prev: any[] = []
        showsCache.update((a: any) => {
          if (!slideIds.length) slideIds = Object.keys(a[id].layouts)
          slideIds.forEach((slideId, i) => {
            if (i === 0) prev[i] = []
            prev[i].push(a[id].slides[slideId][key])
            a[id].slides[slideId][key] = value
          })
          return a
        })
        return prev
      },
      /** Add new slide */
      add: (slide: any = null, parent: boolean = false) => {
        // TODO: template....
        let group: null | string = null
        if (parent) group = ""
        if (!slide) slide = { group, color: null, settings: {}, notes: "", items: [] }
        showsCache.update((a: any) => {
          if (!slideIds[0]) slideIds.push(uid())
          a[id].slides[slideIds[0]] = slide
          // slideIds.forEach((slideId) => {})
          return a
        })
        // ADD TO LAYOUT......????
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
          return a
        })
        return slides
      },
      /** Items function */
      items: (indexes: number[] = []) => ({
        /** Get slides items */
        get: (key: string | null = null) => {
          let a: any[] = []
          if (!slideIds.length) slideIds = Object.keys(shows[id].slides)
          a.push([])
          slideIds.forEach((slideId, i) => {
            if (!indexes.length) a[i].push(...shows[id].slides[slideId].items)
            else {
              indexes.forEach((index) => {
                if (key === null) a[i].push(shows[id].slides[slideId].items[index])
                else a[i].push(shows[id].slides[slideId].items[index][key])
              })
            }
          })
          return a
        },
        /** Set slides items: {key: value} */
        set: ({ key, values }: any) => {
          let prev: any = { key, values: [] }
          showsCache.update((a: any) => {
            if (!slideIds.length) slideIds = Object.keys(a[id].layouts)
            slideIds.forEach((slideId) => {
              indexes.forEach((index, i) => {
                if (key) {
                  prev.values.push(a[id].slides[slideId].items[index][key] ? JSON.parse(JSON.stringify(a[id].slides[slideId].items[index][key])) : null)
                  a[id].slides[slideId].items[index][key] = values[i] || values[0]
                } else {
                  prev.values.push(a[id].slides[slideId].items[index] ? JSON.parse(JSON.stringify(a[id].slides[slideId].items[index])) : null)
                  a[id].slides[slideId].items[index] = values[i] || values[0]
                }
              })
            })
            return a
          })
          return prev
        },
        /** Add items */
        add: ({ indexes, items }: any) => {
          showsCache.update((a: any) => {
            slideIds.forEach((slideId) => {
              items.forEach((item: any, i: number) => {
                a[id].slides[slideId].items[indexes[i]] = item
              })
            })
            return a
          })
        },
        /** Remove items */
        remove: () => {
          let prev: any = { indexes: [], items: [] }
          showsCache.update((a: any) => {
            if (!slideIds.length) slideIds = Object.keys(a[id].slides)
            slideIds.forEach((slideId) => {
              indexes.forEach((index) => {
                prev.indexes.push(index)
                prev.items.push(a[id].slides[slideId].items[index])
                delete a[id].slides[slideId].items[index]
              })
            })
            return a
          })
          return prev
        },
        /** Lines function */
        lines: (lines: any[] = []) => ({
          /** Get slides items lines */
          get: () => {
            let a: any[] = []
            if (!slideIds.length) slideIds = Object.keys(shows[id].slides)
            a.push([])
            slideIds.forEach((slideId, i) => {
              if (!indexes.length) indexes = Object.keys(shows[id].slides[slideId].items) as any
              indexes.forEach((index) => {
                if (!lines.length) lines = Object.keys(shows[id].slides[slideId].items[index].lines)
                lines.forEach((line) => {
                  a[i].push(shows[id].slides[slideId].items[index].lines[line])
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
                indexes.forEach((index, i) => {
                  if (!lines?.length) lines = Object.keys(a[id].slides[slideId].items[index].lines)
                  lines.forEach((line, lineIndex) => {
                    if (key) {
                      console.log(lines, line, key, a[id].slides[slideId].items[index].lines[line][key], i, lineIndex, values, values[i][lineIndex])
                      prev.values.push(a[id].slides[slideId].items[index][key] ? JSON.parse(JSON.stringify(a[id].slides[slideId].items[index].lines[line][key])) : null)
                      a[id].slides[slideId].items[index].lines[line][key] = values[i] ? (values[i][lineIndex] !== undefined ? values[i][lineIndex] : values[i][0]) : values[0][0]
                    } else {
                      prev.values.push(a[id].slides[slideId].items[index] ? JSON.parse(JSON.stringify(a[id].slides[slideId].items[index].lines[line])) : null)
                      a[id].slides[slideId].items[index].lines[line] = values[i] ? (values[i][lineIndex] !== undefined ? values[i][lineIndex] : values[i][0]) : values[0][0]
                    }
                  })
                })
              })
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
                    // WIP
                    a[id].slides[slideId].items[index].lines[lineIndexes[i]] = item
                  })
                })
              })
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
                  if (!lines.length) lines = Object.keys(shows[id].slides[slideId].items[index].lines)
                  lines.forEach((line) => {
                    prev.lineIndexes.push(line)
                    prev.items.push(a[id].slides[slideId].items[index].lines[line])
                    delete a[id].slides[slideId].items[index].lines[line]
                  })
                })
              })
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
      get: (key: string | null = null) => {
        let a: any[] = []
        if (layoutIds === "active") layoutIds = [shows[id]?.settings.activeLayout]
        else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
        layoutIds.forEach((layoutId: any) => {
          if (key) a.push(shows[id]?.layouts[layoutId][key])
          else a.push(shows[id]?.layouts[layoutId])
        })
        return a
      },
      /** Get full ref layout */
      ref: () => {
        let a: any[] = []
        if (shows[id]) {
          if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
          else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
          a.push([])
          layoutIds.forEach((layoutId: any, i: number) => {
            shows[id].layouts[layoutId].slides.forEach((layoutSlide: any, index: number) => {
              let slide = shows[id].slides[layoutSlide.id]
              a[i].push({ type: "parent", index, id: layoutSlide.id, children: slide.children || [], data: layoutSlide })
              if (slide.children) {
                slide.children.forEach((childId: string, jndex: number) => {
                  a[i].push({ type: "child", index: jndex, id: childId, parent: { id: layoutSlide.id, index }, data: layoutSlide.children?.[jndex] || {} })
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
          if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
          else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
          layoutIds.forEach((layoutId: any, i: number) => {
            if (i === 0) prev[i] = []
            prev[i].push(a[id].layouts[layoutId][key])
            a[id].layouts[layoutId][key] = value
          })
          return a
        })
        return prev
      },
      /** Add layout */
      add: (layoutId: string = uid(), layout: any = null) => {
        showsCache.update((a: any) => {
          a[id].layouts[layoutId] = layout || { name: "", notes: "", slides: [] }
          return a
        })
        return layoutId
      },
      remove: (layoutId: string) => {
        let prev: any[] = []
        showsCache.update((a: any) => {
          prev.push(a[id].layouts[layoutId])
          delete a[id].layouts[layoutId]
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
                a[id].layouts[layoutId].slides[index][key] = value
              })
            })
            return a
          })
          return prev
        },
        /** Add slide to layouts */
        add: (layouts: any[], parent: null | number = null) => {
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
              let length = slides.length
              if (indexes.length) {
                indexes
                  .sort((a, b) => a - b)
                  .forEach((index: number, i) => {
                    if (parent === null) a[id].layouts[layoutId].slides = addToPos(slides, [layouts[i]], index)
                    else {
                      if (!a[id].layouts[layoutId].slides[parent].children) a[id].layouts[layoutId].slides[parent].children = {}
                      a[id].layouts[layoutId].slides[parent].children[layouts[i].id] = removeId(layouts[i]) || {}
                    }
                  })
              } else {
                if (parent === null) a[id].layouts[layoutId].slides = addToPos(slides, layouts, length)
                else {
                  if (!a[id].layouts[layoutId].slides[parent].children) a[id].layouts[layoutId].slides[parent].children = {}
                  a[id].layouts[layoutId].slides[parent].children[layouts[0].id] = removeId(layouts[0]) || {}
                }
                // else a[id].layouts[layoutId].slides[parent].children = addToPos(slides, layouts, length)
                // layouts.forEach((layout, i) => {
                //   let index: number = indexes[i]
                //   if (index === undefined) index = length
                // })
              }
            })
            return a
          })
        },
        /** Remove slides in layouts */
        remove: (key: null | string = null) => {
          let prev: any = { indexes: [], layouts: [] }
          showsCache.update((a: any) => {
            if (layoutIds === "active") layoutIds = [shows[id].settings.activeLayout]
            else if (!layoutIds.length) layoutIds = Object.keys(shows[id].layouts)
            layoutIds.forEach((layoutId: any) => {
              if (!indexes.length) indexes = Object.keys(shows[id].layouts[layoutId].slides)
              indexes
                .sort((a, b) => b - a)
                .forEach((index: number) => {
                  prev.indexes.push(index)
                  if (key) {
                    prev.layouts.push(a[id].layouts[layoutId].slides[index][key])
                    delete a[id].layouts[layoutId].slides[index][key]
                  }
                  prev.layouts.push(a[id].layouts[layoutId].slides[index])
                  delete a[id].layouts[layoutId].slides[index]
                })
            })
            return a
          })
          return prev
        },
        /** Layout slides children function */
        children: (children: number[] = []) => ({
          /** Set layout slides children: {key: value} */
          set: ({ key, value }: any) => {
            let prev: any[] = []
            showsCache.update((a: any) => {
              if (!layoutIds.length) layoutIds = Object.keys(a[id].layouts)
              layoutIds.forEach((layoutId: any, i: number) => {
                if (i === 0) prev[i] = []
                if (!indexes.length) indexes = Object.keys(shows[id].layouts[layoutId].slides)
                indexes.forEach((index: number) => {
                  children.forEach((child: number) => {
                    if (!a[id].layouts[layoutId].slides[index].children) a[id].layouts[layoutId].slides[index].children = []
                    if (!a[id].layouts[layoutId].slides[index].children[child]) a[id].layouts[layoutId].slides[index].children[child] = {}
                    prev[i].push(a[id].layouts[layoutId].slides[index].children[child][key] || null)
                    a[id].layouts[layoutId].slides[index].children[child][key] = value
                  })
                })
              })
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
          a.push(shows[id].media[mediaId])
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
            a[id].media[mediaId][key] = value
          })
          return a
        })
        // return prev
      },
      /** Add new media */
      add: (object: any) => {
        let bgid: string = uid()
        showsCache.update((a: any) => {
          a[id].media[bgid] = object
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
          return a
        })
        return media
      },
    }),
  }
}

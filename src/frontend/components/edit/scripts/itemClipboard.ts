import { get } from "svelte/store"
import type { Item, ItemType } from "../../../../types/Show"
import { activeEdit, activeShow, showsCache } from "../../../stores"
import { clone } from "../../helpers/array"
import { history } from "../../helpers/history"
import { _show } from "../../helpers/shows"
import { getStyles } from "../../helpers/style"
import { boxes } from "../values/boxes"
import { itemEdits } from "../values/item"

type StyleClipboard = {
    keys: { [key: string]: any }
    style: { [key: string]: any }
    linesAlign?: string
}

// COPY //

// get current text style
export function getBoxStyle(item: Item): StyleClipboard {
    if (!item) return { keys: {}, style: {} }

    // skip scripture verse numbers (customType)
    let normalText = item.lines?.[0]?.text?.filter((a) => !a.customType) || []
    let style = normalText[0]?.style || item.style
    let linesAlign = item.lines?.[0]?.align || ""

    const extraKeyValues: string[] = getSpecialBoxValues(item)

    let itemKeys = getItemKeys(true)
    let newStyles: any = getStyles(style)

    // remove any item keys (used for other items than textbox)
    itemKeys.forEach((key) => {
        if (newStyles[key]) delete newStyles[key]
    })

    return clone({ keys: extraKeyValues, style: newStyles, linesAlign })
}

// get current item style
export function getItemStyle(item: Item): StyleClipboard {
    let style = item?.style
    if (!style) return { keys: {}, style: {} }

    let itemKeys = getItemKeys()
    let newStyles: any = getStyles(style)

    // only keep item keys
    Object.keys(newStyles).forEach((key) => {
        if (!itemKeys.includes(key)) delete newStyles[key]
    })

    return clone({ keys: {}, style: newStyles })
}

export function getSlideStyle(): StyleClipboard {
    let ref = _show().layouts("active").ref()[0]
    let settings = _show()
        .slides([ref[get(activeEdit).slide!].id])
        .get("settings")[0]

    return { keys: { settings: clone(settings) }, style: {} }
}

export function getFilterStyle(): StyleClipboard {
    let ref = _show().layouts("active").ref()[0]
    let slideData = ref[get(activeEdit).slide!].data

    const filterKeys = ["filterEnabled", "backdrop-filter", "filter"]

    let keys: any = {}
    filterKeys.forEach((key) => {
        keys[key] = slideData[key] || ""
    })

    return { keys, style: {} }
}

// PASTE //

export function setBoxStyle(style: StyleClipboard, slides: any, type: ItemType) {
    const itemKeys = getItemKeys(true)

    slides.forEach(updateSlideStyle)

    function updateSlideStyle(slide) {
        let items: any[] = []
        let values: any[] = []

        slide.items.forEach(updateItemStyle)

        if (!items.length || !values.length) return

        // item keys
        Object.keys(style.keys).forEach((key) => {
            history({
                id: "setItems",
                newData: { style: { key, values: [style.keys[key]] } },
                location: { page: "edit", show: get(activeShow)!, slide: slide.id, items },
            })
        })

        // line align
        if (style.linesAlign) {
            // history({
            //     id: "textStyle",
            //     newData: { style: { key: "align", values: [style.linesAlign] } },
            //     location: { page: "edit", show: get(activeShow)!, slide: slide.id, items },
            // })
            showsCache.update((a) => {
                ;(a[get(activeShow)!.id].slides[slide.id || ""]?.items || [])
                    .filter((_, i) => items.includes(i))
                    .forEach((item) => {
                        item.lines?.forEach((line) => {
                            line.align = style.linesAlign!
                        })
                    })
                return a
            })
        }

        if (type === "text") {
            // TEXTBOX or OTHER ITEMS
            history({
                id: type === "text" ? "textStyle" : "setStyle",
                newData: { style: { key: type === "text" ? "text" : "style", values } },
                location: { page: "edit", show: get(activeShow)!, slide: slide.id, items },
            })
        }

        function updateItemStyle(item: any, i: number) {
            let itemType = item.type || "text"
            if (itemType !== type) return

            // only apply to selected items with matching index
            if (get(activeEdit).items.length && !get(activeEdit).items.includes(i)) return

            items.push(i)

            let newStyle = ""
            Object.entries(style.style).forEach(([key, value]: any) => {
                newStyle += `${key}: ${value};`
            })

            if (type !== "text") {
                let itemStyles = getStyles(item.style)
                let newItemStyle = ""

                // add "item" style
                Object.entries(itemStyles).forEach(([key, value]: any) => {
                    if (itemKeys.includes(key)) newItemStyle += `${key}: ${value};`
                })

                values.push(newStyle + newItemStyle)
                return
            }

            if (!item.lines) return

            let text = item.lines.map((a: any) => {
                if (!a.text) return

                return a.text.map((a: any) => {
                    // don't style scripture verses
                    if (a.customType && !a.customType.includes("jw")) return a

                    a.style = newStyle

                    return a
                })
            })

            values.push(text)
        }
    }
}

export function setItemStyle(style: StyleClipboard, slides: any) {
    const itemKeys = getItemKeys()

    slides.forEach(updateSlideStyle)

    function updateSlideStyle(slide) {
        let values: string[] = []

        let items: number[] = []
        slide.items.forEach(updateItemStyle)
        // fix items swapping positions!
        items = items.reverse()

        history({
            id: "setStyle",
            newData: { style: { key: "style", values } },
            location: { page: "edit", show: get(activeShow)!, slide: slide.id, items },
        })

        function updateItemStyle(item, i) {
            // only apply to selected items if not apply to all
            if (slides.length === 1 && get(activeEdit).items.length && !get(activeEdit).items.includes(i)) return

            items.push(i)

            // get new style
            let newStyle = ""
            Object.entries(style.style).forEach(([key, value]: any) => {
                newStyle += `${key}: ${value};`
            })

            // get only current style
            let itemStyles = getStyles(item.style)
            let currentStyle = ""

            // get current style not for "item"
            Object.entries(itemStyles).forEach(([key, value]: any) => {
                if (!itemKeys.includes(key)) currentStyle += `${key}: ${value};`
            })

            console.log(style, newStyle, currentStyle)

            values.push(currentStyle + newStyle)
        }
    }
}

export function setSlideStyle(style: StyleClipboard, slides: any) {
    slides.forEach(updateSlideStyle)

    function updateSlideStyle(slide) {
        let oldData = { style: slide.settings }

        history({
            id: "slideStyle",
            oldData,
            newData: { style: style.keys?.settings || {} },
            location: { page: "edit", show: get(activeShow)!, slide: slide.id },
        })
    }
}

export function setFilterStyle(style: StyleClipboard, indexes: number[]) {
    Object.entries(style.keys).forEach(([key, data]) => {
        if (key === "filterEnabled") history({ id: "SHOW_LAYOUT", newData: { key, data: data || ["background"], dataIsArray: true, indexes } })
        else history({ id: "SHOW_LAYOUT", newData: { key, data, indexes } })
    })
}

/////

const itemAndBoxKeys = ["background-color"]
export function getItemKeys(isBox: boolean = false) {
    // replace just item style or just box style if not textbox
    let itemKeys: string[] = []

    Object.values(itemEdits).forEach((values) => {
        itemKeys.push(...values.map((a) => a.key || ""))
        // WIP transform not working with this
    })

    if (isBox) itemKeys = itemKeys.filter((a) => !itemAndBoxKeys.includes(a))
    return itemKeys
}

function getSpecialBoxValues(item: Item) {
    let keyValues: any = {}
    let inputs = Object.values(boxes[item.type || "text"]?.edit || {}).flat()
    inputs.push({ id: "align", input: "" })

    inputs.forEach((input) => {
        let id = input.id
        if (!id || id === "style") return

        if (id.includes(".")) id = id.slice(0, id.indexOf("."))
        if (item[id] !== undefined) keyValues[id] = item[id]
    })

    return keyValues
}

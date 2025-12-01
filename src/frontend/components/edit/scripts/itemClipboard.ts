import { get } from "svelte/store"
import type { Item, ItemType } from "../../../../types/Show"
import { activeEdit, activeShow, showsCache } from "../../../stores"
import { wait } from "../../../utils/common"
import { clone } from "../../helpers/array"
import { history } from "../../helpers/history"
import { getLayoutRef } from "../../helpers/show"
import { _show } from "../../helpers/shows"
import { getStyles } from "../../helpers/style"
import { itemBoxes } from "../values/boxes"
import { itemSections } from "../values/item"

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
    const normalText = item.lines?.[0]?.text?.filter(a => !a.customType) || []
    const style = normalText[0]?.style || item.style
    const linesAlign = item.lines?.[0]?.align || ""

    const extraKeyValues: string[] = getSpecialBoxValues(item)

    const itemKeys = getItemKeys(true)
    const newStyles: { [key: string]: number | string } = getStyles(style)

    // remove any item keys (used for other items than textbox)
    itemKeys.forEach(key => {
        if (newStyles[key]) delete newStyles[key]
    })

    return clone({ keys: extraKeyValues, style: newStyles, linesAlign })
}

// get current item style
export function getItemStyle(item: Item): StyleClipboard {
    const style = item?.style
    if (!style) return { keys: {}, style: {} }

    const itemKeys = getItemKeys()
    const newStyles = getStyles(style)

    // only keep item keys
    Object.keys(newStyles).forEach(key => {
        if (!itemKeys.includes(key)) delete newStyles[key]
    })

    return clone({ keys: {}, style: newStyles })
}

// get current item style
export function filterItemStyle(style: string, isItem: boolean) {
    if (typeof style !== "string" || !style) return ""

    const itemKeys = getItemKeys()
    const styles = getStyles(style)

    // only keep item keys
    let newStyle = ""
    Object.entries(styles).forEach(([key, value]) => {
        const hasItemKey = itemKeys.includes(key)
        if (isItem ? hasItemKey : !hasItemKey) newStyle += `${key}: ${value};`
    })

    return newStyle
}
export function mergeWithStyle(newStyle: string, oldStyle: string, isItem: boolean) {
    return filterItemStyle(oldStyle, !isItem) + newStyle
}

export function getSlideStyle(): StyleClipboard {
    const ref = getLayoutRef()
    const settings = _show()
        .slides([ref[get(activeEdit).slide!]?.id])
        .get("settings")[0]

    return { keys: { settings: clone(settings) }, style: {} }
}

export function getFilterStyle(): StyleClipboard {
    const ref = getLayoutRef()
    const slideData = ref[get(activeEdit).slide!]?.data || {}

    const filterKeys = ["backdrop-filter", "filter"]

    const keys: { [key: string]: number | string } = {}
    filterKeys.forEach(key => {
        keys[key] = slideData[key] || ""
    })

    return { keys, style: {} }
}

// PASTE //

export async function setBoxStyle(styles: StyleClipboard[], slides: any, type: ItemType) {
    const itemKeys = getItemKeys(true)

    for (const slide of slides) {
        updateSlideStyle(slide)

        // prevent lag when updating many slides
        await wait(10)
    }

    function updateSlideStyle(slide) {
        if (!slide || !get(activeShow)) return

        const items: number[] = []
        const values: any[] = []

        slide.items.forEach(updateItemStyle)

        if (!items.length || !values.length) return

        const style = styles[0]

        // item keys
        Object.keys(style.keys).forEach(key => {
            const value = style.keys[key]
            history({
                id: "setItems",
                newData: { style: { key, values: [style.keys[key]] } },
                location: { page: "edit", show: get(activeShow)!, slide: slide.id, items }
            })

            if (key === "textFit") {
                history({
                    id: "setItems",
                    newData: { style: { key: "auto", values: [value && value !== "none"] } },
                    location: { page: "edit", show: get(activeShow)!, slide: slide.id, items }
                })
            }
        })

        // line align
        if (style.linesAlign) {
            // history({
            //     id: "textStyle",
            //     newData: { style: { key: "align", values: [style.linesAlign] } },
            //     location: { page: "edit", show: get(activeShow)!, slide: slide.id, items },
            // })
            showsCache.update(a => {
                ;(a[get(activeShow)!.id]?.slides[slide.id || ""]?.items || [])
                    .filter((_, i) => items.includes(i))
                    .forEach(item => {
                        item.lines?.forEach(line => {
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
                location: { page: "edit", show: get(activeShow)!, slide: slide.id, items }
            })
        }

        function updateItemStyle(item: Item, i: number) {
            const itemType = item.type || "text"
            if (itemType !== type) return

            // only apply to selected items with matching index
            if (get(activeEdit).items.length && !get(activeEdit).items.includes(i)) return

            items.push(i)

            const currentStyle = styles[i] || styles[0]

            let newStyle = ""
            Object.entries(currentStyle.style).forEach(([key, value]) => {
                newStyle += `${key}: ${value};`
            })

            if (type !== "text") {
                const itemStyles = getStyles(item.style)
                let newItemStyle = ""

                // add "item" style
                Object.entries(itemStyles).forEach(([key, value]) => {
                    if (itemKeys.includes(key)) newItemStyle += `${key}: ${value};`
                })

                values.push(newStyle + newItemStyle)
                return
            }

            if (!item.lines) return

            const newLines = item.lines.map(line => {
                if (!line.text) return

                return line.text.map(text => {
                    // don't style scripture verses
                    if (text.customType && !text.customType.includes("jw")) return text

                    text.style = newStyle

                    return text
                })
            })

            values.push(newLines)
        }
    }
}

export async function setItemStyle(styles: StyleClipboard[], slides: any) {
    // TODO: pasting to multiple items will move around the text lines content

    const itemKeys = getItemKeys()

    for (const slide of slides) {
        updateSlideStyle(slide)

        // prevent lag when updating many slides
        await wait(10)
    }

    function updateSlideStyle(slide) {
        const values: string[] = []

        let items: number[] = []
        slide.items.forEach(updateItemStyle)
        // fix items swapping positions!
        items = items.reverse()

        history({
            id: "setStyle",
            newData: { style: { key: "style", values } },
            location: { page: "edit", show: get(activeShow)!, slide: slide.id, items }
        })

        function updateItemStyle(item, i) {
            // only apply to selected items if not apply to all
            if (slides.length === 1 && get(activeEdit).items.length && !get(activeEdit).items.includes(i)) return

            items.push(i)

            const style = styles[i] || styles[0]

            // get new style
            let newStyle = ""
            Object.entries(style.style).forEach(([key, value]) => {
                newStyle += `${key}: ${value};`
            })

            // get only current style
            const itemStyles = getStyles(item.style)
            let currentStyle = ""

            // get current style not for "item"
            Object.entries(itemStyles).forEach(([key, value]) => {
                if (!itemKeys.includes(key)) currentStyle += `${key}: ${value};`
            })

            values.push(currentStyle + newStyle)
        }
    }
}

export async function setSlideStyle(style: StyleClipboard, slides: any) {
    for (const slide of slides) {
        updateSlideStyle(slide)

        // prevent lag when updating many slides
        await wait(10)
    }

    function updateSlideStyle(slide) {
        const oldData = { style: slide.settings || {} }

        history({
            id: "slideStyle",
            oldData,
            newData: { style: style.keys?.settings || {} },
            location: { page: "edit", show: get(activeShow)!, slide: slide.id }
        })
    }
}

export function setFilterStyle(style: StyleClipboard, indexes: number[]) {
    Object.entries(style.keys).forEach(([key, data]) => {
        // if (key === "filterEnabled") history({ id: "SHOW_LAYOUT", newData: { key, data: data || ["background"], dataIsArray: true, indexes } }) else
        history({ id: "SHOW_LAYOUT", newData: { key, data, indexes } })
    })
}

/// //

const itemAndBoxKeys = ["background-color"]
export function getItemKeys(isBox = false) {
    // replace just item style or just box style if not textbox
    let itemKeys: string[] = []

    Object.values(itemSections).forEach(values => {
        itemKeys.push(
            ...values.inputs.flat().map(a => {
                const key = a.id === "style" ? a.key : a.id
                return key || ""
            })
        )
    })

    // gradient
    if (!isBox) itemKeys.push("background")

    if (isBox) itemKeys = itemKeys.filter(a => !itemAndBoxKeys.includes(a))
    return itemKeys
}

function getSpecialBoxValues(item: Item) {
    const keyValues: any = {}
    const inputIds = Object.values(itemBoxes[item.type || "text"]?.sections || {})
        .map(a => a.inputs.flat())
        .flat()
        .map(({ id }) => id)

    inputIds.forEach(id => {
        if (id === "style") return

        if (id.includes(".")) id = id.slice(0, id.indexOf("."))
        if (item[id] !== undefined) keyValues[id] = item[id]
    })

    if (item.align) keyValues.align = item.align

    return keyValues
}

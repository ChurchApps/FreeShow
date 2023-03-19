<script lang="ts">
    import { uid } from "uid"
    import type { Item } from "../../../types/Show"
    import { slidesOptions } from "../../stores"
    import { removeSlide } from "../context/menuClick"
    import { history } from "../helpers/history"
    import { getGlobalGroup } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import Notes from "./tools/Notes.svelte"

    export let currentShow: any

    let text: string = ""
    $: if (currentShow) getText()

    // slide data for editing
    let slidesData: any[] = []

    function getText() {
        let ref = _show().layouts("active").ref()[0]
        let slides = _show().get("slides")

        text = ""
        slidesData = []

        ref.forEach((refSlide) => {
            let id = refSlide.id
            let slide = slides[id]
            if (!slide) return

            let slideData: any = { id, items: slide.items, text: "", ref: refSlide }

            if (slide.group !== null) {
                let groupId = "[" + slide.group + "]"
                text += groupId + "\n"
                slideData.text += groupId + (slide.items.length ? "\n" : "")
                // text += "[" + slide.group + "#" + id + "]\n"
            }

            // TODO: multiple items!!!!

            let data = getItems(slide.items)
            text += data.text

            slideData.text += data.plainText
            // slideData.text += plainText.replaceAll("\n\n", "")
            slidesData.push(slideData)
        })

        text = text.trim()
    }

    function getItems(items) {
        let text = ""
        let plainText = ""

        items.forEach((item) => {
            // console.log(item)
            if (!item.lines) return

            let filteredLines = item.lines?.filter((line) => line.text?.filter((text) => text.value.length).length)
            filteredLines.forEach((line, i) => {
                let tempText = ""
                line.text?.forEach((txt) => {
                    tempText += txt.value
                })

                if (tempText.length) {
                    text += tempText + "\n"
                    plainText += tempText + (i < filteredLines.length - 1 ? "\n" : "")
                }
            })
            text += "\n"
            // plainText += "\n"
        })
        if (!items.length) {
            text += "\n"
            // plainText += "\n"
        }

        return { text, plainText }
    }

    const br = "[[__$BREAK$__]]"

    function editText(e: any) {
        let newText = e.detail.split("\n\n")

        let layout = _show().layouts("active").get("slides")[0]
        let slides = _show().get("slides")
        let changed: boolean = false

        console.log(newText)
        console.log(slidesData)

        for (let i = 0; i < newText.length; i++) {
            let text = newText[i].replaceAll("\n", br)
            let originalText = slidesData[i]?.text?.replaceAll("\n", br) || ""

            if (text !== originalText) {
                let state = "changed"

                let nextText = newText[i + 1]?.replaceAll("\n", br) || ""
                if (originalText === nextText) state = "added"
                else {
                    let nextOriginalText = slidesData[i + 1]?.text?.replaceAll("\n", br) || ""
                    if (text === nextOriginalText) state = "removed"
                }

                let group: any = null
                if (text.indexOf("[") === 0 && text.replaceAll(br, "").indexOf("]") >= 0) {
                    group = text.slice(text.indexOf("[") + 1, text.indexOf("]"))
                    console.log(group)
                    // TODO: group edited!

                    text = text.substring(text.indexOf("]") + 1)

                    if (slidesData[i].ref.type !== "parent") state = "added"
                }

                console.log("Index " + i + ":")
                console.log("NOT EQUAL", text, originalText)
                console.log(slidesData[i])
                console.log(state)

                // TODO: get new [verse] (child)

                if (state === "removed") {
                    removeSlide([{ index: i }])
                    slidesData.splice(i, 1)
                    i--
                } else if (state === "added") {
                    // TODO: check for duplicates
                    let id = uid()
                    if (!slides[id]) {
                        slides[id] = { group, color: null, items: [], notes: "", settings: {} }
                        let parent = slidesData[i > 0 ? i - 1 : 0] || {}
                        parent = parent.ref?.parent?.id || parent.id

                        if (group) {
                            // remove from parent if child
                            if (slides[parent]) {
                                let index = slides[parent].children?.indexOf(parent.id)
                                if (index >= 0) slides[parent].children.splice(index, 1)
                            }
                            // TODO: move children underneath

                            let globalGroup = getGlobalGroup(group)
                            if (globalGroup) slides[id].globalGroup = globalGroup

                            let index = i + 1
                            if (parent) {
                                index = i - 1
                                slidesData.splice(i, 0, [])
                            }
                            layout.splice(index, 0, { id })
                        } else {
                            // get insert child index
                            let index = 0
                            if (!slides[parent].children) slides[parent].children = []
                            else {
                                index = slides[parent].children.findIndex((childId: string) => {
                                    let childText = getItems(slides[childId].items).plainText?.replaceAll("\n", br) || ""
                                    if (childText === nextText) return true
                                    return false
                                })
                                if (index < 0) index = slides[parent].children.length
                            }

                            slides[parent].children.splice(index, 0, id)

                            slidesData.splice(i, 0, [])
                        }
                    }
                    console.log(text)
                    slides[id].items = createItems([], [text])
                    console.log(slides[id].items)

                    changed = true
                } else if (state === "changed") {
                    slides[slidesData[i].id].items = createItems(slides[slidesData[i].id].items, [text])
                    changed = true
                }

                // update group
                if (group && state !== "removed") {
                    let globalGroup = getGlobalGroup(group)
                    if (globalGroup && slides[slidesData[i].id]) slides[slidesData[i].id].globalGroup = globalGroup
                    changed = true
                }
            }
        }

        if (changed) {
            history({ id: "slide", newData: { slides, layout }, location: { page: "show", layout: _show().get("settings.activeLayout") } })
            getText()
        }
    }

    function createItems(oldItems, newItemsText) {
        let items: Item[] = oldItems.filter((item) => !item.lines?.length)

        // get old style
        let styleItem = oldItems.find((item) => item.lines?.length) || {}
        newItemsText.forEach((text) => {
            let textItem = {
                align: styleItem.align || "",
                style: styleItem.style || "",
                lines: text.split(br).map((line) => ({ align: styleItem.lines?.[0]?.align || "", text: [{ style: styleItem.lines?.[0]?.text?.[0]?.style || "", value: line }] })),
            }
            items.push(textItem)
        })

        return items
    }
</script>

<Notes style="padding: 30px;font-size: {(-1.1 * $slidesOptions.columns + 12) / 6}em;" value={text} on:change={editText} />

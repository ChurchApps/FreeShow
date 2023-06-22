<script lang="ts">
    import { uid } from "uid"
    import type { Item } from "../../../types/Show"
    import { convertText, getQuickExample } from "../../converters/txt"
    import { mergeDuplicateSlides } from "../../show/slides"
    import { slidesOptions } from "../../stores"
    import { removeSlide } from "../context/menuClick"
    import { clone } from "../helpers/array"
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
            let data = getItems(slide.items)

            if (slide.group !== null && data.hasTextboxItem) {
                let groupId = "[" + (replaceValues(slide.group, true) || "—") + "]"
                text += groupId + "\n"
                slideData.text += groupId + "\n"
                // text += "[" + slide.group + "#" + id + "]\n"
            }

            // TODO: multiple textbox items!!!!

            // if (data.text.length && text[text.length - 1] === "]") text += "\n"
            text += data.text

            slideData.text += data.plainText
            // slideData.text += plainText.replaceAll("\n\n", "")

            // don't add slides without textboxes
            if (data.hasTextboxItem) slidesData.push(slideData)
        })

        text = text.trim()
    }

    function getItems(items) {
        let text = ""
        let plainText = ""
        let hasTextboxItem: boolean = false

        items.forEach((item) => {
            // console.log(item)
            if (!item.lines) return
            hasTextboxItem = true

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
            // remove double enters
            text = text.replaceAll("\n\n", "")
            text += "\n"
            // plainText += "\n"
        })
        // if (!items.length) {
        //     text += "\n"
        //     // plainText += "\n"
        // }

        return { text, plainText, hasTextboxItem }
    }

    const br = "||__$BREAK$__||"
    // const startBracket = "||__$[$__||"
    // const endBracket = "||__$]$__||"

    function replaceValues(text: string, revert: boolean = false) {
        if (!text) return ""

        if (revert) return text.replaceAll(br, "\n")
        return text.replaceAll("\n", br)
        // if (revert) return text.replaceAll(br, "\n").replaceAll(startBracket, "[").replaceAll(endBracket, "]")
        // return text.replaceAll("[", startBracket).replaceAll("]", endBracket).replaceAll("\n", br)
    }

    function editText(e: any) {
        let newText = e.detail.split("\n\n")

        let layout = _show().layouts("active").get("slides")[0]
        let slides = _show().get("slides")
        let changed: boolean = false

        // do initial text conversion if text is empty
        if (!text.length && !layout.length) {
            let convertedText = convertText({ text: e.detail }, true, { existingSlides: slides })

            slides = convertedText.slides
            layout = convertedText.layouts

            changed = true
        } else if (!newText.filter((a) => a).length) {
            // empty
            changed = true
            // WIP keep the slides without textboxes
            layout = []
        } else {
            for (let i = 0; i < newText.length; i++) {
                let text = replaceValues(newText[i])
                let originalText = replaceValues(slidesData[i]?.text)

                if (text !== originalText) {
                    let state = "changed"
                    let nextText = replaceValues(newText[i + 1])
                    let nextOriginalText = replaceValues(slidesData[i + 1]?.text)

                    if (newText.length !== slidesData.length && originalText === nextText) state = "added"
                    else if (text === nextOriginalText) state = "removed"

                    let group: any = null
                    if (text.indexOf("[") === 0 && text.replaceAll(br, "").indexOf("]") >= 0) {
                        group = text.slice(text.indexOf("[") + 1, text.indexOf("]"))
                        text = text.substring(text.indexOf("]") + 1)

                        if (state === "changed" && slidesData[i]?.ref?.type !== "parent") {
                            // state = "changed"

                            // WIP better way to differenciate new groups vs changed groups
                            if (nextText === nextOriginalText) state = "changed_child_to_parent"
                        }
                    }

                    if (state === "changed" && !slidesData[i]) state = "added"

                    if (state === "removed") {
                        // this will not remove group from children but it shouldn't to match right click delete slide

                        removeSlide([{ index: i }])
                        slidesData.splice(i, 1)
                        i--
                    } else if (state === "added") {
                        // TODO: check for duplicates
                        let id = uid()
                        let parentId: string = ""
                        if (!slides[id]) {
                            slides[id] = { group, color: null, items: [], notes: "", settings: {} }
                            let parent = slidesData[i > 0 ? i - 1 : 0] || {}
                            parentId = parent.ref?.parent?.id || parent.id

                            if (group !== null) {
                                // let childrenChanged = 0

                                // remove from parent if child (existing child got added group)
                                let isNewChild = false
                                if (slides[parentId]) {
                                    // // WIP hmmm
                                    // let index = slides[parentId].children?.indexOf(parent.id)
                                    // if (index >= 0) slides[parentId].children.splice(index, 1)

                                    // TODO: move children underneath

                                    // check if new pos is between some other slides
                                    let parentChildren = slides[parentId].children || []
                                    let nextSlide = slidesData[i] || {}
                                    let childIndex = parentChildren.indexOf(nextSlide.id)
                                    if (childIndex >= 0) {
                                        isNewChild = true
                                        let newSlideChildren = clone(parentChildren)
                                        slides[parentId].children = parentChildren.slice(0, childIndex)
                                        newSlideChildren = newSlideChildren.slice(childIndex)
                                        // childrenChanged = newSlideChildren.length

                                        slides[id].children = newSlideChildren
                                    }
                                }

                                let globalGroup = getGlobalGroup(group)
                                if (globalGroup) slides[id].globalGroup = globalGroup
                                else slides[id].group = group

                                // let index = i + 1
                                if (isNewChild) {
                                    // index--
                                    // index = i - 1
                                    i--
                                }
                                slidesData.splice(i, 0, [])

                                let layoutIndex = slidesData[i + 1]?.ref?.parent?.index ?? slidesData[i + 1]?.ref?.index ?? layout.length
                                layout.splice(layoutIndex, 0, { id })
                            } else if (slides[parentId]) {
                                // get insert child index
                                let index = 0
                                if (!slides[parentId].children) slides[parentId].children = []
                                else {
                                    index = slides[parentId].children.findIndex((childId: string) => {
                                        let childText = replaceValues(getItems(slides[childId].items).plainText)
                                        if (childText === nextText) return true
                                        return false
                                    })
                                    if (index < 0) index = slides[parentId].children.length
                                }

                                slides[parentId].children.splice(index, 0, id)

                                slidesData.splice(i, 0, [])
                            }
                        }

                        slides[id].items = createItems(slides[parentId]?.items || [], [text], true)

                        changed = true
                    } else if (state === "changed") {
                        // add children to another parent slide if group removed

                        if (i > 0 && group === null && slidesData[i].ref?.type === "parent") {
                            let children = clone(slides[slidesData[i].id].children || [])
                            // add this slide to children
                            children = [slidesData[i].id, ...children]

                            let siblingSlide = slidesData[i - 1]?.ref || {}
                            let previousParent = siblingSlide.parent?.id || siblingSlide.id

                            if (children.length && previousParent) {
                                if (!slides[previousParent].children) slides[previousParent].children = []
                                slides[previousParent].children.push(...children)
                            }

                            slides[slidesData[i].id].group = null
                            delete slides[slidesData[i].id].globalGroup
                            delete slides[slidesData[i].id].children
                            // remove from layout
                            let index = slidesData[i].ref.index
                            layout.splice(index, 1)
                        }

                        slides[slidesData[i].id].items = createItems(slides[slidesData[i].id].items, [text])
                        changed = true
                    } else if (state === "changed_child_to_parent") {
                        let currentSlideId = slidesData[i].id
                        let parentSlideId = slidesData[i].ref.parent?.id
                        let parentChildren = slides[parentSlideId].children || []
                        let currentChildIndex = parentChildren.indexOf(currentSlideId)

                        if (currentChildIndex >= 0) {
                            let newParentChildren = clone(parentChildren.slice(0, currentChildIndex))
                            // add one to remove current slide
                            let newSlideChildren = parentChildren.slice(currentChildIndex + 1)

                            slides[parentSlideId].children = newParentChildren
                            slides[currentSlideId].children = newSlideChildren
                        }

                        // add to layout
                        let index = slidesData[i].ref.parent?.index || 0
                        layout.splice(index + 1, 0, { id: currentSlideId })
                        slides[currentSlideId].group = ""

                        changed = true
                    }

                    // update group
                    if (group !== null && state !== "removed" && slides[slidesData[i].id]) {
                        let globalGroup = getGlobalGroup(group)

                        if (globalGroup && slides[slidesData[i].id]) {
                            slides[slidesData[i].id].globalGroup = globalGroup
                        } else {
                            delete slides[slidesData[i].id].globalGroup
                            slides[slidesData[i].id].group = group
                        }

                        changed = true
                    }
                }
            }
        }

        if (changed) {
            // merge duplicate slides & remove unused children
            let merged = mergeDuplicateSlides({ slides, layout })
            slides = merged.slides
            layout = merged.layout

            slides = history({ id: "slide", newData: { slides, layout }, location: { page: "show", layout: _show().get("settings.activeLayout") } })
            getText()
        }
    }

    function createItems(oldItems, newItemsText, onlyStyles: boolean = false) {
        let items: Item[] = oldItems.filter((item) => !item.lines?.length)
        if (onlyStyles) items = []
        console.log(items, oldItems)

        // get old style
        let styleItem = oldItems.find((item) => item.lines?.length) || {}
        console.log("OLD STYLE ITEM", styleItem)
        newItemsText.forEach((text) => {
            let lines = text.split(br).filter((a) => a)

            let textItem = {
                align: styleItem.align || "",
                style: styleItem.style || "top:120px;left:50px;height:840px;width:1820px;",
                lines: lines.map((line) => ({ align: styleItem.lines?.[0]?.align || "", text: [{ style: styleItem.lines?.[0]?.text?.[0]?.style || "", value: line }] })),
            }
            items.push(textItem)
        })

        return items
    }
</script>

<Notes style="padding: 30px;font-size: {(-1.1 * $slidesOptions.columns + 12) / 6}em;" placeholder={getQuickExample()} value={text} on:change={editText} />

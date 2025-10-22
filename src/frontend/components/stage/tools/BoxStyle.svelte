<script lang="ts">
    import { activeStage, stageShows, theme, themes } from "../../../stores"
    import { MAX_FONT_SIZE } from "../../edit/scripts/autosize"
    import { addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { itemBoxes, setBoxInputValue } from "../../edit/values/boxes"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import { updateStageShow } from "../stage"
    import { slideTextSections } from "../values/text"

    let activeItemIds: string[] = []
    $: activeItemIds = $activeStage.items?.length ? $activeStage.items : Object.keys(stageItems)
    $: stageItems = $stageShows[$activeStage.id!]?.items || {}
    $: activeItemId = activeItemIds[0] || ""

    $: item = activeItemId ? stageItems[activeItemId] : null

    $: type = item?.type || ""
    $: {
        if (activeItemId.includes("tracker")) type = "slide_tracker"
        else if (item?.type === "slide_text" || item?.type === "slide_notes" || item?.type === "variable" || activeItemId.includes("text") || activeItemId.includes("slide") || activeItemId.includes("notes") || activeItemId.includes("variable"))
            type = "text"
        else if (activeItemId.includes("clock")) type = "clock"
        else if (activeItemId.includes("timer")) type = "timer"
    }

    $: isSlideText = item?.type === "slide_text" // || activeItemId?.includes("slide_text")
    $: isTextItem = item?.type === "slide_text" || item?.type === "text"
    $: stageSections = item ? clone(isSlideText ? slideTextSections : itemBoxes[item.type || ""]?.sections) || {} : {}

    $: if (item?.type === "text" && stageSections) {
        delete stageSections.chords
        delete stageSections.scrolling
    }
    $: if (isSlideText) {
        stageSections = clone(item?.keepStyle ? { default: slideTextSections.default } : slideTextSections)

        // setBoxInputValue(stageSections, "font", "font-weight", "default", "bold")
    }

    $: if (stageSections?.CSS) {
        setBoxInputValue(stageSections, "CSS", "CSS_text", "value", item?.style || "")
    }

    // align
    let alignStyle: any = {}
    let lineAlignStyle: any = {}
    $: if (item?.align) alignStyle = { "align-items": item.align }
    $: if (item?.alignX) lineAlignStyle = { "text-align": item.alignX }

    $: customValues = {
        "text-align": lineAlignStyle["text-align"] || "center",
        "align-items": alignStyle["align-items"] || "center"
    }

    let styles: { [key: string]: any } = {}
    $: if (item?.style || item === null) styles = getStyles(item?.style, true)

    $: if (stageSections?.font || type === "text") {
        setBoxInputValue(stageSections, "font", "font-size", "disabled", !isTextItem && item?.textFit === "growToFit")
        setBoxInputValue(stageSections, "font", "textFit", "value", item?.textFit || "growToFit")
        // setBoxInputValue(stageSections, "font", "auto", "value", item.auto ?? true)

        setBoxInputValue(stageSections, "text", "nowrap", "value", !!styles["white-space"]?.includes("nowrap"))
    }

    $: if (item && type === "text") {
        let sectionId = stageSections?.font ? "font" : "default"
        setBoxInputValue(stageSections, sectionId, "font-family", "default", "Arial")
        setBoxInputValue(stageSections, sectionId, "font-family", "styleValue", styles["font"] || "")
        // setBoxInputValue(stageSections, sectionId, "font-size", "disabled", item.type === "text" ? item.auto === true : item.auto !== false)
        // setBoxInputValue(edits, sectionId, "textFit", "hidden", item?.auto !== false)
    }
    $: if (item && isSlideText) {
        setBoxInputValue(stageSections, "default", "lineCount", "hidden", Number(item.slideOffset || 0) === 0)
        setBoxInputValue(stageSections, "default", "invertItems", "hidden", Number(item.itemNumber || 0) !== 0)
    }

    $: if (item?.type === "slide_tracker" || activeItemId?.includes("tracker")) {
        setBoxInputValue(stageSections, "default", "tracker.accent", "value", item?.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C")

        setBoxInputValue(stageSections, "default", "tracker.childProgress", "hidden", item?.tracker?.type !== "group")
        setBoxInputValue(stageSections, "default", "tracker.oneLetter", "hidden", item?.tracker?.type !== "group")
    }

    $: if (item?.type === "camera") {
        if (item.device?.name) setBoxInputValue(stageSections, "default", "device", "name", item.device.name)
    }

    $: if (item?.type === "timer" && item) {
        setBoxInputValue(stageSections, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
        // setBoxInputValue(stageSections, "default", "timer.showHours", "value", item.timer?.showHours !== false)
        setBoxInputValue(stageSections, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time")
    }
    $: if (item?.type === "clock" && item) {
        const clockType = item.clock?.type || "digital"
        const dateFormat = item.clock?.dateFormat || "none"

        setBoxInputValue(stageSections, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue(stageSections, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue(stageSections, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
        setBoxInputValue(stageSections, "default", "clock.customFormat", "hidden", clockType !== "custom")

        // show seconds by default on stage
        setBoxInputValue(stageSections, "default", "clock.seconds", "value", true)
    }

    function setValue(input: any) {
        let value: any = input.value
        // if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        // else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

        if (input.id.includes(".")) {
            let splitted = input.id.split(".")
            input.id = splitted[0]
            let newValue = item?.[input.id] || {}
            newValue[splitted[1]] = value
            value = newValue
        }
        history({
            id: "UPDATE",
            newData: { data: value, key: "items", subkey: input.id, keys: activeItemIds },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") }
        })
    }

    function updateAlign(input) {
        let id = "align"
        if (input.key === "text-align") id = "alignX"

        let value = input.value

        history({
            id: "UPDATE",
            newData: { data: value, key: "items", subkey: id, keys: activeItemIds },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") }
        })
    }

    // WIP textbox lines does not update only selected text

    function updateStyle(e: any) {
        let input = e.detail

        if (input.key === "text-align" || input.key === "align-items") updateAlign(input)

        if (input.id === "nowrap") input = { ...input, id: "style", key: "white-space", value: input.value ? "nowrap" : undefined }

        if (input.id !== "style" && !input.id.includes("CSS")) {
            setValue(input)
            return
        }

        let value: string = addStyleString(item?.style || "", [input.key, input.value]) || ""

        if (input.id.includes("CSS")) value = input.value.replaceAll("\n", "")

        if (!value) return

        // only update items with same type
        let updateType = item?.type

        // only update changed value
        let styles: { [key: string]: string } = {}
        activeItemIds.forEach((itemId) => {
            let item = stageItems[itemId]
            if (!item || (!$activeStage.items?.length && item.type !== updateType)) return

            styles[itemId] = input.id.includes("CSS") ? value : addStyleString(item.style, [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: styles, key: "items", subkey: "style", keys: Object.keys(styles) },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") }
        })

        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    function updateStyle2(e: any) {
        const input = e.detail
        input.value = input.values.value
        input.input = input.type

        if (input.id === "textFit") {
            updateStyle({ detail: { id: "auto", value: input.value !== "none" } })

            if (isTextItem) {
                let newFontSize = 0
                // change font size to more clearly indicate what the different text fit does
                if (input.value !== "growToFit" && Number(styles["font-size"]) < 200) newFontSize = 0
                else newFontSize = input.value !== "growToFit" ? 100 : MAX_FONT_SIZE
                if (newFontSize) updateStyle({ detail: { name: "font_size", id: "style", key: "font-size", value: newFontSize + "px" } })
            }
        }

        updateStyle({ detail: input })
    }

    let timeout: NodeJS.Timeout | null = null
</script>

<EditValues sections={stageSections} {styles} {item} {customValues} on:change={updateStyle2} isStage />

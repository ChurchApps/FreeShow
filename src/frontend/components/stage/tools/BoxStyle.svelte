<script lang="ts">
    import { activeStage, stageShows, theme, themes } from "../../../stores"
    import { addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { boxes, type EditInput, setBoxInputValue } from "../../edit/values/boxes"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import { updateStageShow } from "../stage"
    import { slideNotesEdit, slideTextEdits, variableEdits } from "../values/text"

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

    let edits: { [key: string]: EditInput[] } = {}
    let defaultEdits = edits
    $: if (item) initEdits()
    function initEdits() {
        if (!item) return

        edits = clone(boxes[type]?.edit || {})

        if (type === "text") {
            setBoxInputValue(edits, "default", "font-family", "value", "Arial")
            removeInput(edits.default, "textFit")
            removeInput(edits.text, "nowrap")
            removeInput(edits.lines, "specialStyle.lineBg")
            removeInput(edits.lines, "specialStyle.opacity")
            delete edits.list
            removeInput(edits.special, "scrolling.type")
            removeInput(edits.special, "scrolling.speed")
        }

        if (item.type === "slide_text" || activeItemId.includes("slide_text")) {
            let newEdits = clone(edits)
            delete newEdits.default

            if (item.keepStyle) {
                let textEdits = clone(slideTextEdits)
                removeInput(textEdits, "invertItems")
                edits = { default: textEdits }
            } else {
                edits = { default: clone(slideTextEdits), font: edits.default, ...newEdits }
            }
        } else if (item.type === "slide_notes") {
            let newEdits = clone(edits)
            delete newEdits.default
            delete newEdits.chords
            edits = { default: slideNotesEdit, font: edits.default, ...newEdits }
            // } else if (item.type === "text") {
            //     removeInput(edits.default, "auto")
        } else if (item.type === "variable") {
            let newEdits = clone(edits)
            delete newEdits.default
            delete newEdits.chords
            edits = { default: variableEdits, font: edits.default, ...newEdits }
        } else if (item.type === "clock") {
            // show seconds by default on stage
            setBoxInputValue(edits, "default", "clock.seconds", "value", true)
        }

        defaultEdits = clone(edits)
    }

    function removeInput(edits: any, id: string) {
        let index = edits.findIndex((a) => a.id === id || a.input === id)
        if (index > -1) edits.splice(index, 1)
    }

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) data = getStyles(item?.style, true)

    // $: if (edits) updateAuto(item?.auto || true)
    $: if (item) updateAuto(item?.auto ?? true)

    $: if (item && type === "text") {
        let sectionId = edits.font ? "font" : "default"
        setBoxInputValue(edits, sectionId, "font-family", "styleValue", data["font"] || "")
        setBoxInputValue(edits, sectionId, "font-size", "disabled", item.type === "text" ? item.auto === true : item.auto !== false)
        // setBoxInputValue(edits, sectionId, "textFit", "hidden", item?.auto !== false)

        setBoxInputValue(edits, "special", "button.press", "value", item?.button?.press || "")
        setBoxInputValue(edits, "special", "button.release", "value", item?.button?.release || "")
    }
    $: if (item && item.type === "slide_notes") {
        setBoxInputValue(edits, "default", "slideOffset", "value", item.slideOffset || 0)
    }
    $: if (item && (item.type === "slide_text" || activeItemId?.includes("slide_text"))) {
        setBoxInputValue(edits, "default", "slideOffset", "value", item.slideOffset || 0)

        setBoxInputValue(edits, "default", "lineCount", "value", item.lineCount || 0)
        setBoxInputValue(edits, "default", "lineCount", "hidden", Number(item.slideOffset || 0) === 0)

        setBoxInputValue(edits, "default", "includeMedia", "value", !!item.includeMedia)
        setBoxInputValue(edits, "default", "keepStyle", "value", !!item.keepStyle)
        setBoxInputValue(edits, "default", "itemNumber", "value", Number(item.itemNumber || 0))
        setBoxInputValue(edits, "default", "invertItems", "value", !!item.invertItems)
        setBoxInputValue(edits, "default", "invertItems", "hidden", Number(item.itemNumber || 0) !== 0)
    }
    $: if (item && item.type === "text") {
        setBoxInputValue(edits, "default", "auto", "value", !!item.auto)
    }

    $: if (edits.chords) {
        let enabled = typeof item?.chords === "boolean" ? item?.chords : !!item?.chords?.enabled
        setBoxInputValue(edits, "chords", "chords.enabled", "value", enabled)
        setBoxInputValue(edits, "chords", "chords.color", "hidden", !enabled)
        setBoxInputValue(edits, "chords", "chords.size", "hidden", !enabled)

        let data = (typeof item?.chords === "boolean" ? (item as any)?.chordsData : item?.chords) || {}
        if (data.color) setBoxInputValue(edits, "chords", "chords.color", "value", data.color)
        if (data.size) setBoxInputValue(edits, "chords", "chords.size", "value", data.size)
    }
    $: if (item?.type === "slide_tracker" || activeItemId?.includes("tracker")) {
        if (item?.tracker?.type) setBoxInputValue(edits, "default", "tracker.type", "value", item.tracker.type)
        setBoxInputValue(edits, "default", "tracker.accent", "value", item?.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C")

        setBoxInputValue(edits, "default", "tracker.childProgress", "hidden", item?.tracker?.type !== "group")
        setBoxInputValue(edits, "default", "tracker.oneLetter", "hidden", item?.tracker?.type !== "group")
    }

    $: if (item?.type === "variable") {
        setBoxInputValue(edits, "default", "variable.id", "value", item.variable?.id)
    }
    $: if (item?.type === "camera") {
        if (item.device?.name) setBoxInputValue(edits, "default", "device", "name", item.device.name)
    }

    $: if (item?.type === "timer" && item) {
        setBoxInputValue(edits, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
        setBoxInputValue(edits, "default", "timer.showHours", "value", item.timer?.showHours !== false)
        setBoxInputValue(edits, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time")
        setBoxInputValue(edits, "font", "auto", "value", item.auto ?? true)
    }
    $: if (item?.type === "clock" && item) {
        const clockType = item.clock?.type || "digital"
        const dateFormat = item.clock?.dateFormat || "none"

        setBoxInputValue(edits, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue(edits, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue(edits, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
        setBoxInputValue(edits, "default", "clock.customFormat", "hidden", clockType !== "custom")
    }

    // CSS
    // WIP get only text related item styles (& combine again)?
    $: if (edits?.CSS && item?.style) edits.CSS[0].value = item.style

    // align
    let alignStyle: any = {}
    let lineAlignStyle: any = {}
    $: if (item?.align) alignStyle = { "align-items": item.align }
    $: if (item?.alignX) lineAlignStyle = { "text-align": item.alignX }

    function updateAuto(value) {
        if (!edits.default) return

        let autoIndex = edits.default.findIndex((a) => a.id === "auto")
        if (autoIndex < 0) {
            // items with custom default have auto size in "font"
            if (edits.font) autoIndex = edits.font.findIndex((a) => a.id === "auto")
            if (autoIndex >= 0) edits.font[autoIndex].value = value

            return
        }

        edits.default[autoIndex].value = value
    }

    function setValue(input: any) {
        let value: any = input.value
        // if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        // else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

        if (input.id === "auto") updateAuto(value)

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
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") },
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
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") },
        })
    }

    // WIP textbox lines does not update only selected text

    function updateStyle(e: any) {
        let input = e.detail

        if (input.key === "text-align" || input.key === "align-items") updateAlign(input)

        if (input.id !== "style" && input.id !== "CSS") {
            setValue(input)
            return
        }

        let value: string = addStyleString(item!.style, [input.key, input.value]) || ""

        if (input.id === "CSS") value = input.value.replaceAll("\n", "")

        if (!value) return

        // only update items with same type
        let updateType = item?.type

        // only update changed value
        let styles: { [key: string]: string } = {}
        activeItemIds.forEach((itemId) => {
            let item = stageItems[itemId]
            if (!item || (!$activeStage.items?.length && item.type !== updateType)) return

            styles[itemId] = addStyleString(item.style, [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: styles, key: "items", subkey: "style", keys: Object.keys(styles) },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_content", override: $activeStage.id + activeItemIds.join("") },
        })

        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    let timeout: NodeJS.Timeout | null = null
</script>

<!-- {#if item} -->
<!-- {#key edits} -->
<EditValues {edits} {defaultEdits} {alignStyle} {lineAlignStyle} styles={data} {item} on:change={updateStyle} isStage />
<!-- {/key} -->
<!-- {:else}
    <Center faded>
        <T id="empty.items" />
    </Center>
{/if} -->

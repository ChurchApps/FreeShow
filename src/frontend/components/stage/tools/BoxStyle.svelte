<script lang="ts">
    import { activeStage, stageShows, theme, themes } from "../../../stores"
    import { addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { type EditInput, trackerEdits } from "../../edit/values/boxes"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import Center from "../../system/Center.svelte"
    import { updateStageShow } from "../stage"
    import { textEdits } from "../values/text"

    $: items = $activeStage.items
    $: stageItems = $stageShows[$activeStage.id!].items
    $: item = items ? stageItems[items[0]] : null

    let edits: { [key: string]: EditInput[] } = {}
    $: if (item) {
        edits = clone(textEdits)

        // custom input values
        if (items[0].includes("slide") && !items[0].includes("text") && !items[0].includes("notes") && !items[0].includes("tracker")) edits = { chords: edits.chords }
        else if (items[0].includes("slide_text")) {
            if (items[0].includes("next_slide_text")) edits.default.push({ name: "max_lines", id: "lineCount", input: "number", value: 0 })
            // WIP only show this if current output has more than one item:
            edits.default.push({ name: "invert_items", id: "invertItems", input: "checkbox", value: false })
        } else if (items[0].includes("tracker")) {
            let newEdits = clone(textEdits)
            delete newEdits.default
            delete newEdits.align
            delete newEdits.chords
            edits = { default: trackerEdits, font: edits.default, ...newEdits }
        } else if (items[0].includes("clock")) {
            edits.default.push({ name: "clock.seconds", id: "clock.seconds", input: "checkbox", value: true })
            edits.default.push({ name: "sort.date", id: "clock.show_date", input: "checkbox", value: false })
        } else if (items[0].includes("timer")) edits.default.push({ name: "timer.hours", id: "timer.showHours", input: "checkbox", value: item.timer?.showHours !== false })
        else if (items[0].includes("output")) edits = {}
    }

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) data = getStyles(item?.style, true)

    // $: if (edits) updateAuto(item?.auto || true)
    $: if (item) updateAuto(item?.auto ?? true)
    $: if (edits.chords) {
        edits.chords[0].value = item?.chords
        edits.chords[1].hidden = !item?.chords
        edits.chords[2].hidden = !item?.chords

        if (item?.chordsData?.color) edits.chords[1].value = item.chordsData.color
        if (item?.chordsData?.size) edits.chords[2].value = item.chordsData.size
    }
    $: if (items[0]?.includes("tracker") && item?.tracker && edits.default?.[0]?.id === "tracker.type") {
        if (item.tracker.type) edits.default[0].value = item.tracker.type
        edits.default[1].value = item.tracker.accent || $themes[$theme]?.colors?.secondary || "#F0008C"
    }
    $: if (item && items[0]?.includes("next_slide_text") && edits.default[5]) {
        edits.default[5].value = item.lineCount || 0
    }
    $: if (item && items[0]?.includes("slide_text") && edits.default[6]) {
        edits.default[6].value = !!item.invertItems
    }
    $: if (items[0]?.includes("slide_tracker") && edits?.default?.[2]) {
        edits.default[2].hidden = item?.tracker?.type !== "group"
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
        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: input.id, keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })
    }

    function updateAlign(input) {
        let id = "align"
        if (input.key === "text-align") id = "alignX"

        let value = input.value

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: id, keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })
    }

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

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: "style", keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })

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

{#if item}
    <EditValues {edits} defaultEdits={clone(textEdits)} {alignStyle} {lineAlignStyle} styles={data} {item} on:change={updateStyle} />
{:else}
    <Center faded>
        <T id="empty.items" />
    </Center>
{/if}

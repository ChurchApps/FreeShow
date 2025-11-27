<script lang="ts">
    import { activeStage, stageShows } from "../../../stores"
    import { addFilterString, addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { setBoxInputValue } from "../../edit/values/boxes"
    import { itemSections } from "../../edit/values/item"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { percentageToAspectRatio, stylePosToPercentage } from "../../helpers/output"
    import { getStyles } from "../../helpers/style"
    import { updateStageShow } from "../stage"

    let activeItemIds: string[] = []
    $: activeItemIds = $activeStage.items?.length ? $activeStage.items : Object.keys(stageItems)
    $: stageItems = $stageShows[$activeStage.id!]?.items || {}
    $: activeItemId = activeItemIds[0] || ""

    $: item = activeItemId ? stageItems[activeItemId] : null

    let currentItemSections = clone(itemSections)

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) updateData()
    function updateData() {
        data = getStyles(item?.style, true)
        dataChanged()
    }

    function dataChanged() {
        // gradient
        const styles = getStyles(item?.style)
        const isGradient = styles.background?.includes("gradient")
        if (isGradient) data["background-color"] = styles.background

        // setBoxInputValue({ icon: "", edit: itemEditValues }, "default", "background-opacity", "hidden", isGradient || !data["background-color"])

        const transform = data["transform"] || ""
        const showPerspective = transform.includes("rotateX") && !transform.includes("rotateX(0deg)")
        setBoxInputValue(currentItemSections, "transform", "perspective", "hidden", !showPerspective)

        data = stylePosToPercentage(data)
    }

    $: itemBackFilters = getStyles(item?.style)["backdrop-filter"]

    let timeout: NodeJS.Timeout | null = null
    function updateStyle(e: any) {
        let input = e.detail
        input = percentageToAspectRatio(input)

        if (input.id === "backdrop-filter" || input.id === "transform") {
            let oldString = input.id === "backdrop-filter" ? itemBackFilters : data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        // gradient value
        if (input.id === "style" && input.key === "background-color") {
            // set "background" value instead of "background-color"
            if (typeof input.value !== "string") input.value = ""
            if (input.value.includes("gradient")) input.key = "background"
            // reset "background" value
            else if (data.background) updateStyle({ detail: { ...input, key: "background", value: "" } })
        }

        let value: string = addStyleString(item?.style || "", [input.key, input.value]) || ""

        if (input.id.includes("CSS")) value = input.value

        if (!value) return

        // only update changed value
        let styles: { [key: string]: string } = {}
        activeItemIds.forEach(itemId => {
            let item = stageItems[itemId]
            if (!item) return

            styles[itemId] = input.id.includes("CSS") ? value : addStyleString(item.style, [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: styles, key: "items", subkey: "style", keys: Object.keys(styles) },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_style", override: $activeStage.id + activeItemIds.join("") }
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

        if (input.key === "left" || input.key === "top" || input.key === "width" || input.key === "height") input.relative = true

        updateStyle({ detail: input })
    }
</script>

<EditValues sections={currentItemSections} {item} styles={data} on:change={updateStyle2} isStage />

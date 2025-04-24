<script lang="ts">
    import { activeStage, stageShows } from "../../../stores"
    import { getBackgroundOpacity, setBackgroundColor } from "../../edit/scripts/edit"
    import { addFilterString, addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { setBoxInputValue } from "../../edit/values/boxes"
    import { itemEdits } from "../../edit/values/item"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { percentageToAspectRatio, stylePosToPercentage } from "../../helpers/output"
    import { getStyles } from "../../helpers/style"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import { updateStageShow } from "../stage"

    let activeItemIds: string[] = []
    $: activeItemIds = $activeStage.items?.length ? $activeStage.items : Object.keys(stageItems)
    $: stageItems = $stageShows[$activeStage.id!]?.items || {}
    $: activeItemId = activeItemIds[0] || ""

    $: item = activeItemId ? stageItems[activeItemId] : null

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) updateData()
    function updateData() {
        data = getStyles(item?.style, true)
        dataChanged()
    }

    $: itemEdit = clone(itemEdits)
    $: if (itemEdit.backdrop_filters) delete itemEdit.backdrop_filters

    // CSS
    $: if (itemEdit?.CSS && item?.style) itemEdit.CSS[0].value = item.style

    function dataChanged() {
        setBoxInputValue({ icon: "", edit: itemEdit }, "default", "background-opacity", "hidden", !data["background-color"])

        data = stylePosToPercentage(data)
    }

    $: if (item) itemEdit = getBackgroundOpacity(itemEdit, data)

    function updateStyle(e: any) {
        let input = e.detail
        input = percentageToAspectRatio(input)

        if (input.id === "transform") {
            let oldString = data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        // background opacity
        if (input.id === "background-opacity" || (input.value && input.key === "background-color")) {
            input = setBackgroundColor(input, data)
            setTimeout(() => getBackgroundOpacity(itemEdit, data), 100)
        }

        let value: string = addStyleString(item.style, [input.key, input.value]) || ""

        if (input.id === "CSS") value = input.value.replaceAll("\n", "")

        if (!value) return

        // only update changed value
        let styles: { [key: string]: string } = {}
        activeItemIds.forEach((itemId) => {
            let item = stageItems[itemId]
            if (!item) return

            styles[itemId] = addStyleString(item.style, [input.key, input.value])
        })

        history({
            id: "UPDATE",
            newData: { data: styles, key: "items", subkey: "style", keys: Object.keys(styles) },
            oldData: { id: $activeStage.id },
            location: { page: "stage", id: "stage_item_style", override: $activeStage.id + activeItemIds.join("") },
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

{#if item}
    <EditValues edits={clone(itemEdit)} defaultEdits={clone(itemEdits)} styles={data} {item} on:change={updateStyle} />
{:else}
    <Center faded>
        <T id="empty.items" />
    </Center>
{/if}

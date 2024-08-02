<script lang="ts">
    import { activeStage, stageShows } from "../../../stores"
    import { getBackgroundOpacity, setBackgroundColor } from "../../edit/scripts/edit"
    import { addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { itemEdits } from "../../edit/values/item"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import { updateStageShow } from "../stage"

    $: items = $activeStage.items
    $: stageItems = $stageShows[$activeStage.id!].items
    $: item = items ? stageItems[items[0]] : null

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) data = getStyles(item?.style, true)

    $: itemEdit = clone(itemEdits)
    $: if (itemEdit.backdrop_filters) delete itemEdit.backdrop_filters

    // CSS
    $: if (itemEdit?.CSS && item?.style) itemEdit.CSS[0].value = item.style

    $: if (item) itemEdit = getBackgroundOpacity(itemEdit, data)

    function updateStyle(e: any) {
        let input = e.detail

        // background opacity
        if (input.id === "background-opacity" || (input.value && input.key === "background-color")) {
            input = setBackgroundColor(input, data)
            setTimeout(() => getBackgroundOpacity(itemEdit, data), 100)
        }

        let value: string = addStyleString(item!.style, [input.key, input.value]) || ""

        if (input.id === "CSS") value = input.value.replaceAll("\n", "")

        if (!value) return

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: "style", keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_style", override: $activeStage.id + items.join("") } })

        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    let timeout: any = null
</script>

{#if item}
    <EditValues edits={clone(itemEdit)} defaultEdits={clone(itemEdits)} styles={data} {item} on:change={updateStyle} />
{:else}
    <Center faded>
        <T id="empty.items" />
    </Center>
{/if}

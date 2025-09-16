<script lang="ts">
    import { activeEdit, activeShow, showsCache, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { addFilterString } from "../scripts/textStyle"
    import { EditInput2 } from "../values/boxes"
    import { slideFilterSections } from "../values/filters"
    import EditValues from "./EditValues.svelte"

    let currentSlideFilterSections = clone(slideFilterSections)
    $: if (currentSlideNumber) currentSlideFilterSections = clone(slideFilterSections)

    $: if (!filterData["backdrop-filter"]) {
        delete currentSlideFilterSections.backdrop_filters
    }

    // get slide filters
    $: currentId = $activeShow?.id || ""
    $: currentSlideNumber = $activeEdit.slide || 0
    $: ref = $showsCache[currentId] ? getLayoutRef(currentId) : {}

    $: currentSlideData = ref?.[currentSlideNumber]?.data || null

    $: isTemplate = $activeEdit.type === "template"
    $: filterData = isTemplate ? $templates[currentId] : currentSlideData

    export function valueChanged(input: EditInput2) {
        let value = input.values.value
        value = addFilterString(currentSlideData[input.id] || "", [input.key, value])

        // if  (isTemplate) {
        //     // history({
        //     //     id: "UPDATE",
        //     //     oldData: { id: currentId },
        //     //     newData: { key: "items", subkey: "style", data: Object.values(values)[0], indexes: allItems },
        //     //     location: { page: "edit", id: $activeEdit.type + "_items", override: true }
        //     // })
        //     return
        // }

        let indexes = [currentSlideNumber]
        let override = [currentId, currentSlideNumber, input.id, input.key].join("_")
        history({ id: "SHOW_LAYOUT", newData: { key: input.id, data: value, indexes }, location: { page: "edit", override } })
    }
</script>

<EditValues sections={currentSlideFilterSections} item={filterData} on:change={(e) => valueChanged(e.detail)} />

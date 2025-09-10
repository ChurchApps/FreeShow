<script lang="ts">
    import { activeEdit, activeShow, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { addFilterString } from "../scripts/textStyle"
    import { EditInput2 } from "../values/boxes"
    import { slideFilterSections } from "../values/filters"
    import EditValues2 from "./EditValues2.svelte"

    const currentSlideFilterSections = clone(slideFilterSections)

    // get slide filters
    $: currentShow = $activeShow?.id || ""
    $: currentSlide = $activeEdit.slide || 0
    $: ref = $showsCache[currentShow] ? getLayoutRef(currentShow) : {}

    $: currentSlideData = ref?.[currentSlide]?.data || null

    export function valueChanged(input: EditInput2) {
        let value = input.values.value
        let indexes = [currentSlide]

        let override = [currentShow, currentSlide, input.id, input.key].join("_")

        value = addFilterString(currentSlideData[input.id] || "", [input.key, value])

        history({ id: "SHOW_LAYOUT", newData: { key: input.id, data: value, indexes }, location: { page: "edit", override } })
    }
</script>

<EditValues2 sections={currentSlideFilterSections} item={currentSlideData} on:change={(e) => valueChanged(e.detail)} />

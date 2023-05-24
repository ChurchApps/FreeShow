<script lang="ts">
    import { activeEdit, activeShow, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { getFilters } from "../../helpers/style"
    import { addFilterString } from "../scripts/textStyle"
    import { slideFilters } from "../values/filters"
    import EditValues from "./EditValues.svelte"

    let edits: any = clone(slideFilters.media?.edit)

    // get slide filters
    $: currentShow = $activeShow?.id || ""
    $: currentSlide = $activeEdit.slide || 0
    $: ref = _show(currentShow).layouts("active").ref()[0]
    $: currentSlideData = $showsCache[currentShow] ? ref[currentSlide]?.data || null : null

    // update
    $: if (currentSlideData !== null) {
        edits.default[0].value = currentSlideData.filterEnabled || ["background"]

        // update filters
        let filters = getFilters(currentSlideData.filter || "")
        let defaultFilters = slideFilters.media?.edit?.filters || []
        edits.filters.forEach((filter: any) => {
            let value = filters[filter.key] ?? defaultFilters.find((a) => a.key === filter.key)?.value
            let index = edits.filters.findIndex((a: any) => a.key === filter.key)
            edits.filters[index].value = value
        })
    }

    export function valueChanged(input: any) {
        let data: any = input.value
        let indexes = [currentSlide]

        let override = currentShow + "_" + currentSlide + "_" + input.key

        if (input.id !== "filter") {
            // change filter enabled
            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data, dataIsArray: true, indexes }, location: { page: "edit", override } })

            return
        }

        data = addFilterString(currentSlideData.filter || "", [input.key, data])

        history({ id: "SHOW_LAYOUT", newData: { key: "filter", data, indexes }, location: { page: "edit", override } })
    }
</script>

<EditValues {edits} on:change={(e) => valueChanged(e.detail)} />

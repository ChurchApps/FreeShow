<script lang="ts">
    import { activeEdit, activeShow, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { getFilters } from "../../helpers/style"
    import { addFilterString } from "../scripts/textStyle"
    import { slideFilters } from "../values/filters"
    import EditValues from "./EditValues.svelte"

    let edits = clone(slideFilters.media?.edit || {})

    // get slide filters
    $: currentShow = $activeShow?.id || ""
    $: currentSlide = $activeEdit.slide || 0
    $: ref = $showsCache[currentShow] ? getLayoutRef(currentShow) : {}

    $: currentSlideData = ref?.[currentSlide]?.data || null

    $: hasItems = !!($showsCache[currentShow]?.slides?.[ref?.[currentSlide]?.id]?.items || []).length

    // update
    $: if (currentSlideData !== null) {
        // edits.default[0].value = currentSlideData.filterEnabled || ["background"]

        // update filters
        let filters = getFilters(currentSlideData.filter || "")
        let defaultFilters = slideFilters.media?.edit?.filters || []
        edits.filters.forEach((filter) => {
            let value = filters[filter.key || ""] ?? defaultFilters.find((a) => a.key === filter.key)?.value
            let index = edits.filters.findIndex((a) => a.key === filter.key)
            edits.filters[index].value = value
        })

        // update backdrop filters
        if (hasItems) {
            edits.backdrop_filters = clone(slideFilters.media?.edit || {}).backdrop_filters

            let backdropFilters = getFilters(currentSlideData["backdrop-filter"] || "")
            let defaultBackdropFilters = slideFilters.media?.edit?.backdrop_filters || []
            edits.backdrop_filters.forEach((filter) => {
                let value = backdropFilters[filter.key || ""] ?? defaultBackdropFilters.find((a) => a.key === filter.key)?.value
                let index = edits.backdrop_filters.findIndex((a) => a.key === filter.key)
                edits.backdrop_filters[index].value = value
            })
        } else {
            delete edits.backdrop_filters
        }
    }

    export function valueChanged(input: any) {
        let data: any = input.value
        let indexes = [currentSlide]

        let override = [currentShow, currentSlide, input.id, input.key].join("_")

        // if (input.id !== "filter" && input.id !== "backdrop-filter") {
        //     // change filter enabled
        //     history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data, dataIsArray: true, indexes }, location: { page: "edit", override } })
        //     return
        // }

        data = addFilterString(currentSlideData[input.id] || "", [input.key, data])

        history({ id: "SHOW_LAYOUT", newData: { key: input.id, data, indexes }, location: { page: "edit", override } })
    }
</script>

<EditValues {edits} customLabels={["preview.background", "preview.foreground"]} noClosing on:change={(e) => valueChanged(e.detail)} />

<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activeShow, overlays, popupData, templates } from "../../../stores"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let action = $popupData.action
    let type = $activeEdit.type
    let indexes: number[] = $activeEdit.items

    let layoutRef: any[] = _show().layouts("active").ref()[0] || []
    let slideRef: any = layoutRef[$activeEdit.slide!] || {}
    let slideItems = _show().get("slides")?.[slideRef.id]?.items || []

    if ($activeEdit.id) getItems()
    function getItems() {
        let slide = {}
        if (type === "overlay") slide = $overlays
        else if (type === "template") slide = $templates

        slideItems = slide[$activeEdit.id!]?.items
    }

    let value: number = slideItems?.[indexes[0]]?.actions?.[action] || 0

    onMount(() => {
        popupData.set({})
    })

    function updateValue(e: any) {
        value = e?.detail ?? e
        if (value) value = Number(value)

        slideItems.forEach((_: any, i: number) => {
            if (!indexes.includes(i)) return

            if (!slideItems[i].actions) slideItems[i].actions = {}

            if (value) slideItems[i].actions[action] = value
            else delete slideItems[i].actions[action]
        })

        let actions = indexes.map((i) => slideItems[i].actions)

        if (type === "overlay" || type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "actions", data: actions, indexes },
                location: { page: "edit", id: $activeEdit.type + "_items", override: "itemaction_" + indexes.join(",") },
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: actions } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: indexes, override: "itemaction_" + slideRef.id + "_items_" + indexes.join(",") },
        })
    }
</script>

<CombinedInput>
    <NumberInput {value} on:change={updateValue} max={3600} fixed={value.toString().includes(".") ? 1 : 0} decimals={1} />
</CombinedInput>

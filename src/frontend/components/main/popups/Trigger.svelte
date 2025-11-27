<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { popupData, selected, triggers } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { createStore, updateStore } from "../../helpers/historyStores"
    import { getLayoutRef } from "../../helpers/show"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    // const types = [
    //     { id: "http", name: "HTTP" },
    // ]

    const DEFAULT_TRIGGER = { name: "", type: "http", value: "" }

    let dropdown = $popupData?.dropdown
    let slideIndex = $popupData?.index
    onMount(() => {
        popupData.set({})
    })

    let existing: boolean = $selected.id === "trigger" && $selected.data[0]?.id
    let triggerId = existing ? $selected.data[0].id : uid()
    let currentTrigger = clone($triggers[triggerId] || DEFAULT_TRIGGER)

    let globalList = Object.entries($triggers).map(([id, a]) => ({ value: id, label: a.name }))
    let sortedTriggers = sortByName(globalList, "label")

    function updateValue(e: any, key: string) {
        let value = e.detail
        if (!value) return

        currentTrigger[key] = value

        if (existing) {
            updateStore("triggers", triggerId, currentTrigger)
        } else {
            createStore("triggers", currentTrigger, triggerId)
            existing = true
        }
    }

    function changeTrigger(e: any) {
        triggerId = e.detail

        let ref = getLayoutRef()[slideIndex]
        let data = ref?.data?.actions || {}
        data.trigger = triggerId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [slideIndex] }, location: { page: "show", override: "trigger" } })
    }
</script>

{#if dropdown}
    {#if sortedTriggers.length}
        <MaterialDropdown label="popup.trigger" options={sortedTriggers} value={triggerId} on:change={changeTrigger} />
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{:else}
    <MaterialTextInput label="inputs.name" value={currentTrigger.name} on:change={e => updateValue(e, "name")} autofocus={!currentTrigger.name} />
    <MaterialTextInput label="variables.value" value={currentTrigger.value} on:change={e => updateValue(e, "value")} />
{/if}

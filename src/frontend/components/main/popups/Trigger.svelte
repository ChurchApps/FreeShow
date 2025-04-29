<script lang="ts">
    import { uid } from "uid"
    import { popupData, selected, triggers } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { history } from "../../helpers/history"
    import Center from "../../system/Center.svelte"
    import { onMount } from "svelte"
    import { getLayoutRef } from "../../helpers/show"
    import { createStore, updateStore } from "../../helpers/historyStores"

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

    let globalList = Object.entries($triggers).map(([id, a]) => ({ ...a, id }))
    let sortedTriggers = sortByName(globalList)

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
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
        triggerId = e.detail.id

        let ref = getLayoutRef()[slideIndex]
        let data = ref?.data?.actions || {}
        data.trigger = triggerId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [slideIndex] }, location: { page: "show", override: "trigger" } })
    }
</script>

{#if dropdown}
    {#if sortedTriggers.length}
        <Dropdown options={sortedTriggers} value={sortedTriggers.find((a) => a.id === triggerId)?.name || "—"} on:click={changeTrigger} />
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{:else}
    <CombinedInput textWidth={25}>
        <p><T id="inputs.name" /></p>
        <TextInput value={currentTrigger.name} on:change={(e) => updateValue(e, "name")} autofocus={!currentTrigger.name} />
    </CombinedInput>
    <CombinedInput textWidth={25}>
        <p><T id="variables.value" /></p>
        <TextInput value={currentTrigger.value} on:change={(e) => updateValue(e, "value")} />
    </CombinedInput>
{/if}

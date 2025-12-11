<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { audioStreams, popupData, selected } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    const DEFAULT_STREAM = { name: "", value: "" }

    let dropdown = $popupData?.dropdown
    let slideIndex = $popupData?.index
    onMount(() => {
        popupData.set({})
    })

    let existing: boolean = $selected.id === "audio_stream" && $selected.data[0]?.id
    let streamId = existing ? $selected.data[0].id : uid()
    let currentStream = clone($audioStreams[streamId] || DEFAULT_STREAM)

    let globalList = Object.entries($audioStreams).map(([id, a]) => ({ ...a, id }))
    let sortedStreams = sortByName(globalList)

    function updateValue(value: string, key: string) {
        if (!value) return

        currentStream[key] = value

        audioStreams.update((a) => {
            a[streamId] = currentStream
            return a
        })
    }

    function changeStream(e: any) {
        streamId = e.detail.id
        // let stream = $audioStreams[streamId]

        let ref = getLayoutRef()[slideIndex]
        let data = ref?.data?.actions || {}

        // TODO: is this correct?
        data.audioStream = streamId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [slideIndex] }, location: { page: "show", override: "audio_stream" } })
    }
</script>

{#if dropdown}
    {#if sortedStreams.length}
        <Dropdown options={sortedStreams} value={sortedStreams.find((a) => a.id === streamId)?.name || "—"} on:click={changeStream} />
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{:else}
    <MaterialTextInput label="inputs.name" value={currentStream.name} on:change={(e) => updateValue(e.detail, "name")} autofocus={!currentStream.name} />
    <MaterialTextInput label="variables.value" value={currentStream.value} placeholder="http://stream-url" on:change={(e) => updateValue(e.detail, "value")} />
{/if}

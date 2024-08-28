<script lang="ts">
    import { uid } from "uid"
    import { popupData, selected, audioStreams } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import Center from "../../system/Center.svelte"
    import { onMount } from "svelte"

    const DEFAULT_STREAM = { name: "", value: "" }

    let dropdown = $popupData?.dropdown
    let slideIndex = $popupData?.index
    onMount(() => {
        popupData.set({})
    })

    let existing: boolean = $selected.id === "audio_stream" && $selected.data[0]?.id
    let streamId = existing ? $selected.data[0].id : uid()
    let currentStream = clone($audioStreams[streamId] || DEFAULT_STREAM)

    let globalList = Object.entries($audioStreams).map(([id, a]: any) => ({ ...a, id }))
    let sortedStreams = sortByName(globalList)

    function updateValue(e: any, key: string) {
        let value = e?.target?.value || e
        if (!value) return

        currentStream[key] = value

        audioStreams.update((a) => {
            a[streamId] = currentStream
            return a
        })
    }

    function changeStream(e: any) {
        streamId = e.detail.id
        let stream = $audioStreams[streamId]

        let ref: any = _show().layouts("active").ref()[0][slideIndex]
        let data: any = ref.data.actions || {}
        data.audioStream = stream

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
    <CombinedInput textWidth={25}>
        <p><T id="inputs.name" /></p>
        <TextInput value={currentStream.name} on:change={(e) => updateValue(e, "name")} />
    </CombinedInput>
    <CombinedInput textWidth={25}>
        <p><T id="variables.value" /></p>
        <TextInput value={currentStream.value} on:change={(e) => updateValue(e, "value")} />
    </CombinedInput>
{/if}

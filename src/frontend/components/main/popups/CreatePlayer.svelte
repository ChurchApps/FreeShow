<script lang="ts">
    import { cubicOut } from "svelte/easing"
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import { playerVideos, popupData } from "../../../stores"
    import { getUrlTimestamp, getVimeoData, getYouTubeData, trimPlayerId } from "../../drawer/player/playerHelper"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { addVideoMarker } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: "youtube" | "vimeo" = $popupData.active
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data = clone($playerVideos[editId] || { name: "", id: "" })

    // the video ID field only shows the ID, so confirm that the timestamp of the pasted link was kept
    let markerTime = 0

    function setValue(key: "id" | "name", value: string) {
        if (key === "id") {
            // keep the timestamp of pasted links (e.g. youtube.com/live/ID?t=1234) as a time marker
            markerTime = getUrlTimestamp(value)
            if (markerTime) addVideoMarker(currentId, markerTime)

            value = trimPlayerId(value, active)
        }

        const newData = { ...data, [key]: value, type: active }
        data = newData

        playerVideos.update((a) => {
            a[currentId] = newData
            return a
        })

        if (key === "id") loadName()
    }

    async function loadName() {
        if (data.name) return

        const id = data.id || ""
        let newName = ""
        if (active === "youtube") newName = (await getYouTubeData(id)).name
        else if (active === "vimeo") newName = (await getVimeoData(id)).name

        if (newName) setValue("name", newName)
    }
</script>

<MaterialTextInput label="inputs.video_id" value={data.id || ""} placeholder="e.g. X-AJdKty74M" disabled={!!(data.id && editId)} on:change={(e) => setValue("id", e.detail)} autofocus={!data.id} pasteBtn={!data.id} />
{#if !editId}
    <MaterialTextInput label="inputs.name" value={data.name} disabled={!data.id} on:change={(e) => setValue("name", e.detail)} />
{/if}

<p class="markerAdded" role="status">
    {#if markerTime}
        <span in:fade={{ duration: 150, easing: cubicOut }}>
            <Icon id="timeMarker" size={0.9} white />
            <T id="actions.time_marker_added" replace={[joinTime(secondsToTime(markerTime))]} />
        </span>
    {/if}
</p>

<style>
    .markerAdded span {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px 0;
        font-size: 0.9em;
        opacity: 0.8;
    }
</style>

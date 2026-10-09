<script lang="ts">
    import { uid } from "uid"
    import { playerVideos, popupData } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { getUrlTimestamp, getVimeoData, getYouTubeData, trimPlayerId } from "../../drawer/player/playerHelper"
    import { clone } from "../../helpers/array"
    import { addVideoMarker } from "../../helpers/media"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: "youtube" | "vimeo" = $popupData.active
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data = clone($playerVideos[editId] || { name: "", id: "" })

    function setValue(key: "id" | "name", value: string) {
        if (key === "id") {
            // extract any timestamp in the pasted link (e.g. ?t=1234)
            const markerTime = getUrlTimestamp(value)
            if (markerTime) {
                const markerIndex = addVideoMarker(currentId, markerTime, "URL")
                if (markerIndex > -1) newToast(translateText("actions.time_marker_added", null, [joinTime(secondsToTime(markerTime))]))
            }

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

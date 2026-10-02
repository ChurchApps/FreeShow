<script lang="ts">
    import { uid } from "uid"
    import type { PlayerVideo } from "../../../../types/Tabs"
    import { playerVideos, popupData } from "../../../stores"
    import { getUrlTimestamp, getVimeoData, getYouTubeData, parseTimestamp, trimPlayerId } from "../../drawer/player/playerHelper"
    import { clone } from "../../helpers/array"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: "youtube" | "vimeo" = $popupData.active
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data: PlayerVideo = clone($playerVideos[editId] || { name: "", id: "", type: active })

    function update(changes: Partial<PlayerVideo>) {
        data = { ...data, ...changes, type: active }

        playerVideos.update((a) => {
            a[currentId] = data
            return a
        })
    }

    function setId(value: string) {
        // keep the timestamp from pasted links (e.g. youtube.com/live/ID?t=1234)
        update({ id: trimPlayerId(value, active), startTime: getUrlTimestamp(value) })
        loadName()
    }

    async function loadName() {
        if (data.name) return

        const id = data.id || ""
        let newName = ""
        if (active === "youtube") newName = (await getYouTubeData(id)).name
        else if (active === "vimeo") newName = (await getVimeoData(id)).name

        if (newName) update({ name: newName })
    }
</script>

<MaterialTextInput label="inputs.video_id" value={data.id || ""} placeholder="e.g. X-AJdKty74M" disabled={!!(data.id && editId)} on:change={(e) => setId(e.detail)} autofocus={!data.id} pasteBtn={!data.id} />
{#if !editId}
    <MaterialTextInput label="inputs.name" value={data.name} disabled={!data.id} on:change={(e) => update({ name: e.detail })} />
{/if}
<MaterialTextInput label="timeline.start_time" value={data.startTime ? joinTime(secondsToTime(data.startTime)) : ""} placeholder="e.g. 1:05:30" disabled={!data.id} on:change={(e) => update({ startTime: parseTimestamp(e.detail) })} />

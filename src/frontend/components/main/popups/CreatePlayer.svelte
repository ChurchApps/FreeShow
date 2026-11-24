<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { playerVideos, popupData } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { destroy, receive } from "../../../utils/request"
    import { getUrlTimestamp, getVimeoData, getYouTubeData, trimPlayerId } from "../../drawer/player/playerHelper"
    import { clone } from "../../helpers/array"
    import { addVideoMarker } from "../../helpers/media"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import { getWebsiteDomain } from "../../helpers/websiteControls"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: "website" | "youtube" | "vimeo" = $popupData.active || "website"
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data = clone($playerVideos[editId] || { name: "", id: "" })
    let nameEdited = !!data.name

    function setValue(key: "id" | "name", value: string, isAuto = false) {
        if (key === "id" && active === "website") {
            value = value.trim()
        } else if (key === "id" && active !== "website") {
            // extract any timestamp in the pasted link (e.g. ?t=1234)
            const markerTime = getUrlTimestamp(value)
            if (markerTime) {
                const markerIndex = addVideoMarker(currentId, markerTime, "URL")
                if (markerIndex > -1) newToast(translateText("actions.time_marker_added", null, [joinTime(secondsToTime(markerTime))]))
            }

            value = trimPlayerId(value, active)
        } else if (!isAuto) {
            nameEdited = !!value
        }

        const newData = { ...data, [key]: value, type: active }
        if (key === "id" && !value && !nameEdited) newData.name = ""
        data = newData

        if (!data.id) return

        playerVideos.update((a) => {
            if (!a[currentId]) newToast("info.created")
            a[currentId] = newData
            return a
        })

        if (key === "id" && active === "website") sendMain(Main.WEBSITE_CAPTURE, { id: currentId, action: "thumbnail", url: data.id })
        if (key === "id") loadName()
    }

    async function loadName() {
        if (nameEdited) return

        const id = data.id || ""
        let newName = ""
        if (active === "youtube") newName = (await getYouTubeData(id)).name
        else if (active === "vimeo") newName = (await getVimeoData(id)).name
        else if (active === "website") newName = getWebsiteDomain(id)

        if (newName) setValue("name", newName, true)
    }

    // WEBSITE

    const listenerId = "CREATE_WEBSITE_" + uid()
    onMount(() => {
        receive(
            OUTPUT,
            {
                WEBSITE_THUMBNAIL: (res: { websiteId: string; title?: string }) => {
                    if (res?.websiteId === currentId && res.title && !nameEdited) setValue("name", res.title, true)
                }
            },
            listenerId
        )
    })
    onDestroy(() => destroy(OUTPUT, listenerId))
</script>

<MaterialTextInput label={active === "website" ? "inputs.url" : "inputs.video_id"} value={data.id || ""} placeholder={active === "website" ? "https://example.com" : "e.g. X-AJdKty74M"} disabled={!!(data.id && editId)} on:change={(e) => setValue("id", e.detail)} autofocus={!data.id} pasteBtn={!data.id} />
{#if !editId}
    <MaterialTextInput label="inputs.name" value={data.name} disabled={!data.name && !data.id} on:change={(e) => setValue("name", e.detail)} />
{/if}

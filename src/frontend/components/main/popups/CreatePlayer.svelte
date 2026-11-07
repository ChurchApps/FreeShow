<script lang="ts">
    import { uid } from "uid"
    import { activePopup, playerVideos, popupData } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { getUrlTimestamp, getVimeoData, getYouTubeData, trimPlayerId } from "../../drawer/player/playerHelper"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { addVideoMarker } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: "youtube" | "vimeo" = $popupData.active
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data = clone($playerVideos[editId] || { name: "", id: "" })

    let invalid = false
    let added = false

    function isValidId(id: string) {
        if (active === "youtube") return /^[A-Za-z0-9_-]{11}$/.test(id)
        if (active === "vimeo") return /^\d+$/.test(id)
        return !!id
    }

    function setValue(key: "id" | "name", value: string) {
        if (key === "id") {
            const rawValue = value
            value = trimPlayerId(value, active)

            invalid = !isValidId(value)
            if (invalid) return

            // extract any timestamp in the pasted link (e.g. ?t=1234)
            const markerTime = getUrlTimestamp(rawValue)
            if (markerTime) {
                const markerIndex = addVideoMarker(currentId, markerTime, "URL")
                if (markerIndex > -1) newToast(translateText("actions.time_marker_added", null, [joinTime(secondsToTime(markerTime))]))
            }
        }

        const newData = { ...data, [key]: value, type: active }
        data = newData

        playerVideos.update((a) => {
            a[currentId] = newData
            return a
        })

        if (key === "id") {
            if (!editId && !added) {
                added = true
                newToast(translateText("media.player_added"))
            }
            loadName()
        }
    }

    async function loadName() {
        if (data.name) return

        const id = data.id || ""
        let newName = ""
        if (active === "youtube") newName = (await getYouTubeData(id)).name
        else if (active === "vimeo") newName = (await getVimeoData(id)).name

        if (newName) setValue("name", newName)
    }

    $: thumbnail = !data.id ? "" : active === "youtube" ? `https://i.ytimg.com/vi/${data.id}/mqdefault.jpg` : active === "vimeo" ? `https://vumbnail.com/${data.id}_medium.jpg` : ""
</script>

<MaterialTextInput label="inputs.video_id" value={data.id || ""} placeholder="e.g. X-AJdKty74M" disabled={!!(data.id && (editId || added))} on:change={(e) => setValue("id", e.detail)} autofocus={!data.id} pasteBtn={!data.id} />
{#if invalid}
    <p class="error"><T id="media.player_invalid" /></p>
{/if}

{#if !editId}
    <MaterialTextInput label="inputs.name" value={data.name} disabled={!data.id} on:change={(e) => setValue("name", e.detail)} />
{/if}

{#if added}
    <div class="added">
        {#if thumbnail}<img src={thumbnail} alt={data.name || data.id} />{/if}
        <div class="info">
            <span class="title"><Icon id="check" white /> <T id="media.player_added" /></span>
            {#if data.name}<span class="name">{data.name}</span>{/if}
        </div>
    </div>

    <MaterialButton variant="outlined" icon="check" style="width: 100%;margin-top: 10px;" on:click={() => activePopup.set(null)}>
        <T id="actions.done" />
    </MaterialButton>
{/if}

<style>
    .error {
        color: var(--error, #ff5252);
        font-size: 0.9em;
        margin: 6px 0;
    }

    .added {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 12px;
        padding: 10px;
        border-radius: 6px;
        background-color: var(--primary-darker);
    }

    .added img {
        width: 120px;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: 4px;
    }

    .info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
    }

    .title :global(svg) {
        fill: var(--secondary);
    }

    .name {
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>

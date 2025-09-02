<script lang="ts">
    import { uid } from "uid"
    import { playerVideos, popupData } from "../../../stores"
    import { clone } from "../../helpers/array"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let active: string | null = $popupData.active
    let editId: string = $popupData.id || ""
    $: if (active) popupData.set({})

    const currentId = editId || uid()
    let data = clone($playerVideos[editId] || { name: "", id: "" })
    $: if (data) update()

    function update() {
        if (!data.id?.length) {
            // newToast("$toast.no_video_id")
            return
        }

        let id = data.id

        // only get video id from any url
        if (active === "youtube") {
            if (id.includes("?list")) id = id.slice(0, id.indexOf("?list"))
            if (id.includes("?si")) id = id.slice(0, id.indexOf("?si"))
            id = id.slice(-11)
        } else if (active === "vimeo") {
            if (id.includes("?")) id = id.slice(0, id.indexOf("?"))
            let slash = id.lastIndexOf("/")
            id = id.slice(slash >= 0 ? slash + 1 : 0)
        }

        let name = data.name
        if (!name) name = id

        playerVideos.update((a) => {
            a[currentId] = { id, name, type: active as any }
            return a
        })
    }
</script>

{#if !editId}
    <MaterialTextInput label="inputs.name" value={data.name} on:change={(e) => (data.name = e.detail)} autofocus={!data.name} />
{/if}
<MaterialTextInput label="inputs.video_id" value={data.id || ""} placeholder="X-AJdKty74M" on:change={(e) => (data.id = e.detail)} />

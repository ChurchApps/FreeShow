<script lang="ts">
    import { uid } from "uid"
    import { activePopup, playerVideos, popupData } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let active: string | null = $popupData.active
    $: if (active) popupData.set({})

    let data: any = { name: "", id: "" }
    function add() {
        // TODO: remove url (keep only id)
        if (!data.id.length) {
            newToast("$toast.no_video_id")
            return activePopup.set(null)
        }

        let id = data.id

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
            a[uid()] = { id, name, type: active as any }
            return a
        })

        // setTimeout(() => {
        //   data = { name: "", id: "" }
        // }, 10)

        activePopup.set(null)
    }

    function setValue(e: any, key: string) {
        data[key] = e.target.value
    }

    function keydown(e: any) {
        if (e.key === "Enter") {
            ;(document.activeElement as any).blur()
            add()
        }
    }
</script>

<div on:keydown={keydown}>
    <CombinedInput textWidth={40}>
        <p><T id="inputs.name" /></p>
        <!-- placeholder={$dictionary.inputs?.name} -->
        <TextInput value={data.name} on:change={(e) => setValue(e, "name")} />
    </CombinedInput>
    <CombinedInput textWidth={40}>
        <p><T id="inputs.video_id" /></p>
        <!-- placeholder="X-AJdKty74M" -->
        <TextInput value={data.id} on:change={(e) => setValue(e, "id")} />
    </CombinedInput>

    <br />

    <CombinedInput>
        <Button style="width: 100%;" on:click={add} center dark>
            <Icon id="add" size={1.2} right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
</div>

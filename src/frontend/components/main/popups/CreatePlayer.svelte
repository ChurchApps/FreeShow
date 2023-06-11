<script lang="ts">
    import { uid } from "uid"
    import { activeDrawerTab, activePopup, drawerTabsData, playerVideos } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import { newToast } from "../../../utils/messages"

    let active: string | null = $drawerTabsData[$activeDrawerTab]?.activeSubTab

    let data: any = { name: "", id: "" }
    function add() {
        // TODO: remove url (keep only id)
        if (!data.id.length) {
            newToast("No video ID")
            return activePopup.set(null)
        }

        let id = data.id
        if (id.includes("?list")) id = id.slice(0, id.indexOf("?list"))
        id = id.slice(-11)

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

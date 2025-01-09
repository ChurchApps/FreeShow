<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { MAIN, OPEN_FILE } from "../../../types/Channels"
    import Button from "./Button.svelte"
    import { uid } from "uid"
    import { destroy, send } from "../../utils/request"

    export let id: string
    export let filter: any
    export let title: string = ""
    export let multiple: boolean = false
    export let clearOnClick: boolean = false
    export let center: boolean = true
    export let dark: boolean = true

    function pick() {
        if (clearOnClick) {
            dispatch("picked", "")
            return
        }

        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        send(MAIN, ["OPEN_FILE"], { channel: "MEDIA", id, filter, multiple })
    }

    let listenerId = uid()
    onDestroy(() => destroy(OPEN_FILE, listenerId))

    let dispatch = createEventDispatcher()
    window.api.receive(OPEN_FILE, fileReceived, listenerId)
    function fileReceived(msg: any) {
        if (msg.data.id !== id || msg.channel !== "MEDIA" || !msg.data.files?.length) return

        dispatch("picked", multiple ? msg.data.files : msg.data.files[0])
    }
</script>

<Button {title} style={$$props.style || null} on:click={pick} {center} {dark}>
    <slot />
</Button>

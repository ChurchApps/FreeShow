<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { MAIN } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { receiveMain, sendMain } from "../../IPC/main"
    import { destroy } from "../../utils/request"
    import Button from "./Button.svelte"

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
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id, filter, multiple })
    }

    let dispatch = createEventDispatcher()
    let listenerId = receiveMain(Main.OPEN_FILE, (data) => {
        if (!data || data.id !== id || data.channel !== "MEDIA" || !data.files?.length) return

        dispatch("picked", multiple ? data.files : data.files[0])
    })
    onDestroy(() => destroy(MAIN, listenerId))
</script>

<Button {title} style={$$props.style || null} on:click={pick} {center} {dark} bold={!title}>
    <slot />
</Button>

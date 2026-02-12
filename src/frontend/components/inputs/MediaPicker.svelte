<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, sendMain } from "../../IPC/main"
    import Button from "./Button.svelte"

    export let id: string
    export let filter: any
    export let title = ""
    export let multiple = false
    export let clearOnClick = false
    export let center = true
    export let dark = true

    function pick() {
        if (clearOnClick) {
            dispatch("picked", "")
            return
        }

        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id, filter, multiple })
    }

    let dispatch = createEventDispatcher()
    let listenerId = receiveToMain(ToMain.OPEN_FILE2, (data) => {
        if (data.id !== id || data.channel !== "MEDIA" || !data.files?.length) return

        dispatch("picked", multiple ? data.files : data.files[0])
    })
    onDestroy(() => destroyMain(listenerId))
</script>

<Button {title} style={$$props.style || null} on:click={pick} {center} {dark} bold={!title}>
    <slot />
</Button>

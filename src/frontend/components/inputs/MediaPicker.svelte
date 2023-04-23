<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { OPEN_FILE } from "../../../types/Channels"
    import Button from "./Button.svelte"

    export let filter: any
    export let multiple: boolean = false

    function pick() {
        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        window.api.send(OPEN_FILE, { channel: "MEDIA", filter, multiple })
    }

    let dispatch = createEventDispatcher()
    window.api.receive(OPEN_FILE, (msg: any) => {
        if (msg.channel === "MEDIA") dispatch("picked", multiple ? msg.data.files : msg.data.files[0])
    })
</script>

<Button style={$$props.style || null} on:click={pick} center dark>
    <slot />
</Button>

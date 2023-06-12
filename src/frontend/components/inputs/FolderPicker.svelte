<script lang="ts">
    import { OPEN_FOLDER } from "../../../types/Channels"
    import Button from "./Button.svelte"

    export let id: string
    export let title: string | undefined = undefined
    export let style: string = ""
    export let center: boolean = true

    function pickFolder() {
        window.api.send(OPEN_FOLDER, { channel: id, title })
    }
</script>

<Button on:click={pickFolder} {title} {style} {center} dark>
    <slot />
    <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>

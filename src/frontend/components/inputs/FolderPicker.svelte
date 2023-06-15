<script lang="ts">
    import { OPEN_FOLDER } from "../../../types/Channels"
    import { activePopup, alertMessage, os } from "../../stores"
    import Button from "./Button.svelte"

    export let id: string
    export let title: string | undefined = undefined
    export let style: string = ""
    export let center: boolean = true

    function pickFolder() {
        // linux dialog behind window message
        if ($os.platform === "linux") {
            alertMessage.set("The folder select dialog might appear behind the window on Linux!<br>Please check that if you don't see it.")
            activePopup.set("alert")
        }

        window.api.send(OPEN_FOLDER, { channel: id, title })
    }
</script>

<Button on:click={pickFolder} {title} {style} {center} dark>
    <slot />
    <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>

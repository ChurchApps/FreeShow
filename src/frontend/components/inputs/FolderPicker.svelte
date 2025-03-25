<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, alertMessage, os } from "../../stores"
    import Button from "./Button.svelte"

    export let id: string
    export let title: string | undefined
    export let path: string | undefined
    export let style: string = ""
    export let center: boolean = true

    function pickFolder() {
        // linux dialog behind window message
        if ($os.platform === "linux" && $activePopup !== "initialize") {
            alertMessage.set("The folder select dialog might appear behind the window on Linux!<br>Please check that if you don't see it.")
            activePopup.set("alert")
        }

        sendMain(Main.OPEN_FOLDER, { channel: id, title, path })
    }
</script>

<Button on:click={pickFolder} {title} {style} {center} dark>
    <slot />
    <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>

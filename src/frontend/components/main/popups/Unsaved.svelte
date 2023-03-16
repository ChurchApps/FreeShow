<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup } from "../../../stores"
    import { save } from "../../../utils/save"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    const closeApp = () => window.api.send(MAIN, { channel: "CLOSE" })

    const actions = {
        n: () => activePopup.set(null),
        q: () => closeApp(),
        y: () => {
            save()
            setTimeout(closeApp, 500)
        },
    }

    function keydown(e: any) {
        if (actions[e.key]) {
            e.preventDefault()
            actions[e.key]()
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div>
    <Button
        on:click={() => {
            activePopup.set(null)
        }}
        dark
        center
    >
        <T id="popup.cancel" /> (n)
    </Button>
    <Button on:click={closeApp} dark center>
        <T id="popup.quit" /> (q)
    </Button>
    <Button
        on:click={() => {
            save()
            setTimeout(closeApp, 500)
        }}
        dark
        center
        style="color: var(--secondary);"
    >
        <T id="popup.save_quit" /> (y)
    </Button>
</div>

<style>
    div {
        display: flex;
        gap: 10px;
        justify-content: space-around;
    }

    div :global(button) {
        flex: 1;
    }
</style>

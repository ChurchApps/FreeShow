<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import Capture from "./Capture.svelte"
    import { clearBackground } from "../../helpers/showActions"

    let screens: any[] = []
    export let streams: any[]
    send(MAIN, ["GET_SCREENS"])
    receive(MAIN, { GET_SCREENS: (d: any) => (screens = d) }, "GET_SCREENS")
    onDestroy(() => destroy(MAIN, "GET_SCREENS"))

    $: currentOutput = $outputs[getActiveOutputs()[0]] || {}

    $: console.log(screens)
</script>

{#each screens as screen}
    <Capture
        bind:streams
        {screen}
        on:click={(e) => {
            if ($outLocked || e.ctrlKey || e.metaKey) return
            if (currentOutput.out?.background?.id === screen.id) clearBackground()
            else setOutput("background", { id: screen.id, type: "screen" })
        }}
    />
{/each}

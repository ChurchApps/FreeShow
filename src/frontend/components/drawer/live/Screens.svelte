<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { outLocked, outputs } from "../../../stores"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import Capture from "./Capture.svelte"

    let screens: { name: string; id: string }[] = []
    export let streams: any[]

    onMount(async () => {
        screens = await requestMain(Main.GET_SCREENS)
    })

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

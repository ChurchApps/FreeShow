<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { clone } from "../../helpers/array"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import Capture from "./Capture.svelte"
    import { clearBackground } from "../../helpers/showActions"

    export let streams: any[]
    export let searchValue: string = ""

    let windows: any[] = []
    send(MAIN, ["GET_WINDOWS"])
    receive(MAIN, { GET_WINDOWS: (d: any) => (windows = d) }, "GET_WINDOWS")
    onDestroy(() => destroy(MAIN, "GET_WINDOWS"))

    // search
    $: if (windows || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let fullFilteredWindows: any[] = []
    function filterSearch() {
        fullFilteredWindows = clone(windows)
        if (searchValue.length > 1) fullFilteredWindows = fullFilteredWindows.filter((a) => filter(a.name).includes(searchValue))
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]] || {}
</script>

{#if fullFilteredWindows.length}
    {#key fullFilteredWindows}
        {#each fullFilteredWindows as window}
            <Capture
                bind:streams
                screen={window}
                on:click={(e) => {
                    if ($outLocked || e.ctrlKey || e.metaKey) return
                    if (currentOutput.out?.background?.id === window.id) clearBackground()
                    else setOutput("background", { id: window.id, type: "screen" })
                }}
            />
        {/each}
    {/key}
{:else}
    <Center size={1.2} faded>
        {#if windows.length}
            <T id="empty.search" />
        {:else}
            <T id="empty.general" />
        {/if}
    </Center>
{/if}

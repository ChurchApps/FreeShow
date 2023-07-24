<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import Capture from "./Capture.svelte"

    export let streams: any[]
    export let searchValue: string = ""

    let windows: any[] = []
    send(MAIN, ["GET_WINDOWS"])
    receive(MAIN, {
        GET_WINDOWS: (d: any) => {
            // set freeshow last
            // let index = d.findIndex((a: any) => a.name === "FreeShow")
            // if (index >= 0) {
            //   let thisWindow = d.splice(index, 1)
            //   d = [...d, ...thisWindow]
            // }
            windows = d
        },
    })

    // search
    $: if (windows || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let fullFilteredWindows: any[] = []
    function filterSearch() {
        fullFilteredWindows = JSON.parse(JSON.stringify(windows))
        if (searchValue.length > 1) fullFilteredWindows = fullFilteredWindows.filter((a) => filter(a.name).includes(searchValue))
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]
</script>

{#if fullFilteredWindows.length}
    {#key fullFilteredWindows}
        {#each fullFilteredWindows as window}
            <Capture
                bind:streams
                screen={window}
                on:click={(e) => {
                    if ($outLocked || e.ctrlKey || e.metaKey) return
                    if (currentOutput.out?.background?.id === window.id) setOutput("background", null)
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

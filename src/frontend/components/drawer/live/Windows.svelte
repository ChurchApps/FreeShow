<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { outLocked, outputs } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import Capture from "./Capture.svelte"

    export let streams: MediaStream[]
    export let searchValue = ""

    let windows: { name: string; id: string }[] = []

    onMount(async () => {
        windows = await requestMain(Main.GET_WINDOWS)
    })

    // search
    $: if (windows || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let fullFilteredWindows: { id: string; name: string }[] = []
    function filterSearch() {
        fullFilteredWindows = clone(windows)
        if (searchValue.length > 1) fullFilteredWindows = fullFilteredWindows.filter((a) => filter(a.name).includes(searchValue))
    }

    $: currentOutput = getFirstActiveOutput($outputs)
</script>

{#if fullFilteredWindows.length}
    {#key fullFilteredWindows}
        {#each fullFilteredWindows as window}
            <Capture
                bind:streams
                screen={window}
                on:click={(e) => {
                    if ($outLocked || e.ctrlKey || e.metaKey) return
                    if (currentOutput?.out?.background?.id === window.id) clearBackground()
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

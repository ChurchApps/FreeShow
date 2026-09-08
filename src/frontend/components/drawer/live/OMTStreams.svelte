<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OMT } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import OMTStream from "./OMTStream.svelte"

    let sources: { name: string; id: string }[] = []

    $: currentOutput = getFirstActiveOutput($outputs)

    let loading = true
    const receiveOMT = {
        RECEIVE_LIST: (msg) => {
            loading = false
            if (!msg) return

            // sources come and go while this list is open, so always take the latest set
            const list = JSON.parse(msg).map(({ name, urlAddress }) => ({ name, id: urlAddress }))
            if (JSON.stringify(list) !== JSON.stringify(sources)) sources = list
        }
    }

    // discovery is asynchronous: a source that starts after this opened must still appear
    const REFRESH_INTERVAL_MS = 3000
    let refreshInterval: NodeJS.Timeout | null = null

    receive(OMT, receiveOMT, "OMT_CAPTURE")
    onMount(() => {
        send(OMT, ["RECEIVE_LIST"], {})
        refreshInterval = setInterval(() => send(OMT, ["RECEIVE_LIST"], {}), REFRESH_INTERVAL_MS)
    })
    onDestroy(() => {
        if (refreshInterval) clearInterval(refreshInterval)
        destroy(OMT, "OMT_CAPTURE")
    })
</script>

{#if loading}
    <Center>
        <Loader />
    </Center>
{:else if sources.length}
    {#each sources as screen}
        <OMTStream
            {screen}
            on:click={(e) => {
                if ($outLocked || e.ctrlKey || e.metaKey) return
                if (currentOutput?.out?.background?.id === screen.id) clearBackground()
                else setOutput("background", { id: screen.id, type: "omt" })
            }}
        />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

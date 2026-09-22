<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { OMT } from "../../../../types/Channels"
    import { destroy, receive, send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import OMTStream from "./OMTStream.svelte"

    let sources: { name: string; id: string }[] = []

    let loading = true
    const receiveOMT = {
        RECEIVE_LIST: (msg) => {
            loading = false
            if (!msg) return

            const list = JSON.parse(msg).map(({ name, urlAddress }) => ({ name, id: urlAddress }))
            if (JSON.stringify(list) !== JSON.stringify(sources)) sources = list
        }
    }

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

    let dispatch = createEventDispatcher()
    function click(event: any, screen: { name: string; id: string }) {
        dispatch("click", { event, screen })
    }
</script>

{#if loading}
    <Center>
        <Loader />
    </Center>
{:else if sources.length}
    {#each sources as screen}
        <OMTStream
            {screen}
            on:click={(e) => click(e.detail || e, screen)}
        />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

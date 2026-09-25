<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { special } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import NDIStream from "./NDIStream.svelte"

    let sources: { name: string; id: string }[] = []

    let loading = true
    const receiveNDI = {
        RECEIVE_LIST: (msg) => {
            loading = false
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map(({ name, urlAddress }) => ({ name, id: urlAddress }))
        }
    }

    $: groups = $special?.ndiInputGroups || ""

    receive(NDI, receiveNDI, "NDI_CAPTURE")
    $: send(NDI, ["RECEIVE_LIST"], { groups })
    onDestroy(() => destroy(NDI, "NDI_CAPTURE"))

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
        <NDIStream
            {screen}
            on:click={(e) => click(e.detail || e, screen)}
        />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

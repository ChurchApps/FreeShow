<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { destroy, receive, send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import BmdStream from "./BMDStream.svelte"

    let sources: any[] = []

    const receiveBMD: any = {
        GET_DEVICES: (msg) => {
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
        }
    }

    send(BLACKMAGIC, ["GET_DEVICES"])
    receive(BLACKMAGIC, receiveBMD, "GET_DEVICES_RECEIVER")
    onDestroy(() => destroy(BLACKMAGIC, "GET_DEVICES_RECEIVER"))

    let dispatch = createEventDispatcher()
    function click(event: any, screen: any) {
        dispatch("click", { event, screen })
    }
</script>

{#if sources.length}
    {#each sources as screen}
        <BmdStream
            {screen}
            on:click={(e) => click(e.detail || e, screen)}
        />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

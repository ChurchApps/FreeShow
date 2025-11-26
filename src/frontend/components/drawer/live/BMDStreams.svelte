<script lang="ts">
    import { onDestroy } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import BmdStream from "./BMDStream.svelte"

    let sources: any[] = []

    $: currentOutput = getFirstActiveOutput($outputs)

    const receiveBMD: any = {
        GET_DEVICES: (msg) => {
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
        }
    }

    send(BLACKMAGIC, ["GET_DEVICES"])
    receive(BLACKMAGIC, receiveBMD, "GET_DEVICES_RECEIVER")
    onDestroy(() => destroy(BLACKMAGIC, "GET_DEVICES_RECEIVER"))

    $: console.log(sources)
</script>

{#if sources.length}
    {#each sources as screen}
        <BmdStream
            {screen}
            on:click={(e) => {
                if ($outLocked || e.ctrlKey || e.metaKey) return
                if (currentOutput?.out?.background?.id === screen.id) clearBackground()
                else setOutput("background", { id: screen.id, type: "blackmagic" })
            }}
        />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<script lang="ts">
    import { onDestroy } from "svelte"
    import { BLACKMAGIC } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import BmdStream from "./BMDStream.svelte"

    let sources: any[] = []

    $: currentOutput = $outputs[getActiveOutputs()[0]] || {}

    const receiveBMD: any = {
        RECEIVE_LIST: (msg) => {
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
        },
    }

    send(BLACKMAGIC, ["GET_DEVICES"])
    receive(BLACKMAGIC, receiveBMD, "BLACKMAGIC_CAPTURE")
    onDestroy(() => destroy(BLACKMAGIC, "BLACKMAGIC_CAPTURE"))

    $: console.log(sources)
</script>

{#each sources as screen}
    <BmdStream
        {screen}
        on:click={(e) => {
            if ($outLocked || e.ctrlKey || e.metaKey) return
            if (currentOutput.out?.background?.id === screen.id) clearBackground()
            else setOutput("background", { id: screen.id, type: "blackmagic" })
        }}
    />
{/each}

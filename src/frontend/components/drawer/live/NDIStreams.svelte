<script lang="ts">
    import { onDestroy } from "svelte"
    import { NDI } from "../../../../types/Channels"
    import { outLocked, outputs } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import NDIStream from "./NDIStream.svelte"
    import { clearBackground } from "../../helpers/showActions"

    let sources: any[] = []

    $: currentOutput = $outputs[getActiveOutputs()[0]]

    const receiveNDI: any = {
        RECEIVE_LIST: (msg) => {
            if (!msg || sources.length) return

            sources = JSON.parse(msg).map(({ name, urlAddress }) => ({ name, id: urlAddress }))
        },
    }

    send(NDI, ["RECEIVE_LIST"])
    receive(NDI, receiveNDI, "NDI_CAPTURE")
    onDestroy(() => destroy(NDI, "NDI_CAPTURE"))

    $: console.log(sources)
</script>

{#each sources as screen}
    <NDIStream
        {screen}
        on:click={(e) => {
            if ($outLocked || e.ctrlKey || e.metaKey) return
            if (currentOutput.out?.background?.id === screen.id) clearBackground()
            else setOutput("background", { id: screen.id, type: "ndi" })
        }}
    />
{/each}

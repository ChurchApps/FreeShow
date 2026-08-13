<script lang="ts">
    import { onMount } from "svelte"
    import type { EngineStatus } from "../../../../types/ai/AiModels"
    import { Main } from "../../../../types/IPC/Main"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Loader from "../../../components/main/Loader.svelte"
    import { requestMain, sendMain } from "../../../IPC/main"

    const engine = "nemotron"

    // $: options = $ai.stt || {}
    // $: engineOptions = options.engineOptions?.[engine] || {}

    // function updateEngineOption(key: string, value: any) {
    //     ai.update((a) => {
    //         if (!a.stt) a.stt = {}
    //         if (!a.stt.engineOptions) a.stt.engineOptions = {}
    //         if (!a.stt.engineOptions[engine]) a.stt.engineOptions[engine] = {}
    //         a.stt.engineOptions[engine][key] = value
    //         return a
    //     })
    // }

    // STATUS

    let status: EngineStatus | null = null
    async function getStatus() {
        const result = await requestMain(Main.AI_GET_STATUS, { engineId: engine })
        status = result?.[engine] || null
    }

    onMount(() => {
        getStatus()
    })

    // DOWNLOADS

    $: isModelDownloaded = status?.ready
    // $: isModelDownloading = !!$mediaDownloads["nemotron"]

    // NEMOTRON MODEL

    let isModelDownloading = false
    async function downloadModel() {
        if (isModelDownloading) return
        isModelDownloading = true

        await requestMain(Main.AI_SETUP, { action: "download", engineId: "nemotron" }, undefined, 60 * 60 * 1000)
        isModelDownloading = false

        getStatus()
    }

    function deleteModel() {
        sendMain(Main.AI_SETUP, { action: "delete", engineId: "nemotron" })
        setTimeout(getStatus, 200)
    }
</script>

{#if !status}
    <div style="display: flex;justify-content: center;padding: 10px;">
        <Loader />
    </div>
{:else if !status.ready}
    {#if status.localPath}
        <!-- the model was downloaded before the addon became unavailable - 660 MB must stay reclaimable -->
        <MaterialButton variant="outlined" icon="delete" on:click={deleteModel}>
            <T id="actions.delete" />
        </MaterialButton>
    {/if}
{:else if !isModelDownloaded}
    <MaterialButton variant="outlined" icon="download" disabled={isModelDownloading} style="width: 100%;" on:click={downloadModel}>
        <T id="cloud.replace" />
    </MaterialButton>
{:else}
    <!-- options -->
{/if}

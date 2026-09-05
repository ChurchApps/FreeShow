<script lang="ts">
    import { onMount } from "svelte"
    import type { EngineStatus } from "../../../../types/ai/Ai"
    import { Main } from "../../../../types/IPC/Main"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Loader from "../../../components/main/Loader.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { mediaDownloads } from "../../../stores"

    const engine = "nemotron"

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

    // the whole multi-file download reports under one stable "nemotron" key
    $: modelDownload = $mediaDownloads.get("nemotron")
    $: isModelDownloading = modelDownloadStarted || modelDownload?.status === "downloading"

    function getPercent(download: { progress: number; total: number } | undefined) {
        if (!download?.total) return ""
        return ` ${Math.min(100, Math.floor((download.progress / download.total) * 100))}%`
    }

    // NEMOTRON MODEL

    let modelDownloadStarted = false
    async function downloadModel() {
        if (isModelDownloading) return
        modelDownloadStarted = true

        await requestMain(Main.AI_SETUP, { action: "download", engineId: "nemotron" }, undefined, 60 * 60 * 1000)
        modelDownloadStarted = false

        getStatus()
    }

    function cancelDownload() {
        sendMain(Main.AI_SETUP, { action: "cancel", engineId: "nemotron" })
        modelDownloadStarted = false
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
{:else if status.supported === false}
    <Tip type="warning" value="ai.nemotron_unsupported" />

    {#if status.localPath}
        <!-- the model was downloaded before the addon became unavailable - 660 MB must stay reclaimable -->
        <MaterialButton variant="outlined" icon="delete" on:click={deleteModel}>
            <T id="actions.delete" />
        </MaterialButton>
    {/if}
{:else if !status.ready}
    <div style="display: flex;gap: 5px;">
        <MaterialButton variant="outlined" icon="download" disabled={isModelDownloading} style="flex: 1;" on:click={downloadModel}>
            <T id="cloud.replace" />{getPercent(modelDownload)}
        </MaterialButton>

        {#if isModelDownloading}
            <MaterialButton variant="outlined" icon="close" title="actions.cancel" on:click={cancelDownload} />
        {/if}
    </div>
{:else}
    <MaterialButton variant="outlined" icon="delete" on:click={deleteModel}>
        <T id="actions.delete" />
    </MaterialButton>
{/if}

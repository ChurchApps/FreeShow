<script lang="ts">
    import { fade, slide } from "svelte/transition"
    import { mediaDownloads, pdfImports } from "../../stores"
    import Icon from "../helpers/Icon.svelte"

    $: imports = Array.from($pdfImports.entries())
    $: hasEntries = imports.length > 0
    $: hasMediaDownloads = Array.from($mediaDownloads.values()).some((data) => data.status === "downloading")

    function getPercent(progress: number, total: number) {
        if (!total) return 0
        return Math.max(0, Math.min(100, (progress / total) * 100))
    }

    function getPercentLabel(progress: number, total: number) {
        return `${Math.round(getPercent(progress, total))}%`
    }
</script>

{#if hasEntries}
    <div class="container" style={hasMediaDownloads ? "bottom: 170px;" : "bottom: 12px;"} transition:slide={{ duration: 200 }}>
        <div class="header">
            <Icon id="pdf" size={0.9} white />
            <span>Importando PDF</span>
        </div>

        {#each imports as [filePath, data] (filePath)}
            <div class="item" transition:fade={{ duration: 150 }}>
                <div class="top-row">
                    <div class="name" title={data.name}>{data.name}</div>
                    {#if data.status === "complete"}
                        <span class="status ok">Completado</span>
                    {:else if data.status === "error"}
                        <span class="status error">Error</span>
                    {:else}
                        <span class="status">{getPercentLabel(data.progress, data.total)}</span>
                    {/if}
                </div>

                {#if data.status === "importing"}
                    <div class="bar">
                        <div class="fill" style="width: {getPercent(data.progress, data.total)}%" />
                    </div>
                {:else if data.status === "error"}
                    <div class="message" title={data.message}>{data.message || "No se pudo importar este PDF."}</div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .container {
        position: fixed;
        bottom: 12px;
        right: 12px;
        width: 320px;

        box-shadow: 1px 1px 3px 2px rgb(0 0 0 / 0.2);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;

        z-index: 4999;
        overflow: hidden;

        --background: rgba(35, 35, 45, 0.88);
        background-color: var(--background);
        backdrop-filter: blur(8px);
    }

    .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
        font-size: 0.9em;
        font-weight: 600;
    }

    .item {
        padding: 10px 14px;
        border-bottom: 1px solid var(--primary-darker);
    }

    .item:last-child {
        border-bottom: none;
    }

    .top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .name {
        font-size: 0.85em;
        opacity: 0.95;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 230px;
    }

    .status {
        font-size: 0.75em;
        opacity: 0.75;
    }

    .status.ok {
        color: #7ddc96;
        opacity: 1;
    }

    .status.error {
        color: #ff8f8f;
        opacity: 1;
    }

    .bar {
        width: 100%;
        height: 6px;
        background-color: var(--primary-darkest);
        border-radius: 3px;
        overflow: hidden;
    }

    .fill {
        height: 100%;
        background: linear-gradient(90deg, #3fbf7f 0%, #8fe388 100%);
        transition: width 0.3s ease;
        border-radius: 3px;
    }

    .message {
        font-size: 0.78em;
        color: #ff9b9b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>

<script lang="ts">
    import { fade, slide } from "svelte/transition"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { mediaDownloads, pdfImports } from "../../stores"
    import { translateText } from "../../utils/language"
    import T from "../helpers/T.svelte"

    let dismissed = false
    let seenUrls = new Set<string>()

    $: mediaEntries = Array.from($mediaDownloads.entries())
    $: hasDownloads = mediaEntries.length > 0 && !dismissed

    $: imports = Array.from($pdfImports.entries())
    $: hasPdfImports = imports.length > 0
    $: hasProgress = hasDownloads || hasPdfImports

    // reset dismissed state when a new download appears
    $: {
        const currentUrls = new Set(mediaEntries.map(([url]) => url))
        const hasNewDownload = Array.from(currentUrls).some((url) => !seenUrls.has(url))

        if (hasNewDownload && dismissed) {
            dismissed = false
        }

        seenUrls = currentUrls
    }

    function getFileName(url: string): string {
        try {
            const urlObj = new URL(url)
            const pathname = urlObj.pathname
            const parts = pathname.split("/")
            const fileName = parts[parts.length - 1] || "media file"
            return decodeURIComponent(fileName).slice(0, 40)
        } catch {
            return "media file"
        }
    }

    function dismiss() {
        dismissed = true
    }

    function getPercent(progress: number, total: number) {
        if (!total) return 0
        return Math.max(0, Math.min(100, (progress / total) * 100))
    }

    function getPercentLabel(progress: number, total: number) {
        return `${Math.round(getPercent(progress, total))}%`
    }

    function getStatusLabel(status: string, progress: number, total: number) {
        if (status === "error") return translateText("error.import")
        if (status === "complete") return "100%"
        return getPercentLabel(progress, total)
    }
</script>

{#if hasProgress}
    <div class="container" transition:slide={{ duration: 200 }}>
        {#if hasDownloads}
            <div class="header">
                <Icon id="download" size={0.9} white />
                <span><T id="media.downloading" /></span>
                <MaterialButton style="padding: 5px;" icon="close" on:click={dismiss} title="actions.close" white />
            </div>

            {#each mediaEntries as [url, data] (url)}
                <div class="download-item" transition:fade={{ duration: 150 }}>
                    <div class="pdf-top-row">
                        <div class="file-name" title={getFileName(url)}>{getFileName(url)}</div>
                        <span class="status {data.status === 'error' ? 'error' : data.status === 'complete' ? 'ok' : ''}">{getStatusLabel(data.status, data.progress, data.total)}</span>
                    </div>

                    {#if data.status !== "error"}
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {getPercent(data.progress, data.total)}%" />
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}

        {#if hasPdfImports}
            <div class="header {hasDownloads ? 'section' : ''}">
                <Icon id="pdf" size={0.9} white />
                <span><T id="popup.importing" /> PDF</span>
            </div>

            {#each imports as [filePath, data] (filePath)}
                <div class="download-item" transition:fade={{ duration: 150 }}>
                    <div class="pdf-top-row">
                        <div class="file-name" title={data.name}>{data.name}</div>
                        <span class="status {data.status === 'error' ? 'error' : data.status === 'complete' ? 'ok' : ''}">{getStatusLabel(data.status, data.progress, data.total)}</span>
                    </div>

                    {#if data.status === "importing"}
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {getPercent(data.progress, data.total)}%" />
                        </div>
                    {:else if data.status === "error"}
                        <div class="progress-text error-text" title={data.message}>{data.message || translateText("error.import")}</div>
                    {/if}
                </div>
            {/each}
        {/if}
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

        --background: rgba(35, 35, 45, 0.8);
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

    .header span {
        flex: 1;
    }

    .header.section {
        border-top: 1px solid var(--primary-lighter);
    }

    .download-item {
        padding: 10px 14px;
        border-bottom: 1px solid var(--primary-darker);
    }

    .download-item:last-child {
        border-bottom: none;
    }

    .file-name {
        font-size: 0.85em;
        margin-bottom: 8px;
        opacity: 0.9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .progress-bar {
        width: 100%;
        height: 6px;
        background-color: var(--primary-darkest);
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #8000f0 0%, var(--secondary) 100%);
        transition: width 0.3s ease;
        border-radius: 3px;
    }

    .progress-text {
        font-size: 0.75em;
        opacity: 0.7;
        text-align: right;
    }

    .pdf-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
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

    .error-text {
        color: #ff9b9b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>

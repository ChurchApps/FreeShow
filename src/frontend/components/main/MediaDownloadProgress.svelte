<script lang="ts">
    import { fade, slide } from "svelte/transition"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { mediaDownloads } from "../../stores"
    import T from "../helpers/T.svelte"

    $: downloads = $mediaDownloads

    let dismissed = false
    let seenUrls = new Set<string>()

    $: activeDownloads = Array.from(downloads.entries()).filter(([_, data]) => data.status === "downloading")
    $: hasDownloads = activeDownloads.length > 0 && !dismissed

    // reset dismissed state when a new download appears
    $: {
        const currentUrls = new Set(activeDownloads.map(([url]) => url))
        const hasNewDownload = Array.from(currentUrls).some((url) => !seenUrls.has(url))

        if (hasNewDownload && dismissed) {
            dismissed = false
        }

        seenUrls = currentUrls
    }

    // WIP duplicated functions
    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
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
</script>

{#if hasDownloads}
    <div class="container" transition:slide={{ duration: 200 }}>
        <div class="header">
            <Icon id="download" size={0.9} white />
            <span><T id="media.downloading" /></span>
            <MaterialButton style="padding: 5px;" icon="close" on:click={dismiss} title="actions.close" white />
        </div>

        {#each activeDownloads as [url, data] (url)}
            <div class="download-item" transition:fade={{ duration: 150 }}>
                <div class="file-name">{getFileName(url)}</div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {(data.progress / data.total) * 100}%" />
                    </div>
                    <div class="progress-text">
                        {formatBytes(data.progress)} / {formatBytes(data.total)}
                    </div>
                </div>
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

    .progress-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
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
</style>

<script lang="ts">
    import { slide } from "svelte/transition"
    import { activePage, os, settingsTab, statusIndicator } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    $: isWindows = $os.platform === "win32"

    const titles = {
        saving: "toast.saving",
        saved: "toast.saved",
        syncing: "cloud.syncing",
        synced: "cloud.sync_complete",
        copied: "actions.copied",
        pasted: "actions.pasted",
        duplicated: "actions.duplicated",
        error: "Error"
    }

    function onClick() {
        switch (indicatorId) {
            case "saving":
            case "saved":
            case "syncing":
            case "synced":
                settingsTab.set("files")
                activePage.set("settings")
                break
        }
    }

    // WIP more indicators:
    // Backup / restore

    // don't show a new indicator while the current one is clearing
    let indicatorId: string = ""
    let maxTimeout: NodeJS.Timeout | null = null
    let indicatorTimeout: NodeJS.Timeout | null = null
    $: if ($statusIndicator !== undefined) updateIndicator()
    function updateIndicator() {
        if (indicatorTimeout) {
            if ($statusIndicator && indicatorId) indicatorId = $statusIndicator
            return
        }

        indicatorId = $statusIndicator || ""
        indicatorTimeout = setTimeout(() => {
            indicatorTimeout = null
            if ($statusIndicator !== indicatorId) updateIndicator()
            else if (maxTimeout) clearTimeout(maxTimeout)
        }, 301)

        if (maxTimeout) clearTimeout(maxTimeout)
        maxTimeout = setTimeout(() => {
            if (indicatorTimeout) clearTimeout(indicatorTimeout)
            indicatorTimeout = null
            indicatorId = ""
        }, 10000)
    }
</script>

{#if indicatorId}
    <div class="status" style={isWindows ? "transform: translateY(25px);" : ""} role="none" data-title={translateText(titles[indicatorId] || "")} on:click={onClick} transition:slide={{ axis: "x", duration: 300 }}>
        <div class={indicatorId}>
            {#if indicatorId === "saving"}
                <Icon id="save" white />
            {:else if indicatorId === "saved"}
                <Icon id="save" white />
                <div class="marker">
                    <Icon id="check" size={0.5} white />
                </div>
            {:else if indicatorId === "syncing"}
                <Icon id="loop" white />
            {:else if indicatorId === "synced"}
                <Icon id="cloud_done" white />
            {:else if indicatorId === "copied"}
                <Icon id="copy" white />
            {:else if indicatorId === "pasted"}
                <Icon id="paste" white />
            {:else if indicatorId === "duplicated"}
                <Icon id="duplicate" white />
            {:else if indicatorId === "error"}
                <Icon id="close" white />
            {/if}
        </div>
    </div>
{/if}

<style>
    .status {
        position: absolute;
        top: 0;
        left: 0;

        width: 40px;
        padding-right: 2px;
        height: 34px;
        margin-top: 3px;

        background-color: var(--primary-darker);

        border: 2px solid var(--primary-lighter);
        border-left: none;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: 5000;
    }

    .marker {
        position: absolute;
        bottom: 1px;
        right: 5px;
    }

    .status :global(.saving) {
        animation: wave 1.4s linear infinite;
        display: flex;
    }

    .status :global(.syncing) {
        animation: spin 2s linear infinite;
        display: flex;
    }

    @keyframes wave {
        0% {
            transform: rotate(0deg);
        }
        25% {
            transform: rotate(15deg);
        }
        50% {
            transform: rotate(0deg);
        }
        75% {
            transform: rotate(-15deg);
        }
        100% {
            transform: rotate(0deg);
        }
    }
    @keyframes spin {
        from {
            transform: rotate(360deg);
        }
        to {
            transform: rotate(0deg);
        }
    }
</style>

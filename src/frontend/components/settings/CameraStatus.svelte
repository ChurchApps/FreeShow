<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { cameraManager } from "../helpers/cameraManager"
    import { special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    let cameraStatus: Array<{id: string, name: string, active: boolean, retryCount: number, lastError: string | null}> = []
    let refreshInterval: NodeJS.Timeout | null = null

    onMount(() => {
        updateStatus()
        // Refresh status every 5 seconds
        refreshInterval = setInterval(updateStatus, 5000)
    })

    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval)
        }
    })

    function updateStatus() {
        cameraStatus = cameraManager.getCameraStatus()
    }

    async function refreshCameras() {
        await cameraManager.refreshCameraWarming()
        updateStatus()
    }

    $: isEnabled = $special.keepCamerasWarm
</script>

{#if isEnabled && cameraStatus.length > 0}
    <div class="camera-status">
        <div class="header">
            <div class="title">
                <Icon id="camera" size={1.2} />
                <T id="status.camera_warming" />
            </div>
            <Button style="padding: 4px 8px;" on:click={refreshCameras} title="Refresh cameras">
                <Icon id="reload" size={0.9} />
            </Button>
        </div>
        
        <div class="cameras">
            {#each cameraStatus as camera (camera.id)}
                <div class="camera-item" class:active={camera.active} class:error={camera.lastError}>
                    <div class="camera-info">
                        <div class="camera-name">{camera.name}</div>
                        {#if camera.retryCount > 0}
                            <div class="retry-info">Retry {camera.retryCount}/3</div>
                        {/if}
                        {#if camera.lastError}
                            <div class="error-info" title={camera.lastError}>Error</div>
                        {/if}
                    </div>
                    <div class="status-indicator" class:active={camera.active}>
                        <Icon id={camera.active ? "check" : "close"} size={0.8} />
                    </div>
                </div>
            {/each}
        </div>
    </div>
{:else if isEnabled}
    <div class="camera-status">
        <div class="header">
            <div class="title">
                <Icon id="camera" size={1.2} />
                <T id="status.camera_warming" />
            </div>
        </div>
        <div class="no-cameras">
            <T id="status.no_cameras_found" />
        </div>
    </div>
{/if}

<style>
    .camera-status {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 12px;
        margin: 8px 0;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
        font-size: 0.9em;
        opacity: 0.9;
    }

    .cameras {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .camera-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        border-left: 3px solid var(--status-color, rgba(255, 255, 255, 0.2));
    }

    .camera-item.active {
        --status-color: #4ade80;
    }

    .camera-item.error {
        --status-color: #ef4444;
    }

    .camera-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .camera-name {
        font-size: 0.85em;
        font-weight: 500;
    }

    .retry-info, .error-info {
        font-size: 0.75em;
        opacity: 0.7;
    }

    .error-info {
        color: #ef4444;
    }

    .status-indicator {
        padding: 4px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: #ef4444;
    }

    .status-indicator.active {
        background: rgba(74, 222, 128, 0.2);
        color: #4ade80;
    }

    .no-cameras {
        text-align: center;
        opacity: 0.6;
        font-size: 0.85em;
        padding: 12px;
    }
</style>
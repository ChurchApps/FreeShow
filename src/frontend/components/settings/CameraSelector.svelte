<script lang="ts">
    import { onMount } from "svelte"
    import { special } from "../../stores"
    import { cameraManager } from "../helpers/cameraManager"
    import MaterialCheckbox from "../inputs/MaterialCheckbox.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Icon from "../helpers/Icon.svelte"
    import { translateText } from "../../utils/language"

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    interface Camera {
        id: string
        name: string
        groupId: string
    }

    let availableCameras: Camera[] = []
    let loading = true
    let error = ""

    // Make selectedCameras reactive to the special store
    $: selectedCameras = $special.selectedCameras || []
    
    // Debug logging to ensure persistence works
    $: {
        if (selectedCameras.length > 0) {
            console.info(`Camera selector: ${selectedCameras.length} cameras selected`)
        }
    }

    onMount(async () => {
        await loadCameras()
    })

    async function loadCameras() {
        loading = true
        error = ""
        try {
            availableCameras = await cameraManager.getAvailableCamerasForSelection()
            if (availableCameras.length === 0) {
                error = "camera_selector.no_cameras_found"
            }
        } catch (err) {
            console.error("Failed to load cameras:", err)
            error = "camera_selector.failed_to_load"
        } finally {
            loading = false
        }
    }

    function toggleCamera(cameraId: string, checked: boolean) {
        const currentSelection = $special.selectedCameras || []
        let newSelection: string[]
        
        if (checked) {
            newSelection = [...currentSelection, cameraId]
        } else {
            newSelection = currentSelection.filter(id => id !== cameraId)
        }
        
        updateSpecial(newSelection, "selectedCameras")
        
        // Reinitialize cameras with new selection
        setTimeout(() => {
            cameraManager.refreshCameraWarming()
        }, 100)
    }

    function selectAll() {
        const allCameraIds = availableCameras.map(camera => camera.id)
        updateSpecial(allCameraIds, "selectedCameras")
        setTimeout(() => {
            cameraManager.refreshCameraWarming()
        }, 100)
    }

    function selectNone() {
        updateSpecial([], "selectedCameras")
        setTimeout(() => {
            cameraManager.refreshCameraWarming()
        }, 100)
    }

    async function refreshCameras() {
        await loadCameras()
        // Remove selection for cameras that no longer exist
        const currentSelection = $special.selectedCameras || []
        const existingIds = availableCameras.map(c => c.id)
        const validSelection = currentSelection.filter(id => existingIds.includes(id))
        if (validSelection.length !== currentSelection.length) {
            updateSpecial(validSelection, "selectedCameras")
        }
    }
</script>

<div class="camera-selector">
    <div class="header">
        <h4>{translateText("camera_selector.title")}</h4>
        <MaterialButton 
            on:click={refreshCameras} 
            title="camera_selector.refresh"
            white
        >
            <Icon id="refresh" />
        </MaterialButton>
    </div>

    {#if loading}
        <div class="status loading">
            <Icon id="loading" />
            {translateText("camera_selector.loading")}
        </div>
    {:else if error}
        <div class="status error">
            <Icon id="error" />
            {translateText(error)}
        </div>
    {:else if availableCameras.length === 0}
        <div class="status">
            <Icon id="info" />
            {translateText("camera_selector.no_cameras")}
        </div>
    {:else}
        <div class="controls">
            <MaterialButton on:click={selectAll} title="camera_selector.select_all" white>
                {translateText("camera_selector.select_all")}
            </MaterialButton>
            <MaterialButton on:click={selectNone} title="camera_selector.select_none" white>
                {translateText("camera_selector.select_none")}
            </MaterialButton>
        </div>

        <div class="camera-list">
            {#each availableCameras as camera}
                <MaterialCheckbox
                    label={camera.name}
                    checked={selectedCameras.includes(camera.id)}
                    on:change={(e) => toggleCamera(camera.id, e.detail)}
                />
            {/each}
        </div>

        <div class="info">
            {translateText("camera_selector.selected_count", {
                selected: selectedCameras.length,
                total: availableCameras.length
            })}
        </div>
    {/if}
</div>

<style>
    .camera-selector {
        padding: 20px;
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        margin-top: 10px;
        background: var(--primary-darkest);
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }

    .header h4 {
        margin: 0;
        color: var(--text);
        font-size: 1rem;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        color: var(--text);
        border-radius: 4px;
        background: var(--primary-darker);
    }

    .status.loading {
        color: var(--secondary);
    }

    .status.error {
        color: var(--error);
        background: var(--error-background);
    }

    .controls {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    }

    .camera-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 15px;
    }

    .info {
        font-size: 0.9rem;
        color: var(--text-secondary);
        text-align: center;
        padding: 8px;
        background: var(--primary-darker);
        border-radius: 4px;
    }
</style>
<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    onMount(() => {
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "autoErrorReporting" }, (value) => {
            autoErrorReporting = value !== false
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, (value) => {
            disableHardwareAcceleration = !!value
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "graphicsDevice" }, (value) => {
            graphicsDevice = value || ""
        })
        // only shown when the platform has a real selection mechanism AND there is something to choose
        // (Linux: 2+ DRM render nodes; macOS: dual-GPU power preference; Windows: use the OS per-app
        // GPU preference instead — main returns an empty list)
        requestMain(Main.GET_GRAPHICS_DEVICES, undefined, (devices) => {
            graphicsDeviceOptions = [
                { value: "", label: translateText("settings.auto") },
                ...(devices || []).map((d) => ({ value: d.value, label: d.label || translateText(d.value === "high-performance" ? "settings.gpu_high_performance" : "settings.gpu_low_power") }))
            ]
            graphicsDeviceSupported = (devices || []).length > 0
        })
    })

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    // auto error reporting
    let autoErrorReporting = true
    function toggleAutoErrorReporting(e: any) {
        autoErrorReporting = e.detail
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "autoErrorReporting", value: autoErrorReporting })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // hardware acceleration
    let disableHardwareAcceleration = false
    function toggleHardwareAcceleration(e: any) {
        disableHardwareAcceleration = e.detail
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration", value: disableHardwareAcceleration })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // graphics device (multi-GPU; applied at next launch — see electron utils/gpu.ts)
    let graphicsDevice = ""
    let graphicsDeviceOptions: { value: string; label: string }[] = []
    let graphicsDeviceSupported = false
    function changeGraphicsDevice(e: any) {
        graphicsDevice = e.detail || ""
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "graphicsDevice", value: graphicsDevice || null })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }
</script>

<MaterialButton variant="outlined" style="width: 100%;margin-bottom: 20px;" icon="loop" on:click={() => activePopup.set("update_manager")}>
    <T id="about.check_updates" />
    <!-- <T id="popup.update_manager" /> -->
</MaterialButton>

<MaterialToggleSwitch label="settings.popup_before_close" checked={$special.showClosePopup || false} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "showClosePopup")} />

<MaterialToggleSwitch label="settings.auto_error_reporting" checked={autoErrorReporting} defaultValue={true} on:change={toggleAutoErrorReporting} />

<MaterialToggleSwitch label="settings.disable_hardware_acceleration" checked={disableHardwareAcceleration} defaultValue={false} on:change={toggleHardwareAcceleration} />

{#if graphicsDeviceSupported}
    <MaterialDropdown label="settings.graphics_device" value={graphicsDevice} defaultValue="" options={graphicsDeviceOptions} on:change={changeGraphicsDevice} />
{/if}

<!-- Optimized mode is enabled automatically based on the memory usage -->
<!-- "optimized_mode": "Optimized mode", -->
<!-- <MaterialToggleSwitch label="settings.optimized_mode" checked={$special.optimizedMode} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "optimizedMode")} /> -->

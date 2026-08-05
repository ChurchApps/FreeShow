<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, special } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    onMount(() => {
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "autoErrorReporting" }, (value) => {
            autoErrorReporting = value !== false
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, (value) => {
            disableHardwareAcceleration = !!value
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

    // AI scripture
    function toggleAiScripture(e: any) {
        special.update((a) => {
            a.aiScripture = { ...(a.aiScripture || {}), enabled: !!e.detail }
            return a
        })
    }
</script>

<MaterialButton variant="outlined" style="width: 100%;margin-bottom: 20px;" icon="loop" on:click={() => activePopup.set("update_manager")}>
    <T id="about.check_updates" />
    <!-- <T id="popup.update_manager" /> -->
</MaterialButton>

<MaterialToggleSwitch label="settings.popup_before_close" checked={$special.showClosePopup || false} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "showClosePopup")} />

<MaterialToggleSwitch label="settings.auto_error_reporting" checked={autoErrorReporting} defaultValue={true} on:change={toggleAutoErrorReporting} />

<MaterialToggleSwitch label="settings.disable_hardware_acceleration" checked={disableHardwareAcceleration} defaultValue={false} on:change={toggleHardwareAcceleration} />

<MaterialToggleSwitch label="settings.ai_scripture" checked={$special.aiScripture?.enabled || false} defaultValue={false} on:change={toggleAiScripture} />

{#if $special.aiScripture?.enabled}
    <MaterialButton variant="outlined" style="width: 100%;" icon="options" on:click={() => activePopup.set("ai_scripture")}>
        <T id="settings.ai_scripture_configure" />
    </MaterialButton>

    <p style="font-size: 0.8em;opacity: 0.7;padding: 10px 5px;">
        <T id="settings.ai_scripture_privacy" />
    </p>
{/if}

<!-- Optimized mode is enabled automatically based on the memory usage -->
<!-- "optimized_mode": "Optimized mode", -->
<!-- <MaterialToggleSwitch label="settings.optimized_mode" checked={$special.optimizedMode} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "optimizedMode")} /> -->

<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, special } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    onMount(() => {
        // getCacheSize()
        // getAudioOutputs()
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "autoErrorReporting" }, (value) => {
            autoErrorReporting = value !== false
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, (value) => {
            disableHardwareAcceleration = !!value
        })
    })

    // const previewRates = [
    //     { id: "auto", name: "$:settings.auto:$ (1|30 fps)" },
    //     { id: "optimized", name: "$:settings.optimized:$ (1 fps)" },
    //     { id: "reduced", name: "$:settings.reduced:$ (10 fps)" },
    //     { id: "full", name: "$:settings.full:$ (60 fps)" },
    // ]

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })

        // if (key === "previewRate") restartOutputs()
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

    // delete media thumbnail cache
    // function deleteCache() {
    //     if (!Object.keys($mediaCache).length) {
    //         newToast("toast.empty_cache")
    //         return
    //     }

    //     newToast("toast.deleted_cache")
    //     mediaCache.set({})
    //     cacheSize = "0 Bytes"
    // }

    // bundle media files
    function bundleMediaFiles() {
        sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true })
    }
</script>

<MaterialButton variant="outlined" style="width: 100%;margin-bottom: 20px;" icon="loop" on:click={() => activePopup.set("update_manager")}>
    <T id="about.check_updates" />
    <!-- <T id="popup.update_manager" /> -->
</MaterialButton>

<MaterialToggleSwitch label="settings.popup_before_close" checked={$special.showClosePopup || false} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "showClosePopup")} />

<MaterialToggleSwitch label="settings.auto_error_reporting" checked={autoErrorReporting} defaultValue={true} on:change={toggleAutoErrorReporting} />

<MaterialToggleSwitch label="settings.disable_hardware_acceleration" checked={disableHardwareAcceleration} defaultValue={false} on:change={toggleHardwareAcceleration} />
<!-- "optimized_mode": "Optimized mode", -->
<!-- <MaterialToggleSwitch label="settings.optimized_mode" checked={$special.optimizedMode} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "optimizedMode")} /> -->

<br />

<!-- WIP change frame rate on remote?? -->
<!-- <CombinedInput>
    <p><T id="settings.preview_frame_rate" /></p>
    <Dropdown options={previewRates} value={previewRates.find((a) => a.id === ($special.previewRate || "auto"))?.name} on:click={(e) => updateSpecial(e.detail.id, "previewRate")} />
</CombinedInput> -->

<!-- WIP custom metadata order -->
<!-- "Song: {title} - {author}, License: {ccli}" -->
<!-- or just allow to enter in a template... -->
<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={() => activePopup.set("custom_metadata_order")}>
        <Icon id="meta" style="margin-left: 0.5em;" right />
        <p><T id="popup.custom_metadata_order" /></p>
    </Button>
</CombinedInput> -->

<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="margin-left: 0.5em;" right />
        <p>
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput> -->

<!-- BUNDLE MEDIA FILES MANUALLY OR AUTOMATICALLY -->
{#if !$special.cloudSyncMediaFolder}
    <InputRow>
        <MaterialButton title="media.bundle_media_files_tip" style="width: 100%;justify-content: left;" icon="image" on:click={bundleMediaFiles}>
            <T id="media.bundle_media_files" />
        </MaterialButton>
    </InputRow>
{/if}

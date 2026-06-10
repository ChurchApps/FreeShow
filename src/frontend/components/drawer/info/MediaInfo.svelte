<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activeRecording, activeShow, cloudSyncData, drawerTabsData, special } from "../../../stores"
    import { videoExtensions } from "../../../values/extensions"
    import { formatBytes } from "../../helpers/bytes"
    import { getExtension, getFileName, getMediaInfo, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"
    import LiveInfo from "../live/LiveInfo.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"

    export let optionsOpen: boolean

    $: name = $activeShow?.name || ""
    let mediaData: { extension?: string; [key: string]: any } = {}

    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "") && !$activeShow?.id.startsWith("http") && !$activeShow?.id.startsWith("data:")) {
        mediaData = {}
        codecInfo = {}

        requestMain(Main.FILE_INFO, $activeShow?.id, (data) => {
            if (!data) return
            mediaData = { ...data.stat, extension: data.extension }
            if (!name) name = removeExtension(getFileName(data.path))
        })
        getCodecInfo()
    }

    let codecInfo: { codecs?: string[]; mimeType?: string; mimeCodec?: string } = {}
    async function getCodecInfo() {
        if (!videoExtensions.includes(getExtension($activeShow?.id || ""))) return
        const data = await getMediaInfo($activeShow?.id || "")
        if (data) codecInfo = data
    }

    // $: accessed = info.atime

    $: subTab = $drawerTabsData.media?.activeSubTab

    $: info = [
        { label: "info.extension", value: mediaData.extension?.toUpperCase() || "-" },
        { label: "info.size", value: formatBytes(mediaData.size || 0) },
        { label: "info.created", value: mediaData.birthtimeMs, type: "date" },
        { label: "info.modified", value: mediaData.mtimeMs, type: "date" },
        { label: "info.changed", value: mediaData.ctimeMs, type: "date" },
        ...(codecInfo.codecs ? [{ label: "info.codecs", value: codecInfo.codecs?.join(", ") }] : [])
        // ...(codecInfo.mimeType ? [{ label: "info.mimeType", value: codecInfo.mimeType }] : [])
    ]

    // OPTIONS

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    // bundle media files
    function bundleMediaFiles() {
        sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true })
    }
</script>

{#if subTab === "inputs" || $activeRecording}
    <LiveInfo />
{:else if subTab === "online"}
    <PlayerInfo />
{:else}
    <div class="scroll">
        {#if optionsOpen}
            <main style="overflow-x: hidden;padding: 10px;">
                <MaterialToggleSwitch label="settings.clear_media_when_finished" checked={$special.clearMediaOnFinish ?? true} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "clearMediaOnFinish", true)} />
                <MaterialToggleSwitch label="settings.auto_locate_missing_media_files" checked={$special.autoLocateMedia ?? true} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "autoLocateMedia", true)} />

                <!-- BUNDLE MEDIA FILES MANUALLY OR AUTOMATICALLY -->
                {#if !$cloudSyncData.enabled && !$special.cloudSyncMediaFolder}
                    <InputRow>
                        <MaterialButton title="media.bundle_media_files_tip" style="width: 100%;margin-top: 10px;" icon="image" on:click={bundleMediaFiles}>
                            <T id="media.bundle_media_files" />
                        </MaterialButton>
                    </InputRow>
                {/if}

                <InputRow>
                    <MaterialButton icon="launch" style="width: 100%;margin-top: 10px;" on:click={() => sendMain(Main.OPEN_CACHE)} white>
                        <T id="actions.open_cache_folder" />
                    </MaterialButton>
                </InputRow>
            </main>
        {:else if $activeShow?.type === "video" || $activeShow?.type === "image"}
            <InfoMetadata title={name} {info} />
        {:else}
            <Center>
                <Clock />
                <Date />
            </Center>
        {/if}
    </div>
{/if}

<style>
    .scroll {
        flex: 1;
    }
</style>

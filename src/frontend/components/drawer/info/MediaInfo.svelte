<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeRecording, activeShow, drawerTabsData, special } from "../../../stores"
    import { videoExtensions } from "../../../values/extensions"
    import { formatBytes } from "../../helpers/bytes"
    import Icon from "../../helpers/Icon.svelte"
    import { getExtension, getFileName, getMediaInfo, removeExtension } from "../../helpers/media"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import LiveInfo from "../live/LiveInfo.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"

    $: name = $activeShow?.name || ""
    let mediaData: { extension?: string; [key: string]: any } = {}

    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "") && !$activeShow?.id.includes("http") && !$activeShow?.id.includes("data:")) {
        mediaData = {}
        codecInfo = {}

        requestMain(Main.FILE_INFO, $activeShow?.id, data => {
            if (!data) return
            mediaData = { ...data.stat, extension: data.extension }
            if (!name) name = removeExtension(getFileName(data.path))
        })
        getCodecInfo()
    }

    $: console.log(mediaData)

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

    let settingsOpened = false

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update(a => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }
</script>

{#if subTab === "screens" || $activeRecording}
    <LiveInfo />
{:else if subTab === "online"}
    <PlayerInfo />
{:else}
    <div class="scroll">
        {#if settingsOpened}
            <main style="overflow-x: hidden;padding: 10px;">
                <MaterialToggleSwitch label="settings.clear_media_when_finished" checked={$special.clearMediaOnFinish ?? true} defaultValue={true} on:change={e => updateSpecial(e.detail, "clearMediaOnFinish", true)} />
                <MaterialToggleSwitch label="settings.auto_locate_missing_media_files" checked={$special.autoLocateMedia ?? true} defaultValue={true} on:change={e => updateSpecial(e.detail, "autoLocateMedia", true)} />
            </main>
        {:else if $activeShow?.type === "video" || $activeShow?.type === "image"}
            <InfoMetadata title={name} {info} />
        {/if}
    </div>

    <FloatingInputs round>
        <MaterialButton isActive={settingsOpened} title="edit.options" on:click={() => (settingsOpened = !settingsOpened)}>
            <Icon size={1.1} id="options" white={!settingsOpened} />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .scroll {
        flex: 1;
    }
</style>

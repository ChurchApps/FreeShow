<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeRecording, activeShow, drawerTabsData } from "../../../stores"
    import { videoExtensions } from "../../../values/extensions"
    import { formatBytes } from "../../helpers/bytes"
    import { getExtension, getFileName, getMediaInfo, removeExtension } from "../../helpers/media"
    import LiveInfo from "../live/LiveInfo.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"

    $: name = $activeShow?.name || ""
    let mediaData: { extension?: string; [key: string]: any } = {}

    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "") && !$activeShow?.id.includes("http") && !$activeShow?.id.includes("data:")) {
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
        { label: "info.created", value: mediaData.birthtime, type: "date" },
        { label: "info.modified", value: mediaData.mtime, type: "date" },
        { label: "info.changed", value: mediaData.ctime, type: "date" },
        ...(codecInfo.codecs ? [{ label: "info.codecs", value: codecInfo.codecs?.join(", ") }] : [])
        // ...(codecInfo.mimeType ? [{ label: "info.mimeType", value: codecInfo.mimeType }] : [])
    ]
</script>

{#if subTab === "screens" || $activeRecording}
    <LiveInfo />
{:else if subTab === "online"}
    <PlayerInfo />
{:else}
    <div class="scroll">
        <InfoMetadata title={name} {info} />
    </div>
{/if}

<style>
    .scroll {
        flex: 1;
    }
</style>

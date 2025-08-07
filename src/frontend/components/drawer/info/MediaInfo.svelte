<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeRecording, activeShow, drawerTabsData } from "../../../stores"
    import { videoExtensions } from "../../../values/extensions"
    import { formatBytes } from "../../helpers/bytes"
    import { getExtension, getFileName, getMediaInfo, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Date from "../../system/Date.svelte"
    import LiveInfo from "../live/LiveInfo.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"

    $: name = $activeShow?.name || ""
    let info: { extension?: string; [key: string]: any } = {}

    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "") && !$activeShow?.id.includes("http") && !$activeShow?.id.includes("data:")) {
        info = {}
        codecInfo = {}

        requestMain(Main.FILE_INFO, $activeShow?.id, (data) => {
            if (!data) return
            info = { ...data.stat, extension: data.extension }
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
</script>

{#if subTab === "screens" || $activeRecording}
    <LiveInfo />
{:else if subTab === "online"}
    <PlayerInfo />
{:else}
    <main style="overflow-y: auto;">
        <h2 style="text-align: center;padding: 10px;" data-title={name}>
            {#if name.length}
                {name}
            {:else}
                <span style="opacity: 0.5">
                    <T id={"main.unnamed"} />
                </span>
            {/if}
        </h2>
        <p>
            <span class="title"><T id={"info.extension"} /></span>
            <span style="text-transform: uppercase;">{info.extension || "-"}</span>
        </p>
        <p>
            <span class="title"><T id={"info.size"} /></span>
            <span>{formatBytes(info.size || 0)}</span>
        </p>
        <p>
            <span class="title"><T id={"info.created"} /></span>
            {#if info.birthtime}
                <span><Date d={info.birthtime} /></span>
            {:else}
                <span>-</span>
            {/if}
        </p>
        <p>
            <span class="title"><T id={"info.modified"} /></span>
            {#if info.mtime}
                <span><Date d={info.mtime} /></span>
            {:else}
                <span>-</span>
            {/if}
        </p>
        <p>
            <span class="title"><T id={"info.changed"} /></span>
            {#if info.ctime}
                <!-- format="d,m,y" -->
                <span><Date d={info.ctime} /></span>
            {:else}
                <span>-</span>
            {/if}
        </p>
        {#if codecInfo.codecs}
            <p>
                <span class="title"><T id="info.codecs" /></span>
                <span>{codecInfo.codecs?.join(", ") || "—"}</span>
            </p>
        {/if}
        <!-- {#if codecInfo.mimeType}
            <p>
                <span class="title"><T id="info.mimeType" /></span>
                <span>{codecInfo.mimeType || "—"}</span>
            </p>
        {/if} -->
    </main>
{/if}

<style>
    main {
        overflow-y: auto;
    }

    main p {
        display: flex;
        justify-content: space-between;
        padding: 2px 10px;
        gap: 5px;
    }
    main p:nth-child(even) {
        background-color: rgb(0 0 20 / 0.15);
    }

    .title {
        font-weight: 600;
    }
    main p span:not(.title) {
        opacity: 0.8;

        overflow: hidden;
        /* direction: rtl; */
    }
</style>

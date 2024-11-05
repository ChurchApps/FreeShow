<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { FILE_INFO, MAIN } from "../../../../types/Channels"
    import { activeRecording, activeShow, drawerTabsData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { formatBytes } from "../../helpers/bytes"
    import { getExtension, getFileName, getMediaInfo, removeExtension, videoExtensions } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Date from "../../system/Date.svelte"
    import LiveInfo from "../live/LiveInfo.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"

    $: name = $activeShow?.name || ""
    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "") && !$activeShow?.id.includes("http") && !$activeShow?.id.includes("data:")) {
        info = {}
        codecInfo = {}
        send(MAIN, ["FILE_INFO"], $activeShow?.id)
        getCodecInfo()
    }

    let codecInfo: any = {}
    async function getCodecInfo() {
        if (!videoExtensions.includes(getExtension($activeShow?.id || ""))) return
        codecInfo = await getMediaInfo($activeShow?.id || "")
    }

    let listenerId = uid()
    onDestroy(() => window.api.removeListener(FILE_INFO, listenerId))

    let info: any = {}
    window.api.receive(FILE_INFO, receiveContent, listenerId)
    function receiveContent(data: any) {
        info = { ...data.stat, extension: data.extension }
        if (!name) name = removeExtension(getFileName(data.path))
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
        <h2 style="text-align: center;padding: 0 5px;" title={name}>
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
        {#if codecInfo.codecs || codecInfo.mimeType}
            <p>
                <span class="title"><T id="info.codecs" /></span>
                <span>{codecInfo.codecs?.join(", ") || "—"}</span>
            </p>
            <p>
                <span class="title"><T id="info.mimeType" /></span>
                <span>{codecInfo.mimeType || "—"}</span>
            </p>
        {/if}
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
        background-color: var(--primary-darker);
    }

    .title {
        font-weight: 600;
    }
    main p span:not(.title) {
        opacity: 0.8;
    }
</style>

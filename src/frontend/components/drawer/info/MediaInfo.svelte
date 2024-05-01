<script lang="ts">
    import { uid } from "uid"
    import { FILE_INFO } from "../../../../types/Channels"
    import { activeShow, drawerTabsData } from "../../../stores"
    import { formatBytes } from "../../helpers/bytes"
    import { getFileName, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Date from "../../system/Date.svelte"
    import LiveInfo from "../live/LiveInfo.svelte"
    import PlayerInfo from "./PlayerInfo.svelte"
    import { onDestroy } from "svelte"

    $: name = $activeShow?.name || ""
    $: if ($activeShow?.id && ["media", "image", "video"].includes($activeShow.type || "")) {
        info = {}
        window.api.send(FILE_INFO, $activeShow?.id)
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

{#if subTab === "online"}
    <PlayerInfo />
{:else if subTab === "screens"}
    <LiveInfo />
{:else}
    <main style="overflow-y: auto;">
        <h2 style="text-align: center" title={name}>
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
    }
    main p:nth-child(odd) {
        background-color: var(--primary-darker);
    }

    .title {
        font-weight: 600;
    }
    main p span:not(.title) {
        opacity: 0.8;
    }
</style>

<script lang="ts">
    import { FILE_INFO } from "../../../../types/Channels"
    import { activeShow } from "../../../stores"
    import { formatBytes } from "../../helpers/bytes"
    import { getFileName, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Date from "../../system/Date.svelte"

    $: name = $activeShow!.name || ""
    $: if ($activeShow?.id) {
        info = {}
        window.api.send(FILE_INFO, $activeShow?.id)
    }

    let info: any = {}
    window.api.receive(FILE_INFO, (data: any) => {
        info = { ...data.stat, extension: data.extension }
        if (!name) name = removeExtension(getFileName(data.path))
    })

    // $: accessed = info.atime
</script>

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
            <Date d={info.birthtime} />
        {:else}
            <span>-</span>
        {/if}
    </p>
    <p>
        <span class="title"><T id={"info.modified"} /></span>
        {#if info.mtime}
            <Date d={info.mtime} />
        {:else}
            <span>-</span>
        {/if}
    </p>
    <p>
        <span class="title"><T id={"info.changed"} /></span>
        {#if info.ctime}
            <!-- format="d,m,y" -->
            <Date d={info.ctime} />
        {:else}
            <span>-</span>
        {/if}
    </p>
</main>

<style>
    main {
        overflow-y: auto;
        padding: 10px;
    }

    p {
        display: flex;
        justify-content: space-between;
    }

    .title {
        opacity: 0.8;
    }
</style>

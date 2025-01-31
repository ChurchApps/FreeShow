<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { MAIN, READ_FOLDER } from "../../../../types/Channels"
    import { destroy, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getThumbnailPath, isMediaExtension, mediaSize } from "../../helpers/media"
    import Card from "../Card.svelte"

    export let rootPath: string
    export let name: string
    export let path: string
    export let mode: "grid" | "list"
    export let folderPreview: boolean = false

    let files: any[] = []
    let fileCount: number = 0

    let listenerId = uid()
    // WIP this creates one listener per individual folder...
    $: if (folderPreview && mode === "grid" && path) send(MAIN, ["READ_FOLDER"], { path, disableThumbnails: true })
    onDestroy(() => destroy(READ_FOLDER, listenerId))

    window.api.receive(READ_FOLDER, receiveContent, listenerId)
    function receiveContent(msg) {
        if (msg.path !== path) return

        fileCount = 0
        let filtered = msg.files.filter((file: any) => isMediaExtension(file.extension))
        fileCount = filtered.length
        files = filtered.slice(0, 4).map((a) => {
            a.path = getThumbnailPath(a.path, mediaSize.drawerSize)
            return a
        })
    }

    const removeBrokenImg = (e: any) => (e.target.style.display = "none")

    $: folderLabel = name + (fileCount ? ` (${fileCount})` : "")
</script>

<Card resolution={{ width: 16, height: 9 }} on:click={() => (rootPath = path)} width={100} title={folderLabel} label={folderLabel} icon={mode === "grid" ? "folder" : null} color={mode === "grid" ? "var(--secondary);" : ""} {mode}>
    <div class="flex" style="width: 100%;height: 100%;">
        <div class="grid">
            {#key path}
                {#if folderPreview && mode === "grid" && fileCount}
                    <div class="images">
                        {#each files as file}
                            <img loading="lazy" src={file.path} alt={file.name} on:error={removeBrokenImg} />
                        {/each}
                    </div>
                {/if}

                <Icon size={mode === "list" ? 2 : 3} id="folder" white={mode === "list"} />
            {/key}
        </div>
    </div>
</Card>

<style>
    .grid {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        /* overflow: hidden; */
        height: 100%;
    }
    .grid :global(.observer) {
        width: 50%;
    }
    .grid :global(svg) {
        height: 100%;
        z-index: 1;
    }

    .images {
        position: absolute;
        width: 100%;
        height: 100%;

        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 3px;

        filter: saturate(0.4) opacity(0.5);
    }
    .images img {
        width: calc(50% - 3px);
        max-height: 38px;
        object-fit: contain;

        /* hide alt text */
        color: transparent;
    }
</style>

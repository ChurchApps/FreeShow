<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Icon from "../../helpers/Icon.svelte"
    import Card from "../Card.svelte"

    export let name: string
    export let path: string
    export let mode: "grid" | "list"
    export let previewPaths: string[] = []
    export let folderFilesCount: number = 0

    const dispatch = createEventDispatcher()
    function openFolder() {
        dispatch("open", path)
    }

    const removeBrokenImg = (e: any) => (e.target.style.display = "none")
</script>

<Card resolution={{ width: 16, height: 9 }} on:click={openFolder} width={100} title={name} label={name} count={folderFilesCount} icon={mode === "grid" ? "folder" : null} color={mode === "grid" ? "var(--secondary);" : ""} {mode}>
    <div class="flex" style="width: 100%;height: 100%;">
        <div class="grid">
            {#key path}
                {#if mode === "grid" && previewPaths.length}
                    <div class="images">
                        {#each previewPaths.slice(0, 4) as path}
                            <img loading="lazy" src={path} on:error={removeBrokenImg} />
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
        /* width: 100%;
        height: 100%; */
        width: 70%;
        height: 70%;

        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 3px;

        filter: saturate(0.4) opacity(0.5);
    }
    .images img {
        width: calc(50% - 3px);
        max-height: 35px;

        object-fit: cover;
        border-radius: 3px;

        /* hide alt text */
        color: transparent;
    }
</style>

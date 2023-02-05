<script lang="ts">
    import Icon from "../../helpers/Icon.svelte"
    import Card from "../Card.svelte"
    import Image from "./Image.svelte"
    import IntersectionObserver from "./IntersectionObserver.svelte"

    export let rootPath: string
    export let name: string
    export let path: string
    export let mode: "grid" | "list"

    // $: if (slowLoader === index) slowLoader += 5

    let files: any[] = []
    let items: number = 0

    // TODO: folder preview
    // let videoExtensions: string[] = ["mp4", "mov"]
    // let imageExtensions: string[] = ["png", "jpg", "jpeg"]
    // let extensions: string[] = [...videoExtensions, ...imageExtensions]
    // $: if (path.length) window.api.send(READ_FOLDER, path)
    // window.api.receive(READ_FOLDER, (msg: any) => {
    //   if (msg.path === path) {
    //     let filtered = msg.files.filter((file: any) => extensions.includes(file.extension) || file.folder)
    //     items = filtered.length
    //     files = msg.files.filter((file: any) => imageExtensions.includes(file.extension)).slice(0, 4)
    //   }
    // })
</script>

<Card on:click={() => (rootPath = path)} label="{name}{items ? { items } : ''}" icon={mode === "grid" ? "folder" : null} color={mode === "grid" ? "var(--secondary);" : ""} {mode}>
    <div class="flex" style="width: 100%;height: 100%;">
        <div class="grid">
            {#key path}
                {#if files.length}
                    {#each files as file}
                        <!-- <img loading="lazy" src={file.path} alt={file.name} /> -->
                        <IntersectionObserver class="observer" once let:intersecting>
                            {#if intersecting}
                                <Image src={file.path} alt={file.name} />
                            {/if}
                        </IntersectionObserver>
                    {/each}
                    <!-- {:else if items > 0}
        <Icon size={5} id="movie" /> -->
                {:else}
                    <Icon size={5} id="folder" />
                {/if}
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
    .grid :global(img) {
        object-fit: contain;
    }
    .grid :global(svg) {
        height: 100%;
    }
</style>

<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import type { ContentLibraryCategory, ContentFile } from "../../../../electron/contentProviders/base/types"
    import Icon from "../../helpers/Icon.svelte"
    import Center from "../../system/Center.svelte"
    import MediaGrid from "./MediaGrid.svelte"
    import Media from "./MediaCard.svelte"
    import { getMediaType, removeExtension } from "../../helpers/media"
    import { mediaOptions } from "../../../stores"

    export let provider: string
    export let columns: number = 5

    let library: ContentLibraryCategory[] = []
    let currentPath: ContentLibraryCategory[] = []
    let currentCategory: ContentLibraryCategory | null = null
    let content: ContentFile[] = []
    let loading = false
    let error: string | null = null

    onMount(() => {
        loadLibrary()
    })

    async function loadLibrary() {
        loading = true
        error = null
        try {
            requestMain(Main.GET_CONTENT_LIBRARY, { provider }, (data) => {
                library = data
                loading = false
            })
        } catch (e) {
            error = `Failed to load library: ${e}`
            loading = false
        }
    }

    function navigateToCategory(category: ContentLibraryCategory) {
        if (category.key) {
            // This is a leaf node with content
            loadContent(category.key)
        } else if (category.children) {
            // Navigate into this category
            currentPath = [...currentPath, currentCategory!].filter(Boolean)
            currentCategory = category
        }
    }

    function navigateBack() {
        if (currentPath.length === 0) {
            currentCategory = null
            content = []
        } else {
            currentCategory = currentPath[currentPath.length - 1]
            currentPath = currentPath.slice(0, -1)
        }
        content = []
    }

    async function loadContent(key: string) {
        loading = true
        error = null
        try {
            requestMain(Main.GET_PROVIDER_CONTENT, { provider, key }, (data) => {
                content = data
                loading = false
            })
        } catch (e) {
            error = `Failed to load content: ${e}`
            loading = false
        }
    }

    function goToRoot() {
        currentPath = []
        currentCategory = null
        content = []
    }

    $: categories = currentCategory?.children || library
    $: showBackButton = currentPath.length > 0 || currentCategory !== null
</script>

<div class="content-library">
    {#if showBackButton}
        <div class="navigation-bar">
            <button class="back-button" on:click={navigateBack}>
                <Icon id="back" size={1.2} white />
                Back
            </button>
            {#if currentPath.length > 0}
                <button class="home-button" on:click={goToRoot}>
                    <Icon id="all" size={1.2} white />
                </button>
            {/if}
            {#if currentCategory}
                <span class="breadcrumb">{currentCategory.name}</span>
            {/if}
        </div>
    {/if}

    {#if loading}
        <Center>
            <p style="opacity: 0.5;">Loading...</p>
        </Center>
    {:else if error}
        <Center>
            <p style="color: var(--error); opacity: 0.8;">{error}</p>
        </Center>
    {:else if content.length > 0}
        <div class="grid" class:list={$mediaOptions.mode === "list"}>
            <div class="context #media" style="display: contents;">
                <MediaGrid items={content} {columns} let:item>
                    <Media
                        credits={{}}
                        name={item.name || ""}
                        path={item.url}
                        thumbnailPath={item.thumbnail || ""}
                        type={item.type}
                        shiftRange={[]}
                        allFiles={[]}
                        active="online"
                    />
                </MediaGrid>
            </div>
        </div>
    {:else if categories.length > 0}
        <div class="categories">
            {#each categories as category}
                <button class="category-card" on:click={() => navigateToCategory(category)}>
                    {#if category.thumbnail}
                        <img src={category.thumbnail} alt={category.name} />
                    {:else}
                        <div class="placeholder">
                            <Icon id="folder" size={3} white />
                        </div>
                    {/if}
                    <span class="category-name">{category.name}</span>
                </button>
            {/each}
        </div>
    {:else}
        <Center style="opacity: 0.2;">
            <Icon id="noImage" size={5} white />
        </Center>
    {/if}
</div>

<style>
    .content-library {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
    }

    .navigation-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background-color: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .back-button,
    .home-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background-color: var(--primary);
        color: var(--text);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .back-button:hover,
    .home-button:hover {
        background-color: var(--primary-lighter);
    }

    .home-button {
        padding: 6px 8px;
    }

    .breadcrumb {
        opacity: 0.7;
        font-size: 0.9em;
    }

    .categories {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 200px));
        grid-auto-rows: min-content;
        gap: 12px;
        padding: 12px;
        overflow-y: auto;
        flex: 1;
        align-content: start;
    }

    .category-card {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0;
        background-color: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        overflow: hidden;
    }

    .category-card:hover {
        background-color: var(--primary-lighter);
        transform: translateY(-2px);
    }

    .category-card img {
        width: 100%;
        height: 150px;
        object-fit: cover;
    }

    .placeholder {
        width: 100%;
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--primary-darker);
        opacity: 0.5;
    }

    .category-name {
        text-align: center;
        font-size: 0.9em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px;
        color: var(--text);
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        place-content: flex-start;
        padding: 5px;
        overflow-y: auto;
    }

    .grid.list {
        display: block;
    }
</style>

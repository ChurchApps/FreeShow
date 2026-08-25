<script lang="ts">
    import { onMount } from "svelte"
    import type { ContentFile, ContentLibraryCategory, ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { mediaOptions, openedMediaFolders } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import Media from "./MediaCard.svelte"

    export let providerId: ContentProviderId
    export let columns: number = 5
    export let searchValue: string = ""
    export let currentCategory: ContentLibraryCategory | null = null
    export let getContentCategory: (item: ContentFileWithExtras) => ContentLibraryCategory | null = () => null

    let library: ContentLibraryCategory[] = []
    let currentPath: ContentLibraryCategory[] = []
    type ContentFileWithExtras = ContentFile & { [key: string]: any }
    let content: ContentFileWithExtras[] = []
    let loading = false
    let error: string | null = null
    let viewingContent = false

    onMount(() => {
        const saved = $openedMediaFolders[providerId]
        if (saved?.currentCategory) {
            currentPath = saved.currentPath || []
            currentCategory = saved.currentCategory
            viewingContent = saved.viewingContent ?? !!saved.currentCategory.key
            content = saved.content || []
            if (!content.length && currentCategory?.key) loadContent(currentCategory.key)
        }

        loadLibrary()
    })

    let prevProviderId = providerId
    $: if (providerId !== prevProviderId) {
        prevProviderId = providerId
        const saved = $openedMediaFolders[providerId]
        if (saved?.currentCategory) {
            currentPath = saved.currentPath || []
            currentCategory = saved.currentCategory
            viewingContent = saved.viewingContent ?? !!saved.currentCategory.key
            content = saved.content || []
            if (!content.length && currentCategory?.key) loadContent(currentCategory.key)
        } else {
            currentPath = []
            currentCategory = null
            content = []
            viewingContent = false
        }
        library = []
        loadLibrary()
    }

    function save() {
        openedMediaFolders.update((a) => {
            if (currentCategory) a[providerId] = { currentPath, currentCategory, viewingContent, content }
            else delete a[providerId]
            return a
        })
    }

    async function loadLibrary() {
        if (library.length) return

        loading = !viewingContent && !currentCategory?.children?.length
        error = null

        try {
            requestMain(Main.GET_CONTENT_LIBRARY, { providerId }, (data) => {
                if (!data) return
                library = data
                loading = false
            })
        } catch (e) {
            error = `Failed to load library: ${e}`
            loading = false
        }
    }

    function navigateToCategory(category: ContentLibraryCategory) {
        currentPath = [...currentPath, currentCategory!].filter(Boolean)
        currentCategory = category
        content = []
        viewingContent = !!category.key

        save()
        if (category.key) loadContent(category.key)
    }

    function navigateBack() {
        if (currentPath.length === 0) {
            currentCategory = null
            content = []
            viewingContent = false
        } else {
            currentCategory = currentPath[currentPath.length - 1]
            currentPath = currentPath.slice(0, -1)
            content = []
            viewingContent = !!currentCategory?.key
            if (currentCategory?.key) loadContent(currentCategory.key)
        }

        save()
    }

    async function loadContent(key: string) {
        loading = true
        error = null
        try {
            requestMain(
                Main.GET_PROVIDER_CONTENT,
                { providerId, key },
                (data) => {
                    if (!data) {
                        error = "Failed to load content."
                        loading = false
                        return
                    }

                    content = data
                    loading = false
                    save()
                },
                60000
            )
        } catch (e) {
            error = `Failed to load content: ${e}`
            loading = false
        }
    }

    $: categories = viewingContent ? [] : currentCategory?.children || library
    $: showBackButton = currentPath.length > 0 || currentCategory !== null

    $: listMode = $mediaOptions.mode === "list"
    // inline widths would override the stylesheet, so the list width has to be set here as well
    $: cardWidth = listMode ? "100%" : `calc(${100 / columns}% - 4px)`

    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    $: filteredCategories = searchValue.length > 1 ? categories.filter((cat) => filter(cat.name).includes(filter(searchValue))) : categories
    $: filteredContent = searchValue.length > 1 ? content.filter((item) => filter(item.name || "").includes(filter(searchValue))) : content
</script>

<div class="content-library">
    {#if showBackButton}
        <FloatingInputs side="left">
            <MaterialButton title="actions.back" on:click={navigateBack}>
                <Icon id="back" white />
            </MaterialButton>

            <div class="divider"></div>

            <p style="opacity: 0.8;display: flex;align-items: center;padding: 0 15px;">
                <span style="opacity: 0.3;font-size: 0.9em;max-width: 500px;overflow: hidden;direction: rtl;">{currentPath.length ? "/" : ""}{currentPath.map((a) => a.name)?.join("/")}</span>
                {currentCategory?.name || ""}
            </p>
        </FloatingInputs>
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
        <div class="grid" style="padding: 5px;" class:list={listMode}>
            <!-- <div class="context #media" style="display: contents;">
                <MediaGrid items={filteredContent} {columns} let:item>
                    <Media credits={{}} name={item.name || ""} path={item.url} thumbnailPath={item.thumbnail || ""} type={item.type} shiftRange={[]} active="online" contentProvider={providerId} contentFileData={item} />
                </MediaGrid>
            </div> -->
            {#each filteredContent as item}
                {@const category = getContentCategory(item)}
                {#if category}
                    <button class="category-card" style="width: {cardWidth};" on:click={() => navigateToCategory(category)}>
                        {#if item.thumbnail}
                            <img src={item.thumbnail} alt={item.name} />
                        {:else}
                            <div class="placeholder">
                                <Icon id="folder" size={3} white />
                            </div>
                        {/if}
                        <span class="category-name">
                            {item.name}
                            {#if item.slideCount}
                                <span style="margin-left: 10px;opacity: 0.5;font-size: 0.9em;">{item.slideCount}</span>
                            {/if}
                        </span>
                    </button>
                {:else}
                    <div class="card" style="width: {listMode ? 100 : 100 / columns}%;">
                        <Media credits={{}} name={item.name || ""} path={item.url} thumbnailPath={item.thumbnail || ""} type={item.type} shiftRange={[]} active="online" contentProvider={providerId} contentFileData={item} />
                    </div>
                {/if}
            {/each}
        </div>
    {:else if categories.length > 0}
        <div class="categories" class:list={listMode}>
            {#each filteredCategories as category}
                <button class="category-card" style="width: {cardWidth};" on:click={() => navigateToCategory(category)}>
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
    .categories {
        /* display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 200px));
        grid-auto-rows: min-content; */

        display: flex;
        flex-wrap: wrap;

        gap: 5px;
        padding: 5px;

        overflow-y: auto;
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
        overflow-y: auto;
    }

    .grid.list {
        display: block;
    }

    /* list mode: stack cards as compact rows instead of a wrapped grid */
    .categories.list {
        display: block;
    }

    .categories.list .category-card,
    .grid.list .category-card {
        flex-direction: row;
        align-items: center;
        margin-bottom: 4px;
    }

    .categories.list .category-card img,
    .grid.list .category-card img,
    .categories.list .placeholder,
    .grid.list .placeholder {
        width: 80px;
        height: 45px;
        flex-shrink: 0;
    }

    .categories.list .category-name,
    .grid.list .category-name {
        flex: 1;
        justify-content: flex-start;
        text-align: start;
    }

    .categories.list .category-card:hover,
    .grid.list .category-card:hover {
        transform: none;
    }
</style>

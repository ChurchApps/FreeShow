<script lang="ts">
    import { translate, sortByName, type CategoryData } from "../../../../util/helpers"
    import { dictionary } from "../../../../util/stores"
    import MaterialButton from "../../../MaterialButton.svelte"
    import Icon from "../../../../../common/components/Icon.svelte"

    export let categoryData: CategoryData
    export let activeItem: string = "all"
    export let onSelect: (id: string) => void
    export let showAllLabel: string = "category.all"
    export let showUnlabeledLabel: string = "category.unlabeled"
    export let showCategoriesLabel: string = "guide_title.categories"
    export let showArchivedLabel: string = "actions.archive_title"
</script>

<div class="tabSection">
    <!-- All & Unlabeled Section -->
    <div class="section">
        <MaterialButton
            class="tab {activeItem === 'all' ? 'active' : ''}"
            on:click={() => onSelect("all")}
            style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
            isActive={activeItem === "all"}
            tab
        >
            <div style="max-width: 85%;" data-title={translate(showAllLabel, $dictionary)}>
                <Icon id="all" size={1} white={activeItem === "all"} />
                <p style="margin: 5px;">{translate(showAllLabel, $dictionary)}</p>
            </div>
            <span class="count">{categoryData.unarchivedItems.length}</span>
        </MaterialButton>

        {#if categoryData.uncategorizedCount}
            <MaterialButton
                class="tab {activeItem === 'unlabeled' ? 'active' : ''}"
                on:click={() => onSelect("unlabeled")}
                style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                isActive={activeItem === "unlabeled"}
                tab
            >
                <div style="max-width: 85%;" data-title={translate(showUnlabeledLabel, $dictionary)}>
                    <Icon id="noIcon" size={1} white={activeItem === "unlabeled"} />
                    <p style="margin: 5px;">{translate(showUnlabeledLabel, $dictionary)}</p>
                </div>
                <span class="count">{categoryData.uncategorizedCount}</span>
            </MaterialButton>
        {/if}
    </div>

    <!-- Categories Section -->
    {#if categoryData.unarchivedCategories.length}
        <div class="section">
            <div class="title">{translate(showCategoriesLabel, $dictionary)}</div>
            {#each sortByName(categoryData.unarchivedCategories, "name") as cat}
                {@const count = categoryData.allItems.filter((s) => s.category === cat.id).length}
                <MaterialButton
                    class="tab {activeItem === cat.id ? 'active' : ''}"
                    on:click={() => onSelect(cat.id)}
                    style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                    isActive={activeItem === cat.id}
                    tab
                >
                    <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                        <Icon id={cat.icon || "folder"} size={1} white={activeItem === cat.id} />
                        <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                    </div>
                    <span class="count">{count}</span>
                </MaterialButton>
            {/each}
        </div>
    {/if}

    <!-- Archived Categories Section -->
    {#if categoryData.archivedCategories.length}
        <div class="section">
            <div class="separator">
                <div class="sepLabel">{translate(showArchivedLabel, $dictionary)}</div>
                <hr />
            </div>
            {#each sortByName(categoryData.archivedCategories, "name") as cat}
                {@const count = categoryData.allItems.filter((s) => s.category === cat.id).length}
                <MaterialButton
                    class="tab {activeItem === cat.id ? 'active' : ''}"
                    on:click={() => onSelect(cat.id)}
                    style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                    isActive={activeItem === cat.id}
                    tab
                >
                    <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                        <Icon id={cat.icon || "folder"} size={1} white={activeItem === cat.id} />
                        <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                    </div>
                    <span class="count">{count}</span>
                </MaterialButton>
            {/each}
        </div>
    {/if}
</div>

<style>
    .tabSection {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 8px 0;
    }

    .section {
        position: relative;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        margin: 0 5px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        overflow: hidden;

        /* align to left */
        margin-left: 0;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left-width: 0;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .separator {
        display: flex;
        align-items: center;
    }

    .sepLabel {
        font-size: 0.6rem;
        color: var(--text);
        opacity: 0.5;
        padding: 6px 14px;
        line-height: 1;
    }

    hr {
        height: 1px;
        border: none;
        background-color: var(--primary-lighter);
        flex: 1;
        opacity: 0.8;
    }

    .section :global(.tab) {
        justify-content: space-between !important;
    }

    .section :global(.tab div) {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
    }

    .section :global(.tab div p) {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .count {
        opacity: 0.5;
        font-size: 0.8em;
        min-width: 28px;
        text-align: end;
        flex-shrink: 0;
    }
</style>

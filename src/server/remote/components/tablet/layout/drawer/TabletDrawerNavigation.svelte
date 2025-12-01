<script lang="ts">
    import { categories, shows, activeCategory, dictionary, scriptures, openedScripture, collectionId, actions, actionTags, variables, variableTags, activeActionTagFilter, activeVariableTagFilter, functionsSubTab, timers, triggers, overlays, overlayCategories, activeOverlayCategory, templates, templateCategories, activeTemplateCategory } from "../../../../util/stores"
    import { translate, keysToID, sortByName } from "../../../../util/helpers"
    import { _set } from "../../../../util/stores"
    import Button from "../../../../../common/components/Button.svelte"
    import Icon from "../../../../../common/components/Icon.svelte"
    import MaterialButton from "../../../MaterialButton.svelte"

    export let id: string

    // Generic category list builder - reduces duplication between shows/overlays
    type CategoryData = {
        categoriesList: any[]
        unarchivedCategories: any[]
        archivedCategories: any[]
        allItems: any[]
        unarchivedItems: any[]
        uncategorizedCount: number
    }

    const EMPTY_CATEGORY_DATA: CategoryData = {
        categoriesList: [],
        unarchivedCategories: [],
        archivedCategories: [],
        allItems: [],
        unarchivedItems: [],
        uncategorizedCount: 0
    }

    function buildCategoryData(items: any[], categoriesObj: Record<string, any>): CategoryData {
        const categoriesList = keysToID(categoriesObj)
        const unarchivedCategories = categoriesList.filter(a => !a.isArchive)
        const archivedCategories = categoriesList.filter(a => a.isArchive)
        const allItems = items.filter(a => a && !a.private)
        const unarchivedItems = allItems.filter(a => a.category === null || !categoriesObj[a.category]?.isArchive)
        const uncategorizedCount = unarchivedItems.filter(a => a.category === null || !categoriesObj[a.category]).length
        return { categoriesList, unarchivedCategories, archivedCategories, allItems, unarchivedItems, uncategorizedCount }
    }

    // LAZY COMPUTATION - Only compute data for active tab to prevent freeze on tab switch
    // Shows tab logic - only computed when shows tab is active
    $: showsData = id === "shows" ? buildCategoryData($shows || [], $categories) : EMPTY_CATEGORY_DATA
    $: active = $activeCategory || "all"

    // Overlays tab logic - only computed when overlays tab is active
    $: overlaysData = id === "overlays" ? buildCategoryData(Object.values($overlays || {}), $overlayCategories) : EMPTY_CATEGORY_DATA
    $: activeOverlay = $activeOverlayCategory || "all"

    function setOverlayCategory(catId: string) {
        activeOverlayCategory.set(catId)
    }

    // Templates tab logic - only computed when templates tab is active
    $: templatesData = id === "templates" ? buildCategoryData(Object.values($templates || {}), $templateCategories) : EMPTY_CATEGORY_DATA
    $: activeTemplate = $activeTemplateCategory || "all"

    function setTemplateCategory(catId: string) {
        activeTemplateCategory.set(catId)
    }

    // Scripture tab logic - only computed when scripture tab is active
    $: scriptureEntries = id === "scripture" ? keysToID($scriptures).map((a: any) => ({ ...a, icon: a.api ? "scripture_alt" : a.collection ? "collection" : "scripture" })) : []
    $: favoritesList = id === "scripture" ? sortByName(
        scriptureEntries.filter(a => a.favorite),
        "name"
    ) : []
    $: favoriteIds = new Set(favoritesList.map(a => a.id))
    $: collectionList = id === "scripture" ? sortByName(
        scriptureEntries.filter(a => a.collection && !favoriteIds.has(a.id)),
        "name"
    ) : []
    $: localBibles = id === "scripture" ? sortByName(
        scriptureEntries.filter(a => !a.collection && !a.api && !favoriteIds.has(a.id)),
        "name"
    ) : []
    $: apiBibles = id === "scripture" ? sortByName(
        scriptureEntries.filter(a => !a.collection && a.api && !favoriteIds.has(a.id)),
        "name"
    ) : []

    $: scriptureSections = id === "scripture" ? [
        { id: "favorites", label: "category.favourites", items: favoritesList },
        { id: "collections", label: "scripture.collections", items: collectionList },
        { id: "local", label: "scripture.bibles_section", items: [...localBibles, ...apiBibles] }
    ].filter(s => s.items.length > 0) : []

    function setCategory(catId: string) {
        _set("activeCategory", catId)
    }

    // Functions tab logic - only computed when functions tab is active
    $: actionsTagsOnly = id === "functions" ? Object.values($actions).map(a => a.tags || []) : []
    $: variablesTagsOnly = id === "functions" ? Object.values($variables).map(a => a.tags || []) : []
    $: timersCount = id === "functions" ? Object.keys($timers).length : 0
    $: triggersCount = id === "functions" ? Object.keys($triggers).length : 0

    $: sortedActionTags = id === "functions" ? sortByName(keysToID($actionTags), "name")
        .sort((a, b) => String(a.color || "").localeCompare(String(b.color || "")))
        .map(a => ({
            ...a,
            label: a.name,
            icon: "tag",
            count: actionsTagsOnly.filter(b => b.includes(a.id)).length
        })) : []

    $: sortedVariableTags = id === "functions" ? sortByName(keysToID($variableTags), "name")
        .sort((a, b) => String(a.color || "").localeCompare(String(b.color || "")))
        .map(a => ({
            ...a,
            label: a.name,
            icon: "tag",
            count: variablesTagsOnly.filter(b => b.includes(a.id)).length
        })) : []

    function setFunctionsSubTab(tab: string) {
        functionsSubTab.set(tab)
        // Clear tag filters when switching to a non-action/variable tab
        if (tab !== "actions") activeActionTagFilter.set([])
        if (tab !== "variables") activeVariableTagFilter.set([])
    }
</script>

<div class="main">
    {#if id === "shows"}
        <div class="tabSection">
            <!-- All & Unlabeled Section -->
            <div class="section">
                <MaterialButton class="tab {active === 'all' ? 'active' : ''}" on:click={() => setCategory("all")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={active === "all"} tab>
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="all" size={1} white={active === "all"} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{showsData.unarchivedItems.length}</span>
                </MaterialButton>

                {#if showsData.uncategorizedCount}
                    <MaterialButton class="tab {active === 'unlabeled' ? 'active' : ''}" on:click={() => setCategory("unlabeled")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={active === "unlabeled"} tab>
                        <div style="max-width: 85%;" data-title={translate("category.unlabeled", $dictionary)}>
                            <Icon id="noIcon" size={1} white={active === "unlabeled"} />
                            <p style="margin: 5px;">{translate("category.unlabeled", $dictionary)}</p>
                        </div>
                        <span class="count">{showsData.uncategorizedCount}</span>
                    </MaterialButton>
                {/if}
            </div>

            <!-- Categories Section -->
            {#if showsData.unarchivedCategories.length}
                <div class="section">
                    <div class="title">{translate("guide_title.categories", $dictionary)}</div>
                    {#each sortByName(showsData.unarchivedCategories, "name") as cat}
                        {@const count = showsData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {active === cat.id ? 'active' : ''}" on:click={() => setCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={active === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={active === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            <!-- Archived Categories Section -->
            {#if showsData.archivedCategories.length}
                <div class="section">
                    <div class="separator">
                        <div class="sepLabel">{translate("actions.archive_title", $dictionary)}</div>
                        <hr />
                    </div>
                    {#each sortByName(showsData.archivedCategories, "name") as cat}
                        {@const count = showsData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {active === cat.id ? 'active' : ''}" on:click={() => setCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={active === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={active === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if id === "functions"}
        <div class="tabSection">
            <!-- Actions Section -->
            <div class="section">
                <div class="title">{translate("tabs.actions", $dictionary)}</div>
                <MaterialButton
                    class="tab {$functionsSubTab === 'actions' && $activeActionTagFilter.length === 0 ? 'active' : ''}"
                    on:click={() => {
                        setFunctionsSubTab("actions")
                        activeActionTagFilter.set([])
                    }}
                    style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                    isActive={$functionsSubTab === "actions" && $activeActionTagFilter.length === 0}
                    tab
                >
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="actions" size={1} white={$functionsSubTab === "actions" && $activeActionTagFilter.length === 0} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{Object.keys($actions).length}</span>
                </MaterialButton>

                {#each sortedActionTags as tag}
                    <MaterialButton
                        class="tab {$functionsSubTab === 'actions' && $activeActionTagFilter.includes(tag.id) ? 'active' : ''}"
                        on:click={() => {
                            setFunctionsSubTab("actions")
                            activeActionTagFilter.set([tag.id])
                        }}
                        style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                        isActive={$functionsSubTab === "actions" && $activeActionTagFilter.includes(tag.id)}
                        tab
                    >
                        <div style="max-width: 85%;" data-title={tag.label}>
                            <Icon id="tag" size={1} style={!($functionsSubTab === "actions" && $activeActionTagFilter.includes(tag.id)) && tag.color ? `fill: ${tag.color}` : ""} white={$functionsSubTab === "actions" && $activeActionTagFilter.includes(tag.id)} />
                            <p style="margin: 5px;">{tag.label}</p>
                        </div>
                        <span class="count">{tag.count}</span>
                    </MaterialButton>
                {/each}
            </div>

            <!-- Timers Section -->
            <div class="section">
                <div class="title">{translate("tabs.timers", $dictionary)}</div>
                <MaterialButton class="tab {$functionsSubTab === 'timer' ? 'active' : ''}" on:click={() => setFunctionsSubTab("timer")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={$functionsSubTab === "timer"} tab>
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="timer" size={1} white={$functionsSubTab === "timer"} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{timersCount}</span>
                </MaterialButton>
            </div>

            <!-- Variables Section -->
            <div class="section">
                <div class="title">{translate("tabs.variables", $dictionary)}</div>
                <MaterialButton
                    class="tab {$functionsSubTab === 'variables' && $activeVariableTagFilter.length === 0 ? 'active' : ''}"
                    on:click={() => {
                        setFunctionsSubTab("variables")
                        activeVariableTagFilter.set([])
                    }}
                    style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                    isActive={$functionsSubTab === "variables" && $activeVariableTagFilter.length === 0}
                    tab
                >
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="variable" size={1} white={$functionsSubTab === "variables" && $activeVariableTagFilter.length === 0} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{Object.keys($variables).length}</span>
                </MaterialButton>

                {#each sortedVariableTags as tag}
                    <MaterialButton
                        class="tab {$functionsSubTab === 'variables' && $activeVariableTagFilter.includes(tag.id) ? 'active' : ''}"
                        on:click={() => {
                            setFunctionsSubTab("variables")
                            activeVariableTagFilter.set([tag.id])
                        }}
                        style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                        isActive={$functionsSubTab === "variables" && $activeVariableTagFilter.includes(tag.id)}
                        tab
                    >
                        <div style="max-width: 85%;" data-title={tag.label}>
                            <Icon id="tag" size={1} style={!($functionsSubTab === "variables" && $activeVariableTagFilter.includes(tag.id)) && tag.color ? `fill: ${tag.color}` : ""} white={$functionsSubTab === "variables" && $activeVariableTagFilter.includes(tag.id)} />
                            <p style="margin: 5px;">{tag.label}</p>
                        </div>
                        <span class="count">{tag.count}</span>
                    </MaterialButton>
                {/each}
            </div>

            <!-- Triggers Section -->
            <div class="section">
                <div class="title">{translate("tabs.triggers", $dictionary)}</div>
                <MaterialButton class="tab {$functionsSubTab === 'triggers' ? 'active' : ''}" on:click={() => setFunctionsSubTab("triggers")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={$functionsSubTab === "triggers"} tab>
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="trigger" size={1} white={$functionsSubTab === "triggers"} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{triggersCount}</span>
                </MaterialButton>
            </div>
        </div>
    {:else if id === "overlays"}
        <div class="tabSection">
            <!-- All & Unlabeled Section -->
            <div class="section">
                <MaterialButton class="tab {activeOverlay === 'all' ? 'active' : ''}" on:click={() => setOverlayCategory("all")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeOverlay === "all"} tab>
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="all" size={1} white={activeOverlay === "all"} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{overlaysData.unarchivedItems.length}</span>
                </MaterialButton>

                {#if overlaysData.uncategorizedCount}
                    <MaterialButton class="tab {activeOverlay === 'unlabeled' ? 'active' : ''}" on:click={() => setOverlayCategory("unlabeled")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeOverlay === "unlabeled"} tab>
                        <div style="max-width: 85%;" data-title={translate("category.unlabeled", $dictionary)}>
                            <Icon id="noIcon" size={1} white={activeOverlay === "unlabeled"} />
                            <p style="margin: 5px;">{translate("category.unlabeled", $dictionary)}</p>
                        </div>
                        <span class="count">{overlaysData.uncategorizedCount}</span>
                    </MaterialButton>
                {/if}
            </div>

            <!-- Categories Section -->
            {#if overlaysData.unarchivedCategories.length}
                <div class="section">
                    <div class="title">{translate("guide_title.categories", $dictionary)}</div>
                    {#each sortByName(overlaysData.unarchivedCategories, "name") as cat}
                        {@const count = overlaysData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {activeOverlay === cat.id ? 'active' : ''}" on:click={() => setOverlayCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeOverlay === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={activeOverlay === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            <!-- Archived Categories Section -->
            {#if overlaysData.archivedCategories.length}
                <div class="section">
                    <div class="separator">
                        <div class="sepLabel">{translate("actions.archive_title", $dictionary)}</div>
                        <hr />
                    </div>
                    {#each sortByName(overlaysData.archivedCategories, "name") as cat}
                        {@const count = overlaysData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {activeOverlay === cat.id ? 'active' : ''}" on:click={() => setOverlayCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeOverlay === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={activeOverlay === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if id === "templates"}
        <div class="tabSection">
            <!-- All & Unlabeled Section -->
            <div class="section">
                <MaterialButton class="tab {activeTemplate === 'all' ? 'active' : ''}" on:click={() => setTemplateCategory("all")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeTemplate === "all"} tab>
                    <div style="max-width: 85%;" data-title={translate("category.all", $dictionary)}>
                        <Icon id="all" size={1} white={activeTemplate === "all"} />
                        <p style="margin: 5px;">{translate("category.all", $dictionary)}</p>
                    </div>
                    <span class="count">{templatesData.unarchivedItems.length}</span>
                </MaterialButton>

                {#if templatesData.uncategorizedCount}
                    <MaterialButton class="tab {activeTemplate === 'unlabeled' ? 'active' : ''}" on:click={() => setTemplateCategory("unlabeled")} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeTemplate === "unlabeled"} tab>
                        <div style="max-width: 85%;" data-title={translate("category.unlabeled", $dictionary)}>
                            <Icon id="noIcon" size={1} white={activeTemplate === "unlabeled"} />
                            <p style="margin: 5px;">{translate("category.unlabeled", $dictionary)}</p>
                        </div>
                        <span class="count">{templatesData.uncategorizedCount}</span>
                    </MaterialButton>
                {/if}
            </div>

            <!-- Categories Section -->
            {#if templatesData.unarchivedCategories.length}
                <div class="section">
                    <div class="title">{translate("guide_title.categories", $dictionary)}</div>
                    {#each sortByName(templatesData.unarchivedCategories, "name") as cat}
                        {@const count = templatesData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {activeTemplate === cat.id ? 'active' : ''}" on:click={() => setTemplateCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeTemplate === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={activeTemplate === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}

            <!-- Archived Categories Section -->
            {#if templatesData.archivedCategories.length}
                <div class="section">
                    <div class="separator">
                        <div class="sepLabel">{translate("actions.archive_title", $dictionary)}</div>
                        <hr />
                    </div>
                    {#each sortByName(templatesData.archivedCategories, "name") as cat}
                        {@const count = templatesData.allItems.filter(s => s.category === cat.id).length}
                        <MaterialButton class="tab {activeTemplate === cat.id ? 'active' : ''}" on:click={() => setTemplateCategory(cat.id)} style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={activeTemplate === cat.id} tab>
                            <div style="max-width: 85%;" data-title={translate(cat.name, $dictionary) || cat.name}>
                                <Icon id={cat.icon || "folder"} size={1} white={activeTemplate === cat.id} />
                                <p style="margin: 5px;">{translate(cat.name, $dictionary) || cat.name}</p>
                            </div>
                            <span class="count">{count}</span>
                        </MaterialButton>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if id === "scripture"}
        <div class="tabSection">
            {#each scriptureSections as section}
                <div class="section">
                    <div class="title">{translate(section.label, $dictionary)}</div>
                    {#each section.items as item}
                        <MaterialButton
                            class="tab {($collectionId || $openedScripture) === item.id ? 'active' : ''}"
                            on:click={() => {
                                const id = item.collection ? item.collection.versions[0] : item.id
                                const colId = item.collection ? item.id : ""
                                openedScripture.set(id)
                                collectionId.set(colId)
                                localStorage.setItem("scripture", id)
                                localStorage.setItem("collectionId", colId)
                            }}
                            style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;"
                            isActive={($collectionId || $openedScripture) === item.id}
                            tab
                        >
                            <div style="max-width: 85%;" data-title={item.customName || item.name}>
                                <Icon id={item.icon} size={1} white={($collectionId || $openedScripture) === item.id} />
                                <p style="margin: 5px;">{item.customName || item.name}</p>
                            </div>
                            {#if item.collection?.versions?.length}
                                <span class="count">{item.collection.versions.length}</span>
                            {/if}
                        </MaterialButton>
                    {/each}
                </div>
            {/each}
        </div>
    {:else}
        <!-- Other tabs - simple placeholder -->
        <div class="tabs">
            <Button class="tab active">
                <Icon {id} size={1.2} />
                <span>{translate(`tabs.${id}`, $dictionary)}</span>
            </Button>
        </div>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        background-color: var(--primary-darker);
    }

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

    .tabs {
        display: flex;
        background-color: var(--primary-darker);
    }
</style>

<script lang="ts">
    import {
        categories,
        shows,
        activeCategory,
        dictionary,
        scriptures,
        openedScripture,
        collectionId,
        actions,
        actionTags,
        variables,
        variableTags,
        activeActionTagFilter,
        activeVariableTagFilter,
        functionsSubTab,
        timers,
        triggers,
        overlays,
        overlayCategories,
        activeOverlayCategory,
        templates,
        templateCategories,
        activeTemplateCategory
    } from "../../../../util/stores"
    import { translate, keysToID, sortByName, buildCategoryData, type CategoryData } from "../../../../util/helpers"
    import { _set } from "../../../../util/stores"
    import Button from "../../../../../common/components/Button.svelte"
    import Icon from "../../../../../common/components/Icon.svelte"
    import MaterialButton from "../../../MaterialButton.svelte"
    import CategoryListRenderer from "./CategoryListRenderer.svelte"

    export let id: string

    const EMPTY_CATEGORY_DATA: CategoryData = {
        categoriesList: [],
        unarchivedCategories: [],
        archivedCategories: [],
        allItems: [],
        unarchivedItems: [],
        uncategorizedCount: 0
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
    $: favoritesList =
        id === "scripture"
            ? sortByName(
                  scriptureEntries.filter((a) => a.favorite),
                  "name"
              )
            : []
    $: favoriteIds = new Set(favoritesList.map((a) => a.id))
    $: collectionList =
        id === "scripture"
            ? sortByName(
                  scriptureEntries.filter((a) => a.collection && !favoriteIds.has(a.id)),
                  "name"
              )
            : []
    $: localBibles =
        id === "scripture"
            ? sortByName(
                  scriptureEntries.filter((a) => !a.collection && !a.api && !favoriteIds.has(a.id)),
                  "name"
              )
            : []
    $: apiBibles =
        id === "scripture"
            ? sortByName(
                  scriptureEntries.filter((a) => !a.collection && a.api && !favoriteIds.has(a.id)),
                  "name"
              )
            : []

    $: scriptureSections =
        id === "scripture"
            ? [
                  { id: "favorites", label: "category.favourites", items: favoritesList },
                  { id: "collections", label: "scripture.collections", items: collectionList },
                  { id: "local", label: "scripture.bibles_section", items: [...localBibles, ...apiBibles] }
              ].filter((s) => s.items.length > 0)
            : []

    function setCategory(catId: string) {
        _set("activeCategory", catId)
    }

    // Functions tab logic - only computed when functions tab is active
    $: actionsTagsOnly = id === "functions" ? Object.values($actions).map((a) => a.tags || []) : []
    $: variablesTagsOnly = id === "functions" ? Object.values($variables).map((a) => a.tags || []) : []
    $: timersCount = id === "functions" ? Object.keys($timers).length : 0
    $: triggersCount = id === "functions" ? Object.keys($triggers).length : 0

    $: sortedActionTags =
        id === "functions"
            ? sortByName(keysToID($actionTags), "name")
                  .sort((a, b) => String(a.color || "").localeCompare(String(b.color || "")))
                  .map((a) => ({
                      ...a,
                      label: a.name,
                      icon: "tag",
                      count: actionsTagsOnly.filter((b) => b.includes(a.id)).length
                  }))
            : []

    $: sortedVariableTags =
        id === "functions"
            ? sortByName(keysToID($variableTags), "name")
                  .sort((a, b) => String(a.color || "").localeCompare(String(b.color || "")))
                  .map((a) => ({
                      ...a,
                      label: a.name,
                      icon: "tag",
                      count: variablesTagsOnly.filter((b) => b.includes(a.id)).length
                  }))
            : []

    function setFunctionsSubTab(tab: string) {
        functionsSubTab.set(tab)
        // Clear tag filters when switching to a non-action/variable tab
        if (tab !== "actions") activeActionTagFilter.set([])
        if (tab !== "variables") activeVariableTagFilter.set([])
    }
</script>

<div class="main">
    {#if id === "shows"}
        <CategoryListRenderer categoryData={showsData} activeItem={active} onSelect={setCategory} />
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
        <CategoryListRenderer categoryData={overlaysData} activeItem={activeOverlay} onSelect={setOverlayCategory} />
    {:else if id === "templates"}
        <CategoryListRenderer categoryData={templatesData} activeItem={activeTemplate} onSelect={setTemplateCategory} />
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
    {:else if id === "audio"}
        <div class="tabSection">
            <div class="section">
                <MaterialButton class="tab active" style="width: 100%; font-weight: normal; padding: 0.2em 0.8em;" isActive={true} tab>
                    <div style="max-width: 85%;">
                        <Icon id="volume" size={1} white={true} />
                        <p style="margin: 5px;">{translate("audio.mixer", $dictionary)}</p>
                    </div>
                </MaterialButton>
            </div>
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

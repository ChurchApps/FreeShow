<script lang="ts">
    import { shows, dictionary, activeShow, activeCategory, categories } from "../../../../../util/stores"
    import { translate, dateToString } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import { _set } from "../../../../../util/stores"
    import MaterialButton from "../../../../MaterialButton.svelte"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import VirtualList from "../VirtualList.svelte"
    import Center from "../../../../../../common/components/Center.svelte"

    export let searchValue: string = ""
    $: searchTerm = (searchValue || "").trim().toLowerCase()

    // Sorting state
    let sortType = "name"
    let sortDirection = "asc"

    // Helper: get timestamp for a show based on current sort type (matching frontend logic)
    function getShowTimestamp(show: any): number {
        if (!show) return 0
        const type = sortType === "modified" ? "modified" : sortType === "created" ? "created" : sortType === "used" ? "used" : null
        return (type ? show.timestamps?.[type] : null) || show.timestamps?.modified || show.timestamps?.created || show.timestamps?.used || 0
    }

    $: active = $activeCategory || "all"

    // Filter shows based on search and category
    $: filteredShows = ($shows || []).filter((s: any) => {
        if (!s) return false
        // Category filter
        if (active === "all") {
            if (s.private) return false
            // Check if category is archived
            if (s.category && $categories[s.category]?.isArchive) return false
        } else if (active === "unlabeled") {
            if (s.category && $categories[s.category]) return false
        } else {
            if (s.category !== active) return false
        }

        // Search filter
        if (!searchTerm) return true
        const name = typeof s.name === "string" ? s.name.toLowerCase() : ""
        return name.includes(searchTerm)
    })

    // Keep the list scrolled to the top whenever the visible set of shows changes
    let virtualListRef: any = null
    let lastScrollResetKey = ""
    $: scrollResetKey = `${active}|${searchTerm}|${filteredShows.length}|${sortType}|${sortDirection}`
    $: if (virtualListRef?.scrollToTop && scrollResetKey !== lastScrollResetKey) {
        virtualListRef.scrollToTop()
        lastScrollResetKey = scrollResetKey
    }

    // Sort shows
    $: sortedShows = [...filteredShows].sort((a: any, b: any) => {
        let valA: any
        let valB: any

        if (sortType === "modified") {
            valA = getShowTimestamp(a)
            valB = getShowTimestamp(b)
        } else if (sortType === "number") {
            valA = a.quickAccess?.number ?? a.meta?.number ?? ""
            valB = b.quickAccess?.number ?? b.meta?.number ?? ""
            // Numeric sort for numbers
            if (valA !== "" && valB !== "" && !isNaN(valA) && !isNaN(valB)) {
                valA = Number(valA)
                valB = Number(valB)
            }
        } else {
            valA = a.name ?? ""
            valB = b.name ?? ""
        }

        if (typeof valA === "string") valA = valA.toLowerCase()
        if (typeof valB === "string") valB = valB.toLowerCase()

        if (valA < valB) return sortDirection === "asc" ? -1 : 1
        if (valA > valB) return sortDirection === "asc" ? 1 : -1
        return 0
    })

    function openShow(show: any) {
        if (!show) return
        send("SHOW", show.id)
        _set("active", { id: show.id, type: "show" })
        _set("activeTab", "show")
    }

    function toggleSort(type: string) {
        if (sortType === type) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc"
        } else {
            sortType = type
            sortDirection = type === "modified" ? "desc" : "asc"
        }
    }

    function getIcon(show: any) {
        if (show.private) return "private"
        if (show.locked) return "locked"

        // Check for special types if available
        // Assuming show object structure matches what we expect
        if (show.category && $categories[show.category]) {
            return $categories[show.category].icon || null
        }

        return "noIcon"
    }

    $: showWithNumber = filteredShows.some((a: any) => a.quickAccess?.number || a.meta?.number)
</script>

<div class="scroll-container">
    <div class="column">
        {#if $shows.length}
            {#if sortedShows.length}
                <div class="sort-header" role="group">
                    <MaterialButton style="flex: 1; justify-content: flex-start;" isActive={sortType === "name"} on:click={() => toggleSort("name")} title={translate("show.name", $dictionary)}>
                        <p>{translate("show.name", $dictionary)}</p>
                        {#if sortType === "name"}
                            <span class="sort-indicator">
                                <Icon id={sortDirection === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                            </span>
                        {/if}
                    </MaterialButton>

                    {#if showWithNumber}
                        <MaterialButton style="min-width: var(--number-width); justify-content: center;" isActive={sortType === "number"} on:click={() => toggleSort("number")} title="Number">
                            <p>#</p>
                            {#if sortType === "number"}
                                <span class="sort-indicator">
                                    <Icon id={sortDirection === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                                </span>
                            {/if}
                        </MaterialButton>
                    {/if}

                    <MaterialButton style="min-width: var(--modified-width); justify-content: center;" isActive={sortType === "modified"} on:click={() => toggleSort("modified")} title={translate("info.modified", $dictionary)}>
                        <p>{translate("info.modified", $dictionary)}</p>
                        {#if sortType === "modified"}
                            <span class="sort-indicator">
                                <Icon id={sortDirection === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                            </span>
                        {/if}
                    </MaterialButton>
                </div>

                <div class="list">
                    <VirtualList bind:this={virtualListRef} items={sortedShows} let:item={show} itemHeight={36} activeIndex={searchValue.length ? -1 : sortedShows.findIndex((a) => a.id === $activeShow?.id)}>
                        {@const showIcon = getIcon(show)}
                        {@const timestamp = getShowTimestamp(show)}
                        <div class="show-wrapper">
                            <MaterialButton class="show-item" style="width: 100%; justify-content: space-between; padding: 0.15em 0.8em; font-weight: normal; --outline-color: var(--secondary);" isActive={$activeShow?.id === show.id} tab on:click={() => openShow(show)}>
                                <div class="row">
                                    <span class="cell" style="max-width: calc(100% {showWithNumber ? '- var(--number-width)' : ''} - var(--modified-width, 0px));">
                                        <Icon id={show.played ? "check" : showIcon} custom={!show.played && showIcon !== "private" && showIcon !== "locked" && showIcon !== "noIcon"} box={24} white={show.played} right />

                                        <span class="name">{show.name}</span>

                                        {#if show.layoutInfo?.name}
                                            <span class="layout">{show.layoutInfo.name}</span>
                                        {/if}
                                    </span>

                                    <span class="cell">
                                        {#if showWithNumber}
                                            <span class="number">{show.quickAccess?.number || show.meta?.number || ""}</span>
                                        {/if}

                                        <span class="date">{dateToString(timestamp, true)}</span>
                                    </span>
                                </div>
                            </MaterialButton>
                        </div>
                    </VirtualList>
                </div>
            {:else}
                <Center faded>{translate("empty.search", $dictionary)}</Center>
            {/if}
        {:else}
            <Center faded>{translate("empty.shows", $dictionary)}</Center>
        {/if}
    </div>
</div>

<style>
    .scroll-container {
        overflow-y: auto;
        flex: 1;
        height: 100%;
    }

    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background-color: var(--primary-darkest);

        --number-width: 100px;
        --modified-width: 220px;
    }

    .column :global(svelte-virtual-list-viewport) {
        padding-bottom: 60px;
    }

    .list {
        flex: 1;
        height: 100%;
        overflow: hidden;
    }

    /* SORT HEADER */
    .sort-header {
        display: flex;
        height: 28px;
        border-radius: 4px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .sort-header :global(button) {
        font-size: 0.72em;
        opacity: 0.7;
        border-radius: 0;
        gap: 5px;
    }

    .sort-header :global(button:not(:last-child)) {
        border-right: 1px solid var(--primary-lighter) !important;
    }

    .sort-header :global(button.isActive) {
        background-color: var(--primary-darkest) !important;
        opacity: 1;
        border-bottom: 0 !important;
    }

    .sort-indicator {
        font-size: 0.85rem;
        line-height: 1;
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate(-50%, -38%);
        opacity: 0.7;
    }

    .show-wrapper {
        padding: 0;
        width: 100%;
        min-height: 36px;
    }

    /* LIST ITEM */
    :global(.show-item) {
        width: 100%;
        min-height: 36px;
    }

    :global(.show-item.isActive) {
        background-color: var(--primary-darkest) !important;
        border-left: 4px solid var(--secondary) !important;
    }

    .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 5px;
        width: 100%;
        min-height: 32px;
    }

    .cell {
        display: flex;
        align-items: center;
        max-width: 75%;
    }

    .name {
        font-size: 1em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin: 3px 5px;
        color: var(--text);
    }

    .layout {
        opacity: 0.6;
        font-style: italic;
        font-size: 0.9em;
        padding-inline-start: 5px;
        white-space: nowrap;
        max-width: 45%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cell .number,
    .cell .date {
        font-size: 0.9em;
        white-space: nowrap;
        text-align: right;
        color: var(--text);
        opacity: 0.75;
    }

    .cell .number {
        font-weight: 600;
        text-align: center;
        min-width: var(--number-width);
    }

    .cell .date {
        font-variant-numeric: tabular-nums;
        min-width: calc(var(--modified-width) - 0.8em - 8px);
    }
</style>

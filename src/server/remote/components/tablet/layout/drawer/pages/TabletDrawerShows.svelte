<script lang="ts">
    import { shows, dictionary, activeShow, activeCategory, categories } from "../../../../../util/stores"
    import { translate } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import { _set } from "../../../../../util/stores"
    import MaterialButton from "../../../../MaterialButton.svelte"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import VirtualList from "../VirtualList.svelte"

    export let searchValue: string = ""

    // Sorting state
    let sortType = "name"
    let sortDirection = "asc"

    $: active = $activeCategory || "all"

    // Filter shows based on search and category
    $: filteredShows = ($shows || []).filter((s: any) => {
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
        if (!searchValue) return true
        return s.name.toLowerCase().includes(searchValue.toLowerCase())
    })

    // Sort shows
    $: sortedShows = [...filteredShows].sort((a: any, b: any) => {
        let valA = a[sortType]
        let valB = b[sortType]

        if (sortType === "modified") {
            valA = a.timestamps?.modified || a.timestamps?.created || 0
            valB = b.timestamps?.modified || b.timestamps?.created || 0
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

    function formatDate(timestamp: number) {
        if (!timestamp) return ""
        const date = new Date(timestamp)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        
        if (days === 0) return "Today"
        if (days === 1) return "Yesterday"
        if (days < 7) return `${days} days ago`
        
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
    }
</script>

<div class="column">
    {#if sortedShows.length}
        <div class="sort-header" role="group">
            <MaterialButton 
                style="flex: 1; justify-content: flex-start;"
                isActive={sortType === 'name'}
                on:click={() => toggleSort('name')}
                title={translate("show.name", $dictionary)}
            >
                <p>{translate("show.name", $dictionary)}</p>
                {#if sortType === 'name'}
                    <span class="sort-indicator">
                        <Icon id={sortDirection === 'asc' ? 'arrow_down' : 'arrow_up'} size={1.3} white />
                    </span>
                {/if}
            </MaterialButton>
            
            <MaterialButton 
                style="min-width: 220px; justify-content: center;"
                isActive={sortType === 'modified'}
                on:click={() => toggleSort('modified')}
                title={translate("info.modified", $dictionary)}
            >
                <p>{translate("info.modified", $dictionary)}</p>
                {#if sortType === 'modified'}
                    <span class="sort-indicator">
                        <Icon id={sortDirection === 'asc' ? 'arrow_down' : 'arrow_up'} size={1.3} white />
                    </span>
                {/if}
            </MaterialButton>
        </div>

        <div class="list">
            <VirtualList items={sortedShows} let:item={show}>
                <div class="show-wrapper">
                    <MaterialButton 
                        class="show-item" 
                        style="width: 100%; justify-content: space-between; padding: 0.6em 0.8em;"
                        isActive={$activeShow?.id === show.id}
                        on:click={() => openShow(show)}
                    >
                        <span class="name">{show.name}</span>
                        <span class="date">{formatDate(show.timestamps?.modified || show.timestamps?.created || 0)}</span>
                    </MaterialButton>
                </div>
            </VirtualList>
        </div>
    {:else}
        <div class="empty">
            {translate("empty.shows", $dictionary)}
        </div>
    {/if}
</div>

<style>
    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden; /* VirtualList handles scroll */
        background-color: var(--primary-darkest);
        flex: 1;
    }

    .list {
        flex: 1;
        height: 100%;
        overflow: hidden;
    }

    .sort-header {
        display: flex;
        height: 30px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .sort-header :global(.button) {
        flex: 1;
        justify-content: center;
        font-size: 0.8em;
        opacity: 0.7;
        border-radius: 0;
        gap: 5px;
    }

    .sort-header :global(.button.active) {
        background-color: var(--primary-darkest);
        opacity: 1;
    }

    .show-wrapper {
        padding: 1px 5px;
    }

    :global(.show-item) {
        width: 100%;
        justify-content: space-between;
        padding: 8px 12px;
        text-align: left;
        display: flex;
    }

    :global(.show-item .button) {
        justify-content: space-between;
        width: 100%;
    }

    :global(.show-item.active) {
        background-color: var(--primary);
        border-left: 3px solid var(--secondary);
    }

    .name {
        font-size: 1em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }

    .date {
        font-size: 0.8em;
        opacity: 0.5;
        margin-left: 10px;
    }

    .empty {
        padding: 20px;
        text-align: center;
        opacity: 0.5;
    }
</style>

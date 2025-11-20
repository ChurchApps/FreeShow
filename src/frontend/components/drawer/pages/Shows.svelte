<script lang="ts">
    // import VirtualList from "@sveltejs/svelte-virtual-list"
    // import VirtualList from "./VirtualList2.svelte"
    import { get } from "svelte/store"
    import type { ShowList } from "../../../../types/Show"
    import { activeEdit, activeFocus, activePopup, activeProject, activeShow, activeTagFilter, categories, drawer, focusMode, labelsDisabled, shows, sorted, sortedShowsList } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { formatSearch, isRefinement, showSearch, tokenize } from "../../../utils/search"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByNameAndNumber } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { updateShowsList } from "../../helpers/show"
    import { dateToString } from "../../helpers/time"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import ShowButton from "../../inputs/ShowButton.svelte"
    import Autoscroll from "../../system/Autoscroll.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import VirtualList from "../VirtualList.svelte"

    export let active: string | null
    export let searchValue: string

    $: formattedSearch = formatSearch(searchValue)
    $: showsSorted = $sortedShowsList

    // // don't update unless it's changed
    // let updatedSorted: typeof showsSorted = []
    // $: if (showsSorted) updateSorted()
    // function updateSorted() {
    //     if (JSON.stringify(updateSorted) !== JSON.stringify(updatedSorted)) updatedSorted = clone(showsSorted)
    // }

    const profile = getAccess("shows")
    const readOnly = profile.global === "read"

    let filteredShows: ShowList[] = []
    let filteredStored: ShowList[] = []
    $: filteredStored = filteredShows =
        active === "all"
            ? showsSorted.filter((a) => !$categories[a?.category || ""]?.isArchive && profile[a?.category || ""] !== "none")
            : active === "number"
              ? sortByNameAndNumber(
                    showsSorted.filter((a) => a.quickAccess?.number),
                    "asc"
                )
              : active === "locked"
                ? showsSorted.filter((a) => a.locked)
                : showsSorted.filter((s) => profile[s?.category || ""] !== "none" && (active === s.category || (active === "unlabeled" && (s.category === null || !$categories[s.category]))))

    export let firstMatch: null | any = null
    let previousSearchTokens: string[] = []
    $: if (active || filteredStored) previousSearchTokens = []
    // $: if (active || filteredStored) previousFilteredShows = clone(filteredStored)
    let previousFilteredShows: any[] = clone(filteredStored)

    $: drawerIsClosed = $drawer.height <= 40
    let shouldUpdate = false
    // update when drawer is opened if it has changes
    $: if (shouldUpdate && !drawerIsClosed) search()

    // reduce lag by only refreshing full list when not typing for 100 ms
    let isTyping: NodeJS.Timeout | null = null
    $: largeList = filteredStored.length > 300
    $: if (searchValue && largeList) typing()
    function typing() {
        if (isTyping) clearTimeout(isTyping)
        isTyping = setTimeout(() => {
            isTyping = null
            search()
        }, 100)
    }

    // let scrolledToTop = ""
    let createFromSearch = false
    $: if (formattedSearch !== undefined || filteredStored || $activeTagFilter) search()
    function search() {
        if (isTyping) return
        // don't update if drawer is closed
        // updates to this lags the editor when moving/resizing items, if many shows in list
        if (drawerIsClosed) {
            shouldUpdate = true
            return
        }
        shouldUpdate = false

        if (searchValue.length > 1) {
            const currentTokens = tokenize(formattedSearch)
            const isNarrowing = isRefinement(currentTokens, previousSearchTokens)

            const baseList = isNarrowing ? previousFilteredShows : clone(filteredStored)
            const tagFiltered = filterByTags(baseList, $activeTagFilter)

            let filteredShowsTemp = showSearch(formattedSearch, tagFiltered)

            if (searchValue.length > 15 && filteredShowsTemp.length > 50) filteredShowsTemp = filteredShowsTemp.slice(0, 50)
            if (searchValue.length > 30 && filteredShowsTemp.length > 30) filteredShowsTemp = filteredShowsTemp.slice(0, 30)

            filteredShows = filteredShowsTemp
            firstMatch = filteredShows[0] || null
            previousFilteredShows = clone(filteredShows)
            previousSearchTokens = currentTokens

            // if no title matches
            if (active === "all" && !showLoading && searchValue.length > 5 && (firstMatch?.originalMatch || 0) < 70) {
                firstMatch = "SEARCH_CREATE"
                createFromSearch = true
            } else {
                createFromSearch = false
            }

            // scroll to top
            setTimeout(() => document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0))
            // if (scrolledToTop !== searchValue)
            // scrolledToTop = searchValue
        } else {
            filteredShows = filterByTags(clone(filteredStored), $activeTagFilter)
            firstMatch = null
            previousSearchTokens = []
            previousFilteredShows = clone(filteredStored)
            createFromSearch = false
            if ($activeShow?.data?.searchInput) {
                activeShow.update((a) => {
                    delete a!.data
                    return a
                })
            }
        }
    }

    function filterByTags(shows, tags: string[]) {
        if (!tags.length) return shows

        return shows.filter((a) => {
            return !tags.find((tagId) => !a.quickAccess?.tags?.includes(tagId))
        })
    }

    let showLoading = false
    function keydown(e: KeyboardEvent) {
        if (e.target?.closest(".search")) {
            // get preview of shows
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                createFromSearch = false
                let currentIndex = filteredShows.findIndex((a) => a.id === $activeShow?.id)
                let newIndex = 0
                if (currentIndex < 0) newIndex = e.key === "ArrowDown" ? 0 : filteredShows.length - 1
                else newIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1
                if (newIndex < 0 || newIndex >= filteredShows.length) return

                activeShow.set({ id: filteredShows[newIndex].id, type: "show", data: { searchInput: true } })

                showLoading = true
                setTimeout(() => (showLoading = false), 500)
            }
            return
        }

        if (e.target?.closest("input") || e.target?.closest(".edit") || (!e.ctrlKey && !e.metaKey) || !filteredShows?.length) return
        if ($activeEdit.items.length) return

        let id = ""
        if (e.key === "ArrowRight") {
            if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[0].id
            else {
                let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                if (currentIndex < filteredShows.length - 1) id = filteredShows[currentIndex + 1].id
            }
        } else if (e.key === "ArrowLeft") {
            if (!$activeShow || ($activeShow.type !== undefined && $activeShow.type !== "show")) id = filteredShows[filteredShows.length - 1].id
            else {
                let currentIndex: number = filteredShows.findIndex((a) => a.id === $activeShow!.id)
                if (currentIndex > 0) id = filteredShows[currentIndex - 1].id
            }
        }

        if (id) {
            if ($focusMode) activeFocus.set({ id, type: "show" })
            else activeShow.set({ id, type: "show" })
        }
    }

    $: showWithNumber = filteredShows.some((a) => a.quickAccess?.number)
    $: sortType = $sorted.shows?.type || "name"
    // All sortable columns share the same metadata so the UI + store stay in sync
    $: sortHeaders = [
        { id: "name", label: translateText("show.name"), asc: "name", desc: "name_des", default: "asc" },
        ...(showWithNumber ? [{ id: "number", label: translateText("meta.number"), asc: "number", desc: "number_des", default: "asc" }] : []),
        { id: "modified", label: translateText("info.modified"), asc: "modified_old", desc: "modified", default: "desc" }
    ]

    function toggleSort(columnId: string) {
        const definition = sortHeaders.find((header) => header.id === columnId)
        if (!definition) return

        const currentType = $sorted.shows?.type || "name"
        let nextType: string = definition.default === "desc" ? definition.desc : definition.asc
        if (currentType === definition.asc) nextType = definition.desc
        else if (currentType === definition.desc) nextType = definition.asc

        sorted.update((state) => {
            if (!state.shows) state.shows = {}
            state.shows.type = nextType
            return state
        })

        updateShowsList(get(shows))
    }

    function createShow(e: any, border = false) {
        if (border && e.target?.closest("button")) return

        const { ctrl } = e.detail
        if (ctrl) {
            const selectedIndex = $activeShow?.index === undefined ? undefined : $activeShow.index + 1
            history({ id: "UPDATE", newData: { remember: { project: $activeProject, index: selectedIndex } }, location: { page: "show", id: "show" } })
        } else {
            activePopup.set("show")
        }
    }

    // let listElem: HTMLElement | null = null
    // let scrollElem: HTMLElement | null = null
    // $: if (listElem && active) setTimeout(updateScrollElem)
    // function updateScrollElem() {
    //     scrollElem = listElem?.querySelector("svelte-virtual-list-viewport") || null
    // }

    $: showWithNonExistentCategory = active === "unlabeled" && filteredStored.some((s) => s.category)
    function createNonExistentCategories() {
        const nonexistentCategories = [...new Set(filteredStored.map((s) => s.category))] as string[]

        categories.update((a) => {
            nonexistentCategories.forEach((id) => {
                if (a[id]) return
                a[id] = { name: translateText("main.unnamed") }
            })
            return a
        })
    }
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll style="overflow-y: auto;flex: 1;">
    <!-- bind:this={listElem} -->
    <div class="column {readOnly ? '' : 'context #drawer_show'}">
        {#if filteredShows.length}
            {#if createFromSearch && searchValue.length && typeof searchValue === "string"}
                <div class="warning">
                    <p style="padding: 6px 8px;"><T id="show.enter_create" />: <span style="color: var(--secondary);font-weight: bold;">{searchValue[0]?.toUpperCase() + searchValue.slice(1)}</span></p>
                </div>
            {/if}

            <div class="sort-header" role="group">
                {#each sortHeaders as header, i}
                    {@const direction = sortType === header.asc ? "asc" : sortType === header.desc ? "desc" : ""}
                    {@const isActive = direction !== ""}

                    <MaterialButton style="flex: {i === 0 ? 4 : 1};justify-content: {header.id === 'name' ? 'flex-start' : 'center'};" {isActive} on:click={() => toggleSort(header.id)} title={header.label}>
                        <p>{header.label}</p>
                        {#if direction}
                            <span class="sort-indicator">
                                <Icon id={direction === "asc" ? "arrow_down" : "arrow_up"} size={1.3} white />
                            </span>
                        {/if}
                    </MaterialButton>
                {/each}
            </div>

            <!-- reload list when changing category -->
            {#key active}
                <VirtualList items={filteredShows} let:item={show} activeIndex={searchValue.length ? -1 : filteredShows.findIndex((a) => a.id === $activeShow?.id)}>
                    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={filteredShows} draggable>
                        {#if searchValue.length <= 1 || show.match}
                            <ShowButton {active} id={show.id} {show} data={dateToString(show.timestamps?.[sortType] || show.timestamps?.modified || show.timestamps?.created || "", true)} class="#drawer_show_button" match={show.match || null} />
                        {/if}
                    </SelectElem>
                </VirtualList>
            {/key}

            {#if searchValue.length > 1 && !filteredShows.length}
                <Center size={1.2} faded><T id="empty.search" /></Center>
            {/if}
        {:else}
            <Center size={1.2} faded><T id="empty.shows" /></Center>
        {/if}
    </div>
</Autoscroll>

{#if showWithNonExistentCategory}
    <FloatingInputs side="left" onlyOne>
        <MaterialButton icon="autofill" on:click={createNonExistentCategories}>
            <T id="category.create_nonexistent" />
        </MaterialButton>
    </FloatingInputs>
{/if}

<FloatingInputs onlyOne gradient>
    <div role="none" class="overflow-interact" on:click={(e) => createShow(e, true)}>
        <MaterialButton icon="add" class="context #drawer_new_show" title="tooltip.show [Ctrl+N]" disabled={readOnly} on:click={createShow}>
            {#if !$labelsDisabled}<T id="new.show" />{/if}
        </MaterialButton>
    </div>
</FloatingInputs>

<style>
    .column {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        height: 100%;
    }

    .warning {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }

    .column :global(svelte-virtual-list-viewport) {
        padding-bottom: 60px;
    }

    /* THIS don't work with virtual list */
    /* .column :global(svelte-virtual-list-contents:nth-child(even) button) {
        background-color: var(--primary-darkest);
    } */

    /* SORT HEADER */

    .sort-header {
        display: flex;
        height: 28px;
        border-radius: 8px;
        background-color: var(--primary-darkest);
        /* box-shadow: 0 3px 8px rgb(0 0 0 / 0.2); */
        border-bottom: 1px solid var(--primary-lighter);
    }

    .sort-header :global(button) {
        font-size: 0.72em;
        opacity: 0.7;
    }
    .sort-header :global(button:not(:last-child)) {
        border-right: 1px solid var(--primary-lighter) !important;
    }
    .sort-header :global(button.isActive) {
        background-color: var(--primary-darker) !important;
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
</style>

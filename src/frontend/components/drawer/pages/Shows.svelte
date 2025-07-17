<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import type { ShowList } from "../../../../types/Show"
    import { activeEdit, activeFocus, activePopup, activeProject, activeShow, activeTagFilter, categories, dictionary, drawer, focusMode, labelsDisabled, sorted, sortedShowsList } from "../../../stores"
    import { formatSearch, isRefinement, showSearch, tokenize } from "../../../utils/search"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { dateToString } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import ShowButton from "../../inputs/ShowButton.svelte"
    import Autoscroll from "../../system/Autoscroll.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let id: string
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

    let filteredShows: ShowList[] = []
    let filteredStored: ShowList[] = []
    $: filteredStored = filteredShows =
        active === "all" ? showsSorted.filter((a) => !$categories[a?.category || ""]?.isArchive) : showsSorted.filter((s) => active === s.category || (active === "unlabeled" && (s.category === null || !$categories[s.category])))

    export let firstMatch: null | any = null
    let previousSearchTokens: string[] = []
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
            document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
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

    // auto scroll to active show in the virtual list
    // WIP this does not work because the show buttons does not exist unless they are in view
    if (id) {
    }
    // $: if (id === "shows" && $activeShow !== null && ($activeShow.type || "show") === "show") {
    //     let scrollElem = document.querySelector("svelte-virtual-list-viewport")
    //     if (scrollElem) {
    //         let elemTop = scrollElem.querySelector("#show_" + $activeShow.id)?.closest("svelte-virtual-list-row")?.offsetTop || 0
    //         scrollElem.scrollTo(0, elemTop - scrollElem.offsetTop)
    //     }
    // }

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

    $: sortType = $sorted.shows?.type || "name"
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll style="overflow-y: auto;flex: 1;">
    <div class="column context #drawer_show">
        {#if filteredShows.length}
            {#if createFromSearch}
                <div class="warning">
                    <p style="padding: 6px 8px;"><T id="show.enter_create" />: <span style="color: var(--secondary);font-weight: bold;">{searchValue[0].toUpperCase() + searchValue.slice(1)}</span></p>
                </div>
            {/if}
            <!-- reload list when changing category -->
            {#key active}
                <VirtualList items={filteredShows} let:item={show}>
                    <SelectElem id="show_drawer" data={{ id: show.id }} shiftRange={filteredShows} draggable>
                        {#if searchValue.length <= 1 || show.match}
                            <ShowButton id={show.id} {show} data={dateToString(show.timestamps?.[sortType] || show.timestamps?.modified || show.timestamps?.created || "", true, $dictionary)} class="#drawer_show_button" match={show.match || null} />
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
<div class="tabs">
    <Button
        id="newShowBtn"
        style="flex: 1;"
        on:click={(e) => {
            if (e.ctrlKey || e.metaKey) {
                history({ id: "UPDATE", newData: { remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
            } else activePopup.set("show")
        }}
        class="context #drawer_new_show"
        center
        title="{$dictionary.tooltip?.show} [Ctrl+N]"
    >
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.show" />{/if}
    </Button>
</div>

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

    /* THIS don't work with virtual list */
    /* .column :global(svelte-virtual-list-contents:nth-child(even) button) {
        background-color: var(--primary-darkest);
    } */

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }

    /* .column.hidden :global(button) {
    display: none;
  } */
</style>

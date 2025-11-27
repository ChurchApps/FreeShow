<script lang="ts">
    import { activePopup, popupData, shows, sortedShowsList } from "../../../stores"
    import { formatSearch, isRefinement, showSearch, tokenize } from "../../../utils/search"
    import VirtualList from "../../drawer/VirtualList.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    $: sortedShows = $sortedShowsList
    $: privateShows = sortByName(keysToID($shows).filter(a => a.private === true))

    $: defaultShows = clone([...(showPrivate ? privateShows : []), ...sortedShows])
    $: if (defaultShows) search()

    $: active = $popupData.active || ""

    let searchedShows = clone(defaultShows)
    let searchValue = ""
    let previousSearchTokens: string[] = []
    let previousFilteredShows = clone(defaultShows)

    function search(value: string | null = null) {
        searchValue = formatSearch(value || "")

        if (searchValue.length < 2) {
            searchedShows = clone(defaultShows)
            previousSearchTokens = []
            previousFilteredShows = clone(defaultShows)
            return
        }

        const currentTokens = tokenize(searchValue)
        const narrowing = isRefinement(currentTokens, previousSearchTokens)
        const baseList = narrowing ? previousFilteredShows : clone(defaultShows)

        searchedShows = showSearch(searchValue, baseList)

        if (searchValue.length > 15 && searchedShows.length > 50) searchedShows = searchedShows.slice(0, 50)
        if (searchValue.length > 30 && searchedShows.length > 30) searchedShows = searchedShows.slice(0, 30)

        previousSearchTokens = currentTokens
        previousFilteredShows = searchedShows

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
    }

    function selectShow(show: any) {
        if ($popupData.action !== "select_show") return

        if ($popupData.trigger) {
            $popupData.trigger(show.id)
        } else {
            popupData.set({ ...$popupData, showId: show.id })
        }

        activePopup.set($popupData.revert || null)
    }

    let showPrivate = false
</script>

<MaterialTextInput label="main.search" value="" on:input={e => search(e.detail)} autofocus />

<!-- probably not needed as private shows rarely need to be auto played (one could unprivate, add it, then make it private again) -->
<!-- <CombinedInput>
    <p><T id="actions.view_private" /></p>
    <div class="alignRight">
        <Checkbox checked={showPrivate} on:change={() => (showPrivate = !showPrivate)} />
    </div>
</CombinedInput> -->

<div class="list">
    {#if sortedShows.length}
        {#if searchValue.length > 1 && searchedShows.length === 0}
            <Center size={1.2} faded><T id="empty.search" /></Center>
        {:else}
            <VirtualList items={searchedShows} let:item={show}>
                <MaterialButton showOutline={active === show.id} style="width: 100%;font-weight: normal;justify-content: start;padding: 4px 12px;" on:click={() => selectShow(show)}>
                    {#if show.private}<Icon id="locked" right />{/if}
                    {show.name}
                </MaterialButton>
            </VirtualList>
        {/if}
    {:else}
        <Center size={1.2} faded>
            <T id="empty.shows" />
        </Center>
    {/if}
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        width: 50vw;
        max-height: 50vh;
        margin-top: 10px;
        overflow: auto;

        background-color: var(--primary-darker);
        border-radius: 8px;
        border: 2px solid var(--primary-lighter);
    }

    .list :global(svelte-virtual-list-viewport) {
        height: 100vh !important;
        padding: 10px 0;
    }
    .list :global(svelte-virtual-list-row:nth-child(odd)) {
        background-color: rgb(0 0 20 / 0.12);
    }
</style>

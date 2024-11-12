<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import { activePopup, dictionary, popupData, shows, sortedShowsList } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import { formatSearch, showSearch } from "../../../utils/search"

    $: sortedShows = $sortedShowsList
    $: privateShows = sortByName(keysToID($shows).filter((a) => a.private === true))

    $: defaultShows = clone([...(showPrivate ? privateShows : []), ...sortedShows])
    $: if (defaultShows) search()

    $: active = $popupData.active || ""

    let searchedShows = clone(defaultShows)
    let searchValue = ""
    let previousSearchValue: string = ""
    function search(e: any = null) {
        searchValue = formatSearch(e?.target?.value || "")

        if (searchValue.length < 2) {
            searchedShows = clone(defaultShows)
            return
        }

        let currentShowsList = searchedShows
        // reset if search value changed
        if (!searchValue.includes(previousSearchValue)) currentShowsList = clone(defaultShows)

        searchedShows = showSearch(searchValue, currentShowsList)
        if (searchValue.length > 15 && searchedShows.length > 50) searchedShows = searchedShows.slice(0, 50)
        if (searchValue.length > 30 && searchedShows.length > 30) searchedShows = searchedShows.slice(0, 30)

        previousSearchValue = searchValue
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

<CombinedInput>
    <TextInput placeholder={$dictionary.main?.search} value={searchValue} on:input={search} />
</CombinedInput>
<CombinedInput>
    <p><T id="actions.view_private" /></p>
    <div class="alignRight">
        <Checkbox checked={showPrivate} on:change={() => (showPrivate = !showPrivate)} />
    </div>
</CombinedInput>

<div class="list">
    {#if sortedShows.length}
        {#if searchValue.length > 1 && searchedShows.length === 0}
            <Center size={1.2} faded><T id="empty.search" /></Center>
        {:else}
            <VirtualList items={searchedShows} let:item={show}>
                <Button on:click={() => selectShow(show)} outline={active === show.id} bold={false} style="width: 100%;">
                    {#if show.private}<Icon id="locked" right />{/if}
                    {show.name}
                </Button>
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
        margin: 15px 0;
        overflow: auto;
    }

    .list :global(svelte-virtual-list-viewport) {
        height: 100vh !important;
    }
    .list :global(svelte-virtual-list-row:nth-child(odd)) {
        background-color: rgb(0 0 20 / 0.12);
    }
</style>

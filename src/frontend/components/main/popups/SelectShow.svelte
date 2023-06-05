<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import { activePopup, dictionary, popupData, sortedShowsList } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"

    $: sortedShows = $sortedShowsList

    $: searchedShows = sortedShows
    let searchValue = ""
    function search(e: any) {
        searchValue = e.target.value.toLowerCase()

        if (searchValue.length < 2) {
            searchedShows = sortedShows
            return
        }

        searchedShows = sortedShows.filter((a) => searchValue.split(" ").find((value) => a.name.toLowerCase().includes(value)))
    }

    function selectShow(show: any) {
        if ($popupData.action !== "select_show") return

        activePopup.set(null)
        popupData.set({ ...$popupData, id: show.id })
    }
</script>

<div style="display: flex;justify-content: space-between;">
    <TextInput placeholder={$dictionary.main?.search} value={searchValue} on:input={search} />
</div>
<div class="list">
    {#if sortedShows.length}
        {#if searchValue.length > 1 && searchedShows.length === 0}
            <Center size={1.2} faded><T id="empty.search" /></Center>
        {:else}
            <VirtualList items={searchedShows} let:item={show}>
                <Button on:click={() => selectShow(show)} bold={false} style="width: 100%;">
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
        background-color: var(--primary-darker);
    }
</style>

<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { destroyMain, receiveMain, requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, deletedShows, popupData, shows, showsCache } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    const type = $popupData.type

    let loadingEmpty = false
    onMount(() => {
        popupData.set({})

        sendMain(Main.FULL_SHOWS_LIST)

        loadingEmpty = true
        requestMain(
            Main.GET_EMPTY_SHOWS,
            { cached: $showsCache },
            (a) => {
                if (a) emptyShows = a
                loadingEmpty = false
            },
            60000
        )

        getDuplicatedShows()
    })

    let allShowsInFolder: string[] = []
    const listenerId = receiveMain(Main.FULL_SHOWS_LIST, (data) => {
        allShowsInFolder = data || []
        const deletedShowNames = $deletedShows.map((a) => a.name + ".show")
        allShowsInFolder = allShowsInFolder.filter((name) => !deletedShowNames.includes(name))
    })
    onDestroy(() => destroyMain(listenerId))

    // delete shows from folder that are not indexed
    function deleteBrokenShows() {
        sendMain(Main.DELETE_SHOWS_NI, { shows: $shows })

        setTimeout(() => {
            // this will not include newly created shows not saved yet, but it should not be an issue.
            sendMain(Main.FULL_SHOWS_LIST)
        }, 800)
    }

    let emptyShows: { id: string; name: string }[] = []
    function deleteEmptyShows() {
        sendMain(Main.DELETE_SHOWS, { shows: emptyShows })
        // emptyShows = []
        activePage.set("show")
    }

    let duplicatedShows: { ids: string[] }[] = []
    function getDuplicatedShows() {
        const names: { [key: string]: string[] } = {}
        Object.entries($shows).forEach(([id, show]) => {
            if (!show?.name) return
            // remove any numbers (less than 4 chars) at the end of name (but not if "1-3"|"-5" in case of scripture)
            const trimmedName = show.name
                .toLowerCase()
                .replace(/(?<![-\d])\d{1,3}$/, "")
                .trim()
            if (!trimmedName.length) return

            if (names[trimmedName]) names[trimmedName].push(id)
            else names[trimmedName] = [id]
        })

        duplicatedShows = Object.values(names)
            .filter((a) => a.length > 1)
            .map((ids) => ({ ids }))
    }
    function deleteDuplicatedShows() {
        popupData.set({ id: "delete_duplicated_shows", data: duplicatedShows })
        activePopup.set("delete_duplicated_shows")
        // duplicatedShows = []
    }
</script>

{#if type === "shows"}
    <div class="list">
        <!-- USED TO DELETE "BROKEN" SHOWS -->
        {#if allShowsInFolder.length > Object.keys($shows).length}
            <InputRow>
                <MaterialButton style="width: 100%;" icon="delete" info={"" + (allShowsInFolder.length - Object.keys($shows).length)} on:click={deleteBrokenShows} red white>
                    <T id="actions.delete_shows_not_indexed" />
                </MaterialButton>
            </InputRow>
        {/if}

        <!-- DELETE EMPTY SHOWS -->
        {#if emptyShows.length}
            <InputRow arrow>
                <MaterialButton style="width: 100%;" icon="delete" info={"" + emptyShows.length} on:click={deleteEmptyShows} red white>
                    <T id="actions.delete_empty_shows" />
                </MaterialButton>

                <div slot="menu">
                    <ul style="list-style-position: inside;margin-left: 20px;">
                        {#each emptyShows as show}
                            <li>{show.name}</li>
                        {/each}
                    </ul>
                </div>
            </InputRow>
        {:else if loadingEmpty}
            <Center padding={10}>
                <Loader />
            </Center>
        {/if}

        <!-- REMOVE DUPLICATED SHOWS -->
        {#if duplicatedShows.length}
            <InputRow>
                <MaterialButton style="width: 100%;" icon="launch" info={"" + duplicatedShows.length} on:click={deleteDuplicatedShows} white>
                    <T id="popup.delete_duplicated_shows" />
                </MaterialButton>
            </InputRow>
        {/if}
    </div>
{/if}

<style>
    .list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
</style>

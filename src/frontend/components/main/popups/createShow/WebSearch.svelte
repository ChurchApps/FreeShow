<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { MAIN } from "../../../../../types/Channels"
    import { dictionary } from "../../../../stores"
    import { newToast } from "../../../../utils/common"
    import { destroy, receive, send } from "../../../../utils/request"
    import T from "../../../helpers/T.svelte"
    import Center from "../../../system/Center.svelte"
    import Loader from "../../Loader.svelte"

    export let query: string

    type LyricSearchResult = {
        source: string
        key: string
        artist: string
        title: string
        originalQuery: string
    }

    let songs: LyricSearchResult[] | null = null

    let loading = false
    // let loadTimeout: any = null
    onMount(searchLyrics)
    function searchLyrics() {
        let artist = ""
        let title = query
        if (!title) {
            newToast("$toast.no_name")
            return
        }

        send(MAIN, ["SEARCH_LYRICS"], { artist, title })
        loading = true

        // loadTimeout = setTimeout(() => {
        //     newToast("timed out")
        //     setValue("")
        // }, 20000)
    }

    function getLyrics(song: LyricSearchResult) {
        send(MAIN, ["GET_LYRICS"], { song })
        loading = true
    }

    // encode using btoa()
    const blockedWords = ["ZnVjaw==", "Yml0Y2g=", "bmlnZ2E="]
    let id = "CREATE_SHOW"
    receive(
        MAIN,
        {
            SEARCH_LYRICS: (data: LyricSearchResult[]) => {
                if (!data.length) {
                    newToast("$empty.search")
                    setValue("")
                }

                loading = false
                songs = data
            },
        },
        id
    )
    receive(
        MAIN,
        {
            GET_LYRICS: (data: { lyrics: string; source: string }) => {
                loading = false

                // filter out songs with bad words
                blockedWords.forEach((eWord) => {
                    let word = atob(eWord)
                    if (data.lyrics.includes(word)) data.lyrics = ""
                })

                if (!data.lyrics) {
                    newToast("$toast.lyrics_undefined")
                    setValue("")
                    return
                }

                setValue(data.lyrics)
                newToast($dictionary.toast?.lyrics_copied + " " + data.source + "!")
            },
        },
        id
    )
    onDestroy(() => destroy(MAIN, id))

    let dispatch = createEventDispatcher()
    function setValue(lyrics: string) {
        dispatch("update", lyrics)
    }
</script>

{#if loading}
    <Center style="overflow: hidden;">
        <Loader />
    </Center>
{:else if songs !== null}
    <div class="header">
        <T id="create_show.search_results" />
    </div>

    <div style="max-height: 250px;overflow-y: auto;">
        <table class="searchResultTable">
            <thead>
                <tr>
                    <th><T id="show.song" /></th>
                    <th><T id="show.artist" /></th>
                    <th><T id="show.source" /></th>
                </tr>
            </thead>
            <tbody>
                {#if songs}
                    {#each songs as song}
                        <tr
                            on:click={() => {
                                getLyrics(song)
                            }}
                        >
                            <td class="title">{song.title}</td>
                            <td>{song.artist}</td>
                            <td>{song.source}</td>
                        </tr>
                    {/each}
                {:else}
                    <tr>
                        <td colspan="3">No songs found</td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
{/if}

<style>
    .header {
        text-align: center;
        font-size: 0.9em;
        padding: 5px 0;
        background: var(--primary-darkest);
        font-weight: 600;
        opacity: 0.9;
    }

    .search {
        display: flex;
        align-items: center;

        align-self: center;
    }
    .search.loading {
        padding: 0 6px;
    }

    /* loader */
    .search :global(div) {
        width: 25px;
        height: 25px;
    }

    .searchResultTable {
        width: 100%;
        table-layout: fixed;
        border-spacing: 0;
    }

    .searchResultTable th {
        text-align: left;
        font-size: 0.8em;
        font-weight: bold;
        padding: 2px 10px;
    }

    .searchResultTable td {
        font-size: 0.8em;
        padding: 2px 10px;
        overflow: hidden;
        white-space: noWrap;
    }

    .searchResultTable tbody tr:nth-child(odd) {
        background-color: var(--hover);
    }

    .searchResultTable tbody tr:hover {
        background-color: var(--focus);
        cursor: pointer;
    }

    .searchResultTable td:first-of-type,
    .searchResultTable th:first-of-type {
        width: 64%;
    }
    .searchResultTable td:nth-of-type(2),
    .searchResultTable th:nth-of-type(2) {
        width: 22%;
    }

    .searchResultTable td:nth-of-type(3),
    .searchResultTable th:nth-of-type(3) {
        width: 14%;
    }

    .searchResultTable .title {
        font-weight: 600;
        color: var(--secondary);
    }
</style>

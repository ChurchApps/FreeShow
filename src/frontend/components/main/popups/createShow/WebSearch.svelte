<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { MAIN } from "../../../../../types/Channels"
    import { dictionary, special } from "../../../../stores"
    import { newToast } from "../../../../utils/common"
    import { destroy, receive, send } from "../../../../utils/request"
    import Icon from "../../../helpers/Icon.svelte"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
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
    const blockedArtists = ["R2hvc3Q=", "R2VuZXNpcw==", "QUMvREM=", "RGlzdHVyYmVk", "Qm9iIFJpdmVycw==", "Q2FyeSBBbm4gSGVhcnN0"]
    let id = "CREATE_SHOW"
    receive(
        MAIN,
        {
            SEARCH_LYRICS: (data: LyricSearchResult[]) => {
                data = filterBadArtists(data)

                if (!data.length) {
                    newToast("$empty.search")
                    setValue("")
                }

                loading = false
                songs = data
            },
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

    function filterBadArtists(data: LyricSearchResult[]) {
        return data.filter(
            (a) =>
                !blockedArtists.find((eArtist) => {
                    const artist = atob(eArtist)
                    return a.artist && a.artist === artist
                }) && !($special.blockedArtists || []).includes(a.artist)
        )
    }

    let dispatch = createEventDispatcher()
    function setValue(lyrics: string) {
        dispatch("update", lyrics)
    }

    function blockArtist(artist: string) {
        special.update((a) => {
            if (!a.blockedArtists) a.blockedArtists = []
            a.blockedArtists.push(artist)
            return a
        })

        if (songs) songs = filterBadArtists(songs)
    }
</script>

{#if loading}
    <Center style="overflow: hidden;">
        <Loader />
    </Center>
{:else if songs !== null}
    <div class="header">
        <Icon id="search" white right />
        <T id="create_show.search_results" />
    </div>

    <div style="max-height: 250px;overflow-y: auto;display: flex;">
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
                            on:click={(e) => {
                                if (e.target?.closest("button")) return
                                getLyrics(song)
                            }}
                        >
                            <td class="title">{song.title}</td>
                            <td class="flex-table">
                                {song.artist}
                                {#if song.artist && song.source !== "Hymnary"}
                                    <Button title={$dictionary.create_show?.block} style="padding: 2px;" on:click={() => blockArtist(song.artist)}>
                                        <Icon style="opacity: 0.4;" id="block" white />
                                    </Button>
                                {/if}
                            </td>
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
        display: flex;
        align-items: center;
        justify-content: center;

        font-size: 0.9em;
        padding: 5px 0;
        background: var(--primary-darkest);
        font-weight: 600;
        opacity: 0.9;
    }

    .searchResultTable {
        flex: 1;
        table-layout: fixed;
        border-spacing: 0;

        background-color: var(--primary-darker);
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

    .searchResultTable td.flex-table {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 5px;
        width: 100%;
    }

    .searchResultTable .title {
        font-weight: 600;
        color: var(--secondary);
    }
</style>

<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { ShowObj } from "../../../classes/Show"
    import { convertText, getQuickExample } from "../../../converters/txt"
    import { activePopup, activeProject, activeShow, categories, dictionary, drawerTabsData, formatNewShow, quickTextCache, shows, splitLines } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { destroy, receive, send } from "../../../utils/request"
    import { sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { checkName } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextArea from "../../inputs/TextArea.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../Loader.svelte"
    import { get } from "svelte/store"

    type LyricSearchResult = {
        source: string
        key: string
        artist: string
        title: string
        originalQuery: string
    }

    function textToShow() {
        let sections = values.text.split("\n\n").filter((a: any) => a.length)

        // let metaData: string = ""
        // if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]
        let category = selectedCategory.id.length ? selectedCategory.id : null

        if (sections.length) {
            convertText({ name: values.name, category, text: values.text })
        } else {
            let show = new ShowObj(false, category)
            show.name = checkName(values.name)
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }

        values = { name: "", text: "" }
        quickTextCache.set("")
        activePopup.set(null)
    }

    const changeValue = (e: any, key: string = "text") => {
        values[key] = e.target.value

        // store text if popup is closed
        if (key === "text") quickTextCache.set(values.text)
    }
    let values: any = {
        text: $quickTextCache.length > 20 ? $quickTextCache : "",
        name: "",
    }

    let songs: LyricSearchResult[] | null = null

    function keydown(e: any) {
        if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return

        if (document.activeElement?.closest("#name")) {
            e.preventDefault()
            searchLyrics()
            return
        }

        ;(document.activeElement as any)?.blur()
        textToShow()
    }

    const cats: any = [
        { id: "", name: "—" },
        ...sortObject(
            Object.keys($categories).map((key: string) => ({
                id: key,
                ...$categories[key],
            })),
            "name"
        ).map((cat: any) => ({
            id: cat.id,
            name: cat.default ? `$:${cat.name}:$` : cat.name,
        })),
    ]

    let selectedCategory: any = cats[0]
    // get the selected category
    if ($drawerTabsData.shows?.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab]) selectedCategory = cats.find((a: any) => a.id === $drawerTabsData.shows.activeSubTab)
    // get the category from the active show
    else if ($shows[$activeShow?.id || ""]?.category) selectedCategory = cats.find((a: any) => a.id === $shows[$activeShow?.id || ""]?.category)
    // set to "Songs" if it exists & nothing else if selected
    else if ($categories.song) selectedCategory = cats.find((a: any) => a.id === "song")
    // otherwise set to first category
    else if (cats.length > 1) selectedCategory = cats[1]

    const inputs: any = {
        formatNewShow: (e: any) => formatNewShow.set(e.target.checked),
    }

    let showMore: boolean = false
    let showSearchResults: boolean = false
    let activateLyrics: boolean = !!values.text.length

    let loading = false
    function searchLyrics() {
        let artist = ""
        let title = values.name
        if (!title) {
            newToast("$toast.no_name")
            return
        }

        send(MAIN, ["SEARCH_LYRICS"], { artist, title })
        loading = true
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
                console.log("DATA IS", data)
                loading = false
                songs = data
                showSearchResults = true
            },
        },
        id
    )
    receive(
        MAIN,
        {
            GET_LYRICS: (data: { lyrics: string; source: string }) => {
                console.log("DATA IS", data)
                loading = false
                showSearchResults = false

                // filter out songs with bad words
                blockedWords.forEach((eWord) => {
                    let word = atob(eWord)
                    if (data.lyrics.includes(word)) data.lyrics = ""
                })

                if (!data.lyrics) {
                    newToast("$toast.lyrics_undefined")
                    return
                }

                values.text = data.lyrics
                activateLyrics = true
                newToast(get(dictionary).toast?.lyrics_copied + " " + data.source + "!")
            },
        },
        id
    )
    onDestroy(() => destroy(MAIN, id))
</script>

<svelte:window on:keydown={keydown} />

<CombinedInput textWidth={30}>
    <p><T id="show.name" /></p>
    <TextInput id="name" autofocus value={values.name} on:input={(e) => changeValue(e, "name")} style="height: 30px;" />
    <div class="search" class:loading>
        {#if loading}
            <Loader />
        {:else}
            <Button on:click={searchLyrics} title={$dictionary.create_show?.search_web}>
                <Icon id="search" size={1.2} white />
            </Button>
        {/if}
    </div>
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="show.category" /></p>
    <Dropdown options={cats} value={selectedCategory?.name} on:click={(e) => (selectedCategory = e.detail)} />
</CombinedInput>

{#if showMore}
    <CombinedInput textWidth={30} title={$dictionary.create_show?.format_new_show_tip}>
        <p><T id="create_show.format_new_show" /></p>
        <div class="alignRight">
            <Checkbox checked={$formatNewShow} on:change={inputs.formatNewShow} />
        </div>
    </CombinedInput>
    <CombinedInput textWidth={30} title={$dictionary.create_show?.split_lines_tip}>
        <p><T id="create_show.split_lines" /></p>
        <NumberInput
            disabled={!$formatNewShow}
            value={$splitLines}
            max={100}
            on:change={(e) => {
                splitLines.set(e.detail)
            }}
        />
    </CombinedInput>
{:else}
    <CombinedInput>
        <Button on:click={() => (showMore = !showMore)} style="width: 100%;" dark center>
            <Icon id="options" right white={showMore} />
            <T id="create_show.more_options" />
        </Button>
    </CombinedInput>
{/if}

{#if songs !== null}
    <Button on:click={() => (showSearchResults = !showSearchResults)} style="margin-top: 10px;" dark center>
        <Icon id="search" right white={activateLyrics} />
        <T id="show.search_results" />
    </Button>
{/if}

{#if showSearchResults}
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

<Button on:click={() => (activateLyrics = !activateLyrics)} style="margin-top: 10px;" dark center>
    <Icon id="text" right white={activateLyrics} />
    <T id="show.quick_lyrics" />
</Button>

{#if activateLyrics}
    <!-- <span><T id="show.quick_lyrics" /></span> -->
    <TextArea placeholder={getQuickExample()} style="height: 250px;min-width: 500px;" value={values.text} on:input={(e) => changeValue(e)} />
{/if}

<CombinedInput style="margin-top: 10px;">
    <Button on:click={textToShow} style="width: 100%;" dark center data-testid="create.show.popup.new.show">
        {#if values.text.trim().length > 0}
            <Icon id="showIcon" right />
            <T id="new.show" />
        {:else}
            <Icon id="showIcon" right white />
            <T id="new.empty_show" />
        {/if}
    </Button>
</CombinedInput>

<style>
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

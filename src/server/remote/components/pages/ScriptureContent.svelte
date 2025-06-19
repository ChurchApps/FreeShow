<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
    import { send } from "../../util/socket"
    import { scriptureViewList } from "../../util/stores"

    export let id: string
    export let scripture: Bible
    export let tablet: boolean = false

    let activeBook = -1
    let activeChapter = -1
    let activeVerse = 0

    $: books = scripture.books || []
    $: chapters = books[activeBook]?.chapters || []
    $: verses = chapters[activeChapter]?.verses || []

    // COLORS

    const colorCodesFull = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
    const colorCodesNT = [5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
    const colors = ["", "#f17d46", "#ffd17c", "#8cdfff", "#8888ff", "#ff97f2", "#ffdce7", "#88ffa9", "#ffd3b6"]

    export function getColorCode(books: any[], bookId: number | string) {
        let bookIndex = typeof bookId === "number" ? bookId : books.findIndex((a) => a.id === bookId)

        if (books.length === colorCodesFull.length) return colors[colorCodesFull[bookIndex]]
        else if (books.length === colorCodesNT.length) return colors[colorCodesNT[bookIndex]]
        return ""
    }

    // NAMES

    let usedNames: string[] = []
    function getShortName(name: string, i: number) {
        let shortName = isNaN(parseInt(name[0])) ? name.slice(0, 3) : name.replace(" ", "").slice(0, 4)

        // use four characters if same short name ("Jud"ges="Jud"e)
        if (i === 0) usedNames = []
        if (usedNames.includes(shortName) && shortName.length === 3) shortName = name.slice(0, 4)
        usedNames.push(shortName)

        return shortName
    }

    // OUTPUT

    function playScripture(verseNumber: number) {
        activeVerse = verseNumber
        // chapters[activeChapter]?.number ??
        send("API:start_scripture", { id, reference: `${books[activeBook]?.number ?? activeBook + 1}.${activeChapter + 1}.${activeVerse}` })
    }

    // OPEN ONE AT A TIME

    export let depth = 0

    // let dispatch = createEventDispatcher()
    // if (depth !== undefined) dispatch("depth", depth)

    function formatBibleText(text: string | undefined) {
        if (!text) return ""
        text = text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>')
        return removeTags(stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", ""))
    }
    function removeTags(text: string) {
        return text.replace(/(<([^>]+)>)/gi, "")
    }
    function stripMarkdown(input: string) {
        input = input.replace(/#\s*(.*?)\s*#/g, "")
        input = input.replace(/\*\{(.*?)\}\*/g, "")
        input = input.replace(/!\{(.*?)\}!/g, "$1")
        // input = input.replace(/\[(.*?)\]/g, "[$1]")
        input = input.replace(/(\*\*|__)(.*?)\1/g, "$2")
        input = input.replace(/(\*|_)(.*?)\1/g, "$2")
        input = input.replace(/\+\+(.*?)\+\+/g, "$1")
        input = input.replace(/~~(.*?)~~/g, "$1")
        input = input.replace(/"([^"]*?)"/g, "$1")
        input = input.replace(/\n/g, "")
        input = input.replace(/¶/g, "")

        return input
    }
</script>

{#if depth}
    <h2 class="header" style="position: absolute;top: 0;">
        {books[activeBook]?.name || ""}
        {#if depth === 2}{chapters[activeChapter]?.number}{/if}
        <!-- {#if activeVerse}:{activeVerse}{/if} -->
    </h2>
{/if}

<!-- GRID MODE -->
<div class="grid" class:tablet>
    {#if depth === 0}
        <div class="books">
            {#if books?.length}
                {#key books}
                    {#each books as book, i}
                        <!-- this uses index instead of number! -->
                        {@const id = i + 1}
                        {@const color = getColorCode(books, i)}
                        {@const name = getShortName(book.name, i)}

                        <span
                            id={id.toString()}
                            on:click={() => {
                                activeVerse = 0
                                activeChapter = -1
                                activeBook = i
                                depth++
                            }}
                            class:active={activeBook === i}
                            style="color: {color};"
                            title={book.name}
                        >
                            {name}
                        </span>
                    {/each}
                {/key}
            {:else}
                <Loading />
            {/if}
        </div>
    {/if}

    <!-- <div class="content"> -->
    {#if depth === 1}
        <div class="chapters context #scripture_chapter" style="text-align: center;" class:center={!chapters?.length}>
            {#if chapters?.length}
                {#each chapters as chapter, i}
                    {@const id = chapter.number ?? i + 1}
                    <span
                        id={id.toString()}
                        on:mousedown={() => {
                            activeVerse = 0
                            activeChapter = i
                            depth++
                        }}
                        class:active={activeChapter === i}
                    >
                        {id}
                    </span>
                {/each}
            {:else}
                <Loading />
            {/if}
        </div>
    {/if}

    {#if depth === 2}
        <div class="verses context #scripture_verse" class:center={!verses.length} class:big={verses.length > 100} class:list={$scriptureViewList}>
            {#if verses.length}
                {#each verses as verse, i}
                    {@const id = verse.number ?? i + 1}
                    <p style="color: var(--text);font-weight: normal;" on:click={() => playScripture(id)} class:active={activeVerse === id}>
                        <span style="width: 100%;height: 100%;color: var(--secondary);font-weight: bold;">
                            {id}
                        </span>
                        {#if $scriptureViewList}{formatBibleText(verse.text || verse.value)}{/if}
                    </p>
                {/each}
            {:else}
                <Loading />
            {/if}
        </div>
    {/if}
    <!-- </div> -->

    <!-- {#if bibles[0].copyright}
        <copy>{bibles[0].copyright}</copy>
    {/if} -->
</div>

<style>
    /* GRID MODE */

    .grid {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    .grid.tablet .books {
        border-bottom: 2px solid var(--primary-lighter);
    }
    .grid.tablet .chapters {
        border-inline-end: 2px solid var(--primary-lighter);
    }

    .grid div {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        align-content: flex-start;

        position: relative;
        scroll-behavior: smooth;
    }

    /* .grid .content */
    .grid .books {
        flex-direction: row;
        height: 100%;
    }
    .grid .chapters,
    .grid .verses {
        flex-direction: row;
        height: 100%;
    }

    /* .grid.tablet .content */
    .grid.tablet .books {
        height: 50%;
    }
    .grid.tablet .chapters,
    .grid.tablet .verses {
        width: 50%;
    }

    .grid .books,
    .grid .chapters,
    .grid .verses {
        flex-wrap: wrap;
        align-content: normal;
    }

    .grid .verses.list {
        flex-direction: column;
        flex-wrap: nowrap;
    }

    .grid p,
    .grid span {
        display: flex;
        justify-content: center;
        align-items: center;

        /* min-width: 40px; */
        min-width: 50px;
        flex: 1;

        font-weight: 600;
    }
    .grid .verses.list p {
        align-items: unset;
        justify-content: unset;
        padding: 10px 0;
    }
    .grid .verses.list span {
        max-width: 50px;
    }

    .grid .books span {
        /* min-width: 52px; */
        /* min-width: 82px; */
        /* min-width: 33%; */
        min-width: 25%;
    }
    .grid .big span {
        min-width: 40px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
    }

    .grid div p:hover {
        background-color: var(--hover);
    }

    .grid .active {
        background-color: var(--focus);
    }
</style>

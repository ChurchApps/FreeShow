<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
    import { onDestroy } from "svelte"
    import { send } from "../../util/socket"
    import { currentScriptureState, scriptureViewList, outShow, outSlide } from "../../util/stores"

    export let id: string
    export let scripture: Bible
    export let tablet: boolean = false
    export let currentBook: string = ""
    export let currentChapter: string = ""
    export let currentVerse: string = ""

    let activeBook = -1
    let activeChapter = -1
    let activeVerse = 0

    // Track what is displayed on output (separate from user's navigation position)
    let displayedBookIndex = -1
    let displayedChapterIndex = -1
    let displayedVerseNumber = 0
    let pendingVerseDepth = false // Used when navigating from search to wait for data load

    $: books = scripture?.books || []
    $: chapters = books[activeBook]?.chapters || []
    $: if (depth === 1) {
        const bookObj: any = books[activeBook]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: activeBook })
        }
    }
    $: verses = chapters[activeChapter]?.verses || []
    $: if (depth === 2) {
        const bookObj: any = books[activeBook]
        const chapterObj: any = chapters[activeChapter]
        if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
        }
    }
    // Auto-advance to verse depth once data loads (for search navigation)
    $: if (pendingVerseDepth && depth === 1 && activeBook >= 0 && activeChapter >= 0) {
        const chapterObj: any = chapters[activeChapter]
        if (chapters.length > 0 && chapterObj) {
            const bookObj: any = books[activeBook]
            if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
                send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
            } else if (chapterObj?.verses?.length > 0) {
                pendingVerseDepth = false
                depth = 2
            }
        }
    }
    $: if (pendingVerseDepth && depth === 2 && verses.length > 0) {
        pendingVerseDepth = false
    }

    $: currentBook = books[activeBook]?.name || ""
    $: currentChapter = (() => {
        const num = chapters[activeChapter]?.number
        return num !== undefined && num !== null ? String(num) : ""
    })()
    $: currentVerse = activeVerse > 0 ? String(activeVerse) : ""

    // Update displayed indices from main app state (what's currently on output)
    const unsubscribeScripture = currentScriptureState.subscribe((state) => {
        if (!state) return
        if (state.scriptureId && state.scriptureId !== id) return
        
        const bookIndex = state.bookId
        const chapterIndex = state.chapterId
        const verseList = state.activeVerses
        const latestVerse = Array.isArray(verseList) && verseList.length > 0 ? parseInt(String(verseList[verseList.length - 1]), 10) : 0

        if (Number.isInteger(bookIndex) && bookIndex >= 0) displayedBookIndex = bookIndex
        if (Number.isInteger(chapterIndex) && chapterIndex >= 0) displayedChapterIndex = chapterIndex
        if (Number.isFinite(latestVerse) && latestVerse > 0) displayedVerseNumber = latestVerse
    })
    onDestroy(() => {
        unsubscribeScripture()
    })

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
        if (activeBook < 0 || activeChapter < 0 || verseNumber <= 0) return
        
        const book = books[activeBook]
        const chapter = chapters[activeChapter]
        if (!book || !chapter) return
        
        const bookNumber = book.number ?? activeBook + 1
        const chapterNumber = chapter.number ?? activeChapter + 1
        send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${verseNumber}` })
    }

    // NAVIGATION

    export let depth = 0

    export function goBack() {
        if (depth > 0) {
            pendingVerseDepth = false
            if (depth === 1) {
                activeChapter = -1
                activeVerse = 0
            } else if (depth === 2) {
                activeVerse = 0
            }
            depth--
        }
    }

    // Navigate to verse depth from search - handles data loading progressively
    export function navigateToVerse(bookNum: number, chapterNum: number) {
        const bookIndex = books.findIndex((b: any) => {
            const bNum = typeof b?.number === 'string' ? parseInt(b.number, 10) : b?.number
            return (bNum ?? 0) === bookNum
        })
        if (bookIndex >= 0) {
            activeBook = bookIndex
            const bookObj: any = books[bookIndex]
            const chapters = bookObj?.chapters || []

            let chapterIndex = chapters.findIndex((c: any) => {
                const cNum = typeof c.number === 'string' ? parseInt(c.number, 10) : c.number
                return cNum === chapterNum
            })
            if (chapterIndex < 0) {
                chapterIndex = Math.max(0, chapterNum - 1)
            }
            activeChapter = chapterIndex

            const chapterObj: any = chapters[chapterIndex]
            const hasChapters = chapters.length > 0
            const hasVerses = chapterObj?.verses?.length > 0

            // Request missing data and set depth based on what's available
            if (bookObj?.keyName && !hasChapters) {
                pendingVerseDepth = true
                send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex })
                depth = 1
            } else if (bookObj?.keyName && chapterObj?.keyName && !hasVerses) {
                pendingVerseDepth = true
                send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex, chapterIndex })
                depth = 2
            } else if (hasChapters && hasVerses) {
                pendingVerseDepth = false
                depth = 2
            } else {
                pendingVerseDepth = true
                depth = 1
            }
        }
    }

    $: if (!scripture || !Array.isArray(scripture.books)) {
        activeBook = -1
        activeChapter = -1
        activeVerse = 0
        displayedBookIndex = -1
        displayedChapterIndex = -1
        displayedVerseNumber = 0
        depth = 0
    }

    function parseScriptureReference(reference: string): { bookIndex: number; chapterIndex: number; verseNumber: number } | null {
        if (!reference || !books || books.length === 0) return null

        // Match patterns like "Genesis 1:1", "Genesis 1 1", "1 John 2:3", "Psalm 23:1-6", etc.
        const match = reference.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-\d+)?$/)
        if (!match) return null

        const [, bookName, chapterStr, versePart1, versePart2] = match
        const verseStr = versePart1 || versePart2
        if (!verseStr) return null

        const chapterNumber = parseInt(chapterStr, 10)
        const verseNumber = parseInt(verseStr, 10)

        const bookIndex = books.findIndex((book) => {
            if (book.name.toLowerCase() === bookName.toLowerCase().trim()) {
                return true
            }

            const normalizedBookName = bookName.toLowerCase().trim()
            const normalizedScriptureName = book.name.toLowerCase()

            return normalizedScriptureName.includes(normalizedBookName) || normalizedBookName.includes(normalizedScriptureName)
        })

        if (bookIndex === -1) {
            return null
        }

        const chapterIndex = chapterNumber - 1

        return { bookIndex, chapterIndex, verseNumber }
    }

    // Extract scripture reference from outShow slide content
    function extractScriptureFromSlide(): { bookIndex: number; chapterIndex: number; verseNumber: number } | null {
        if (!$outShow?.slides || $outSlide === null) return null

        const currentSlideId = Object.keys($outShow.slides)[$outSlide]
        if (!currentSlideId || !$outShow.slides[currentSlideId]) return null

        const slide = $outShow.slides[currentSlideId]
        if (!slide.items) return null

        // Look through all slide items for scripture references
        for (const item of slide.items) {
            if (!item.lines || !Array.isArray(item.lines)) continue

            for (const line of item.lines) {
                if (!line.text || !Array.isArray(line.text)) continue

                for (const textItem of line.text) {
                    if (textItem && textItem.value && typeof textItem.value === "string") {
                        // Check if this looks like a scripture reference
                        if (textItem.value.match(/^.+?\s+\d+(?:[:.,]\s*\d+|\s+\d+)/)) {
                            const parsed = parseScriptureReference(textItem.value)
                            if (parsed) {
                                return parsed
                            }
                        }
                    }
                }
            }
        }

        return null
    }

    // Update displayed verse from slide content (ensures highlight follows main app changes)
    $: if (scripture && Array.isArray(scripture.books) && $outShow && $outSlide !== null) {
        const slideScripture = extractScriptureFromSlide()
        if (slideScripture) {
            displayedBookIndex = slideScripture.bookIndex
            displayedChapterIndex = slideScripture.chapterIndex
            displayedVerseNumber = slideScripture.verseNumber
        }
    }
    // Sync highlight with displayed verse (only when viewing that book/chapter - no auto-navigation)
    $: if (depth === 2 && displayedVerseNumber > 0 && displayedBookIndex >= 0 && displayedChapterIndex >= 0) {
        if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex) {
            if (activeVerse !== displayedVerseNumber) {
                activeVerse = displayedVerseNumber
            }
        }
    }

    // Navigate next/previous verse based on what's displayed on output (not user's navigation)
    export function forward() {
        if (displayedBookIndex >= 0 && displayedChapterIndex >= 0 && displayedVerseNumber > 0) {
            const displayedBook = books[displayedBookIndex]
            if (!displayedBook) return
            
            const bookNumber = displayedBook.number ?? displayedBookIndex + 1
            const displayedChapters = displayedBook.chapters || []
            const displayedChapter = displayedChapters[displayedChapterIndex]
            if (!displayedChapter) return
            
            const chapterNumber = displayedChapter.number ?? displayedChapterIndex + 1
            
            // Use loaded verses if available, otherwise increment verse number
            if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verses.length > 0) {
                const verseNumbers: number[] = verses.map((v: any, i: number) => {
                    const num = v?.number ?? i + 1
                    return typeof num === 'string' ? parseInt(num, 10) : num
                })
                const currentIndex = verseNumbers.indexOf(displayedVerseNumber)
                if (currentIndex >= 0 && currentIndex < verseNumbers.length - 1) {
                    const nextVerse = verseNumbers[currentIndex + 1]
                    send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${nextVerse}` })
                }
            } else {
                const nextVerse = displayedVerseNumber + 1
                send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${nextVerse}` })
            }
        }
    }

    export function backward() {
        if (displayedBookIndex >= 0 && displayedChapterIndex >= 0 && displayedVerseNumber > 0) {
            const displayedBook = books[displayedBookIndex]
            if (!displayedBook) return
            
            const bookNumber = displayedBook.number ?? displayedBookIndex + 1
            const displayedChapters = displayedBook.chapters || []
            const displayedChapter = displayedChapters[displayedChapterIndex]
            if (!displayedChapter) return
            
            const chapterNumber = displayedChapter.number ?? displayedChapterIndex + 1
            
            // Use loaded verses if available, otherwise decrement verse number
            if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verses.length > 0) {
                const verseNumbers: number[] = verses.map((v: any, i: number) => {
                    const num = v?.number ?? i + 1
                    return typeof num === 'string' ? parseInt(num, 10) : num
                })
                const currentIndex = verseNumbers.indexOf(displayedVerseNumber)
                if (currentIndex > 0) {
                    const prevVerse = verseNumbers[currentIndex - 1]
                    send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${prevVerse}` })
                }
            } else {
                if (displayedVerseNumber > 1) {
                    const prevVerse = displayedVerseNumber - 1
                    send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${prevVerse}` })
                }
            }
        }
    }

    // TEXT FORMATTING

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

<!-- Header handled by parent -->

<!-- GRID MODE -->
<div class="grid" class:tablet>
    {#if depth === 0}
        <div class="books">
            {#if books?.length}
                {#key books}
                    {#each books as book, i}
                        <!-- this uses index instead of number! -->
                        {@const bookUiId = i + 1}
                        {@const color = getColorCode(books, i)}
                        {@const name = getShortName(book.name, i)}

                        <span
                            id={bookUiId.toString()}
                            role="button"
                            tabindex="0"
                            on:mousedown={() => {
                                activeBook = i
                                activeChapter = -1
                                activeVerse = 0
                                depth++
                            }}
                            on:keydown={(e) =>
                                e.key === "Enter" &&
                                (() => {
                                    activeBook = i
                                    activeChapter = -1
                                    activeVerse = 0
                                    depth++
                                })()}
                            class:active={activeBook === i}
                            class:displayed={i === displayedBookIndex}
                            class:output={i === displayedBookIndex}
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
                    {@const chapterUiId = Number(chapter.number) || i + 1}
                    <span
                        id={chapterUiId.toString()}
                        role="button"
                        tabindex="0"
                        on:mousedown={() => {
                            const previousChapter = activeChapter
                            activeChapter = i
                            activeBook = i >= 0 ? activeBook : -1
                            if (i === displayedChapterIndex && activeBook === displayedBookIndex && displayedVerseNumber > 0) {
                                activeVerse = displayedVerseNumber
                            } else if (previousChapter !== i) {
                                activeVerse = 0
                            }
                            depth++
                        }}
                        on:keydown={(e) =>
                            e.key === "Enter" &&
                            (() => {
                                const previousChapter = activeChapter
                                activeChapter = i
                                activeBook = i >= 0 ? activeBook : -1
                                if (i === displayedChapterIndex && activeBook === displayedBookIndex && displayedVerseNumber > 0) {
                                    activeVerse = displayedVerseNumber
                                } else if (previousChapter !== i) {
                                    activeVerse = 0
                                }
                                depth++
                            })()}
                        class:active={activeChapter === i}
                        class:displayed={activeBook === displayedBookIndex && i === displayedChapterIndex}
                        class:output={activeBook === displayedBookIndex && i === displayedChapterIndex}
                    >
                        {chapterUiId}
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
                    {@const verseNumber = Number(verse.number) || i + 1}
                    {@const isDisplayed = activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verseNumber === displayedVerseNumber}
                    {@const isActive = activeVerse === verseNumber}
                    <button type="button" class="verse-button" on:click={() => playScripture(verseNumber)} on:keydown={(e) => e.key === "Enter" && playScripture(verseNumber)} class:active={isActive} class:displayed={isDisplayed}>
                        <span style="width: 100%;height: 100%;color: var(--secondary);font-weight: bold;">
                            {verseNumber}
                        </span>
                        {#if $scriptureViewList}{formatBibleText(verse.text || verse.value)}{/if}
                    </button>
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
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .grid div::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .grid div::-webkit-scrollbar-track,
    .grid div::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .grid div::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .grid div::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
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
        /* FreeShow UI scrollbar styling (desktop) */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .grid .verses.list::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .grid .verses.list::-webkit-scrollbar-track,
    .grid .verses.list::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .grid .verses.list::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .grid .verses.list::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .grid .verse-button,
    .grid span {
        display: flex;
        justify-content: center;
        align-items: center;

        /* min-width: 40px; */
        min-width: 50px;
        flex: 1;

        font-weight: 600;
    }
    .grid .verses.list .verse-button {
        align-items: unset;
        justify-content: unset;
        padding: 10px 0;
    }
    .verse-button {
        display: flex;
        align-items: unset;
        justify-content: unset;
        padding: 10px 0;
        background: transparent;
        border: none;
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
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
    /* Make interactive book/chapter items show pointer cursor like verse buttons */
    .grid .books span,
    .grid .chapters span {
        cursor: pointer;
    }
    .grid .big span {
        min-width: 40px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
    }

    .grid div .verse-button:hover {
        background-color: var(--hover);
    }

    .grid .active {
        background-color: var(--focus);
    }
    /* Highlight currently displayed scripture elements */
    .grid .books .output,
    .grid .chapters .output {
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
    }
    /* Highlight currently displayed verse - works across all translations */
    .grid .verses .displayed {
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
    }
</style>

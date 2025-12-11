<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
    import { onDestroy } from "svelte"
    import { send } from "../../util/socket"
    import { currentScriptureState, scriptureViewList, scriptureWrapText, outShow, outSlide } from "../../util/stores"

    export let id: string
    export let scripture: Bible
    export let scriptures: { id: string; data: any; name: string }[] = []
    export let isCollection: boolean = false
    export let selectedTranslationIndex: number | null = null // null = all, number = specific translation index
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

    // Reference to scroll containers
    let booksScrollElem: HTMLElement | null = null
    let chaptersScrollElem: HTMLElement | null = null
    let versesScrollElem: HTMLElement | null = null

    $: books = scripture?.books || []
    $: chapters = books[activeBook]?.chapters || []

    // Helper: Load collection scripture data if needed
    function loadCollectionScripture(scrId: string, bookIndex: number, chapterIndex?: number) {
        if (scrId === id || !isCollection || scriptures.length <= 1) return

        const scr = scriptures.find((s) => s.id === scrId)
        if (!scr) return

        const scrBooks = scr.data?.books || []
        const scrBook = scrBooks[bookIndex]
        if (!scrBook?.keyName) return

        if (chapterIndex !== undefined) {
            // Load chapter data
            const scrChapters = scrBook?.chapters || []
            const scrChapter = scrChapters[chapterIndex]
            if (scrChapter?.keyName && !(scrChapter?.verses?.length > 0)) {
                send("GET_SCRIPTURE", { id: scrId, bookKey: scrBook.keyName, chapterKey: scrChapter.keyName, bookIndex, chapterIndex })
            }
        } else {
            // Load book data
            if (!(scrBook?.chapters?.length > 0)) {
                send("GET_SCRIPTURE", { id: scrId, bookKey: scrBook.keyName, bookIndex })
            }
        }
    }

    $: if (activeBook >= 0) {
        const bookObj: any = books[activeBook]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: activeBook })
        }
        // Load book data for all collection scriptures
        if (isCollection) {
            scriptures.forEach((scr) => loadCollectionScripture(scr.id, activeBook))
        }
    }

    $: verses = chapters[activeChapter]?.verses || []
    $: if (activeChapter >= 0 && activeBook >= 0) {
        const bookObj: any = books[activeBook]
        const chapterObj: any = chapters[activeChapter]
        if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
        }
        // Load chapter data for all collection scriptures
        if (isCollection) {
            scriptures.forEach((scr) => loadCollectionScripture(scr.id, activeBook, activeChapter))
        }
    }

    $: currentBook = books[activeBook]?.name || ""
    $: currentChapter = chapters[activeChapter]?.number != null ? String(chapters[activeChapter].number) : ""
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

    // Auto-navigate to Genesis 1:1 when scripture loads
    let hasAutoNavigated = false
    $: if (books.length > 0 && !hasAutoNavigated && activeBook === -1) {
        hasAutoNavigated = true
        activeBook = 0
        activeChapter = 0

        const bookObj: any = books[0]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: 0 })
        }

        const bookChapters = bookObj?.chapters || []
        if (bookChapters.length > 0) {
            const chapterObj: any = bookChapters[0]
            if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
                send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: 0, chapterIndex: 0 })
            }
        }
    }

    // Autoscroll to active items
    $: if (activeBook >= 0) setTimeout(() => scrollToActive(booksScrollElem))
    $: if (activeChapter >= 0) setTimeout(() => scrollToActive(chaptersScrollElem))
    $: if (activeVerse > 0) setTimeout(() => scrollToActive(versesScrollElem, activeVerse))

    function scrollToActive(scrollElem: HTMLElement | null, _verseNum?: number) {
        if (!scrollElem) return
        const activeEl = scrollElem.querySelector(".isActive") as HTMLElement
        if (!activeEl) return

        const selectedElemTop = activeEl.offsetTop || 0
        const visibleElemPos = selectedElemTop - scrollElem.scrollTop
        if (visibleElemPos > 0 && visibleElemPos < scrollElem.offsetHeight) return

        scrollElem.scrollTo(0, Math.max(0, selectedElemTop - 70))
    }

    // COLORS - matching frontend implementation
    const colorCodesFull = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
    const colorCodesNT = [5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
    const colors = ["", "#f17d46", "#ffd17c", "#8cdfff", "#8888ff", "#ff97f2", "#ffdce7", "#88ffa9", "#ffd3b6"]

    export function getColorCode(books: any[], bookId: number | string) {
        let bookIndex = typeof bookId === "number" ? bookId : books.findIndex((a) => a.id === bookId)
        if (books.length === colorCodesFull.length) return colors[colorCodesFull[bookIndex]]
        else if (books.length === colorCodesNT.length) return colors[colorCodesNT[bookIndex]]
        return ""
    }

    // Generate dynamic colors for Bible versions that match FreeShow's theme
    // Uses HSL to create evenly distributed, vibrant colors on dark background
    function getVersionColor(index: number): string {
        // Start with FreeShow's secondary pink (330°), then distribute other hues evenly
        // Offset each subsequent color by golden angle (~137.5°) for good visual separation
        const goldenAngle = 137.508
        const baseHue = 330 // FreeShow's pink
        const hue = (baseHue + index * goldenAngle) % 360

        // High saturation (70-85%) and medium-high lightness (60-70%) for vibrant colors on dark bg
        const saturation = 75
        const lightness = 65

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }

    // Generate a subtle background color (same hue but very transparent)
    function getVersionBgColor(index: number): string {
        const goldenAngle = 137.508
        const baseHue = 330
        const hue = (baseHue + index * goldenAngle) % 360
        return `hsla(${hue}, 70%, 50%, 0.12)`
    }

    // NAMES - matching ScriptureContent.svelte
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
    export function playScripture(verseNumber?: number) {
        const vNum = verseNumber || activeVerse || 1
        if (activeBook < 0 || activeChapter < 0 || vNum <= 0) return

        const book = books[activeBook]
        const chapter = chapters[activeChapter]
        if (!book || !chapter) return

        const bookNumber = book.number ?? activeBook + 1
        const chapterNumber = chapter.number ?? activeChapter + 1
        send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${vNum}` })
    }

    // Click handler for verse
    function handleVerseClick(verseNumber: number) {
        activeVerse = verseNumber
        playScripture(verseNumber)
    }

    // NAVIGATION (for parent component compatibility)
    export const depth = 2 // Always show all columns in tablet mode

    export function goBack() {
        // In tablet mode, we don't navigate by depth
    }

    function getBookNumber(book: any): number {
        return typeof book?.number === "string" ? parseInt(book.number, 10) : (book?.number ?? 0)
    }

    function getChapterNumber(chapter: any): number {
        return typeof chapter?.number === "string" ? parseInt(chapter.number, 10) : (chapter?.number ?? 0)
    }

    export function navigateToVerse(bookNum: number, chapterNum: number) {
        const bookIndex = books.findIndex((b: any) => getBookNumber(b) === bookNum)
        if (bookIndex < 0) return

        activeBook = bookIndex
        const bookObj: any = books[bookIndex]
        const bookChapters = bookObj?.chapters || []

        let chapterIndex = bookChapters.findIndex((c: any) => c && getChapterNumber(c) === chapterNum)
        if (chapterIndex < 0) {
            chapterIndex = Math.max(0, chapterNum - 1)
        }
        activeChapter = chapterIndex
    }

    export function scrollToVerse(verseNum: number) {
        if (!versesScrollElem || verseNum <= 0) return
        const verseElements = versesScrollElem.querySelectorAll(".verse, span[id]")
        for (let i = 0; i < verseElements.length; i++) {
            const el = verseElements[i] as HTMLElement
            const elId = el.id || el.getAttribute("data-verse")
            if (Number(elId) === verseNum) {
                const containerRect = versesScrollElem.getBoundingClientRect()
                const elRect = el.getBoundingClientRect()
                const scrollTop = versesScrollElem.scrollTop + (elRect.top - containerRect.top) - containerRect.height / 2 + elRect.height / 2
                versesScrollElem.scrollTo({ top: scrollTop, behavior: "smooth" })
                break
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
    }

    function parseScriptureReference(reference: string): { bookIndex: number; chapterIndex: number; verseNumber: number } | null {
        if (!reference || !books?.length) return null

        const match = reference.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-\d+)?$/)
        if (!match) return null

        const [, bookName, chapterStr, versePart1, versePart2] = match
        const verseStr = versePart1 || versePart2
        if (!verseStr) return null

        const chapterNumber = parseInt(chapterStr, 10)
        const verseNumber = parseInt(verseStr, 10)
        const normalizedBookName = bookName.toLowerCase().trim()

        const bookIndex = books.findIndex((book) => {
            const normalizedName = book.name.toLowerCase()
            return normalizedName === normalizedBookName || normalizedName.includes(normalizedBookName) || normalizedBookName.includes(normalizedName)
        })

        if (bookIndex === -1) return null
        return { bookIndex, chapterIndex: chapterNumber - 1, verseNumber }
    }

    function extractScriptureFromSlide(): { bookIndex: number; chapterIndex: number; verseNumber: number } | null {
        if (!$outShow?.slides || $outSlide === null) return null
        const currentSlideId = Object.keys($outShow.slides)[$outSlide]
        if (!currentSlideId || !$outShow.slides[currentSlideId]) return null

        const slide = $outShow.slides[currentSlideId]
        if (!slide.items) return null

        for (const item of slide.items) {
            if (!item.lines || !Array.isArray(item.lines)) continue
            for (const line of item.lines) {
                if (!line.text || !Array.isArray(line.text)) continue
                for (const textItem of line.text) {
                    if (textItem && textItem.value && typeof textItem.value === "string") {
                        if (textItem.value.match(/^.+?\s+\d+(?:[:.,]\s*\d+|\s+\d+)/)) {
                            const parsed = parseScriptureReference(textItem.value)
                            if (parsed) return parsed
                        }
                    }
                }
            }
        }
        return null
    }

    $: if (scripture && Array.isArray(scripture.books) && $outShow && $outSlide !== null) {
        const slideScripture = extractScriptureFromSlide()
        if (slideScripture) {
            displayedBookIndex = slideScripture.bookIndex
            displayedChapterIndex = slideScripture.chapterIndex
            displayedVerseNumber = slideScripture.verseNumber
        }
    }

    $: if (displayedVerseNumber > 0 && displayedBookIndex >= 0 && displayedChapterIndex >= 0) {
        if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex) {
            if (activeVerse !== displayedVerseNumber) {
                activeVerse = displayedVerseNumber
            }
        }
    }

    export function forward() {
        if (displayedBookIndex >= 0 && displayedChapterIndex >= 0 && displayedVerseNumber > 0) {
            const displayedBook = books[displayedBookIndex]
            if (!displayedBook) return

            const bookNumber = displayedBook.number ?? displayedBookIndex + 1
            const displayedChapters = displayedBook.chapters || []
            const displayedChapter = displayedChapters[displayedChapterIndex]
            if (!displayedChapter) return

            const chapterNumber = displayedChapter.number ?? displayedChapterIndex + 1

            if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verses.length > 0) {
                const verseNumbers: number[] = verses.map((v: any, i: number) => {
                    const num = v?.number ?? i + 1
                    return typeof num === "string" ? parseInt(num, 10) : num
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

            if (activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verses.length > 0) {
                const verseNumbers: number[] = verses.map((v: any, i: number) => {
                    const num = v?.number ?? i + 1
                    return typeof num === "string" ? parseInt(num, 10) : num
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

    // TEXT FORMATTING - matching frontend
    function formatBibleText(text: string | undefined, asHtml: boolean = false) {
        if (!text) return ""
        text = text.replace(/!\{(.*?)\}!/g, asHtml ? '<span class="wj">$1</span>' : "$1")
        return removeTags(stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", ""))
    }
    function removeTags(text: string) {
        return text.replace(/(<([^>]+)>)/gi, "")
    }
    function stripMarkdown(input: string) {
        input = input.replace(/#\s*(.*?)\s*#/g, "")
        input = input.replace(/\*\{(.*?)\}\*/g, "")
        input = input.replace(/!\{(.*?)\}!/g, "$1")
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

<!-- Layout matches frontend Scripture.svelte grid/list mode -->
<div class="main scripture">
    <div class={$scriptureViewList ? "list" : "grid"}>
        <!-- Books column -->
        <div class="books" bind:this={booksScrollElem} class:center={!books?.length}>
            {#if books?.length}
                {#each books as book, i (book.number || i)}
                    {@const id = book.number?.toString() || String(i + 1)}
                    {@const color = getColorCode(books, i)}
                    {@const isActive = activeBook === i}
                    {@const isDisplayed = i === displayedBookIndex}
                    {@const displayName = $scriptureViewList ? book.name : getShortName(book.name, i)}

                    <span
                        {id}
                        class:isActive
                        class:isDisplayed
                        style="{color ? `border-${$scriptureViewList ? 'left' : 'bottom'}: 2px solid ${color};` : ''}{$scriptureViewList ? '' : 'border-radius: 2px;'}"
                        on:click={() => {
                            activeBook = i
                            activeChapter = 0
                            activeVerse = 0
                        }}
                        role="none"
                    >
                        {displayName}
                    </span>
                {/each}
            {:else}
                <Loading />
            {/if}
        </div>
        <div class="content">
            <!-- Chapters column -->
            <div class="chapters" bind:this={chaptersScrollElem} style="text-align: center;" class:center={!chapters?.length}>
                {#if chapters?.length}
                    {#each chapters as chapter, i (chapter.number || i)}
                        {@const chapterNum = chapter.number?.toString() || String(i + 1)}
                        {@const isActive = activeChapter === i}
                        {@const isDisplayed = activeBook === displayedBookIndex && i === displayedChapterIndex}

                        <span
                            id={chapterNum}
                            class:isActive
                            class:isDisplayed
                            on:click={() => {
                                activeChapter = i
                                activeVerse = 0
                            }}
                            role="none"
                        >
                            {chapter.number || i + 1}
                        </span>
                    {/each}
                {:else if activeBook >= 0}
                    <Loading />
                {/if}
            </div>
            <!-- Verses column -->
            <div class="verses" bind:this={versesScrollElem} class:center={!verses?.length}>
                {#if verses?.length}
                    {#each verses as verse, i (verse.number || i)}
                        {@const verseNumber = Number(verse.number) || i + 1}
                        {@const isActive = activeVerse === verseNumber}
                        {@const isDisplayed = activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verseNumber === displayedVerseNumber}
                        {@const text = formatBibleText(verse.text || verse.value, true)}

                        <span id={String(verseNumber)} class="verse" class:isActive class:isDisplayed class:wrapText={$scriptureWrapText} class:collection-verse={isCollection && $scriptureViewList && selectedTranslationIndex === null} on:click={() => handleVerseClick(verseNumber)} on:dblclick={() => handleVerseClick(verseNumber)} role="none">
                            <span class="v">{verseNumber}</span>
                            {#if $scriptureViewList}
                                {#if isCollection}
                                    {#if selectedTranslationIndex === null}
                                        <!-- Show all translations with colors -->
                                        <div class="collection-versions">
                                            {#each scriptures as scr, scrIndex}
                                                {@const scrVerse = scr.data?.books?.[activeBook]?.chapters?.[activeChapter]?.verses?.[i]}
                                                {@const verseText = scrVerse?.text || scrVerse?.value}
                                                <div class="version-item" style="--version-color: {getVersionColor(scrIndex)}; --version-bg: {getVersionBgColor(scrIndex)}">
                                                    {#if verseText}
                                                        <span class="version-text">{@html formatBibleText(verseText, true)}</span>
                                                    {:else}
                                                        <span class="version-text">...</span>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <!-- Show single translation as normal (no colors) -->
                                        {@const selectedScr = scriptures[selectedTranslationIndex]}
                                        {@const selectedVerse = selectedScr?.data?.books?.[activeBook]?.chapters?.[activeChapter]?.verses?.[i]}
                                        {@const selectedText = selectedVerse?.text || selectedVerse?.value || ""}
                                        {@html formatBibleText(selectedText, true) || "..."}
                                    {/if}
                                {:else}
                                    {@html text}
                                {/if}
                            {/if}
                        </span>
                    {/each}
                {:else if activeChapter >= 0}
                    <Loading />
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    /* Main container - matches frontend */
    .main {
        display: flex;
        height: 100%;
        width: 100%;
    }
    .main div {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        align-content: flex-start;
        position: relative;
        scroll-behavior: smooth;
    }
    .main div:not(.verses):not(.grid):not(.list):not(.list .content):not(.grid div) {
        border-inline-end: 2px solid var(--primary-lighter);
    }
    .main div:not(.grid):not(.list):not(.list .content):not(.grid div) {
        padding-bottom: 60px;
    }
    .main .verses {
        flex: 1;
        flex-flow: wrap;
    }

    .main div.center {
        display: flex;
        align-content: center;
        justify-content: center;
    }

    /* Span items - books, chapters, verses */
    .main span {
        padding: 4px 10px;
    }
    .main span.isActive {
        background-color: var(--focus);
        outline: none;
    }
    .main span.isDisplayed {
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
    }
    .main span:hover:not(.isActive):not(.v) {
        background-color: var(--hover);
    }
    .main span:focus,
    .main span:active:not(.isActive):not(.v) {
        background-color: var(--focus);
    }

    /* Verse styling */
    .main span.verse {
        width: 100%;
        padding: 4px 10px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    /* Wrap text mode - allows verses to have different heights */
    .main span.verse.wrapText {
        white-space: normal;
        text-overflow: initial;
        overflow: visible;
        line-height: 1.5;
        display: flex;
        align-items: flex-start;
    }
    .main span.verse.wrapText .v {
        flex-shrink: 0;
    }
    .main .list .v {
        color: var(--secondary);
        font-weight: bold;
        display: inline-block;
        width: 45px;
        margin-inline-end: 10px;
        text-align: center;
        white-space: nowrap;
    }

    /* Red letter text */
    .main :global(.wj) {
        color: #ff5050;
    }

    /* LIST MODE */
    .list {
        display: flex !important;
        flex-direction: row !important;
        width: 100%;
    }
    .list .content {
        display: flex;
        flex-direction: row;
        flex: 1;
    }

    /* GRID MODE - matches frontend exactly */
    .grid {
        display: flex;
        flex-direction: column;
    }
    .grid .books {
        border-bottom: 2px solid var(--primary-lighter);
    }
    .grid .chapters {
        border-inline-end: 2px solid var(--primary-lighter);
    }

    .grid .books,
    .grid .content {
        flex-direction: row;
        height: 50%;
    }
    .grid .chapters,
    .grid .verses {
        flex-direction: row;
        width: 50%;
    }

    .grid .books,
    .grid .chapters,
    .grid .verses {
        flex-wrap: wrap;
        align-content: normal;
    }

    .grid span {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 40px;
        flex: 1;
        font-weight: 600;
    }
    .grid .books span {
        min-width: 52px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
    }
    .grid .verses .v {
        display: contents;
    }

    /* Scrollbar styling */
    .main div::-webkit-scrollbar {
        width: 6px;
    }
    .main div::-webkit-scrollbar-track {
        background: rgb(255 255 255 / 0.05);
    }
    .main div::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.2);
        border-radius: 3px;
    }

    /* Collection multi-version display */
    .verse.collection-verse {
        display: block !important;
        flex: none !important;
        height: auto !important;
        min-height: 0 !important;
        padding: 2px 10px 2px 0 !important;
        margin: 0 !important;
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: unset !important;
    }

    .collection-versions {
        display: block !important;
        width: 100%;
        padding: 0 !important;
        margin: 2px 0 0 0 !important;
    }

    .version-item {
        display: block !important;
        padding: 3px 6px 3px 8px !important;
        margin: 0 0 2px 0 !important;
        border-left: 4px solid var(--version-color, var(--secondary));
        background: var(--version-bg, transparent);
        border-radius: 0 4px 4px 0;
        line-height: 1.2;
    }

    .version-item:last-child {
        margin-bottom: 0 !important;
    }

    .version-text {
        display: inline !important;
        font-size: 0.9em;
        line-height: 1.2;
        font-weight: normal;
        padding: 0 !important;
        margin: 0 !important;
    }
</style>

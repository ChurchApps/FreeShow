<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
    import { onDestroy } from "svelte"
    import { send } from "../../util/socket"
    import { currentScriptureState, scriptureViewList, outShow, outSlide } from "../../util/stores"

    export let id: string
    export let scripture: Bible
    export let scriptures: { id: string; data: any; name: string }[] = []
    export let isCollection: boolean = false
    export let tablet: boolean = false
    export let currentBook: string = ""
    export let currentChapter: string = ""
    export let currentVerse: string = ""

    // Generate dynamic colors for Bible versions that match FreeShow's theme
    function getVersionColor(index: number): string {
        const goldenAngle = 137.508
        const baseHue = 330 // FreeShow's pink
        const hue = (baseHue + index * goldenAngle) % 360
        const saturation = 75
        const lightness = 65
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }

    function getVersionBgColor(index: number): string {
        const goldenAngle = 137.508
        const baseHue = 330
        const hue = (baseHue + index * goldenAngle) % 360
        return `hsla(${hue}, 70%, 50%, 0.12)`
    }

    let activeBook = -1
    let activeChapter = -1
    let activeVerse = 0

    // Track what is displayed on output (separate from user's navigation position)
    let displayedBookIndex = -1
    let displayedChapterIndex = -1
    let displayedVerseNumber = 0
    let pendingVerseDepth = false // Used when navigating from search to wait for data load

    // Reference to verses container for scrolling
    let versesContainer: HTMLElement | null = null
    let previousViewList = $scriptureViewList

    $: books = scripture?.books || []
    $: chapters = books[activeBook]?.chapters || []
    $: if (depth === 1) {
        const bookObj: any = books[activeBook]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: activeBook })
        }
        // Also load book data for all scriptures in collection
        if (isCollection && scriptures.length > 1) {
            scriptures.forEach(scr => {
                if (scr.id === id) return // Skip primary, already loading
                const scrBooks = scr.data?.books || []
                const scrBook = scrBooks[activeBook]
                if (scrBook?.keyName && !(scrBook?.chapters?.length > 0)) {
                    send("GET_SCRIPTURE", { id: scr.id, bookKey: scrBook.keyName, bookIndex: activeBook })
                }
            })
        }
    }
    $: verses = chapters[activeChapter]?.verses || []
    $: if (depth === 2) {
        const bookObj: any = books[activeBook]
        const chapterObj: any = chapters[activeChapter]
        if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
        }
        // Also load chapter data for all scriptures in collection
        if (isCollection && scriptures.length > 1) {
            scriptures.forEach(scr => {
                if (scr.id === id) return // Skip primary, already loading
                const scrBooks = scr.data?.books || []
                const scrBook = scrBooks[activeBook]
                const scrChapters = scrBook?.chapters || []
                const scrChapter = scrChapters[activeChapter]
                if (scrBook?.keyName && scrChapter?.keyName && !(scrChapter?.verses?.length > 0)) {
                    send("GET_SCRIPTURE", { id: scr.id, bookKey: scrBook.keyName, chapterKey: scrChapter.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
                }
            })
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
    const unsubscribeScripture = currentScriptureState.subscribe(state => {
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
        let bookIndex = typeof bookId === "number" ? bookId : books.findIndex(a => a.id === bookId)

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
            const bNum = typeof b?.number === "string" ? parseInt(b.number, 10) : b?.number
            return (bNum ?? 0) === bookNum
        })
        if (bookIndex >= 0) {
            activeBook = bookIndex
            const bookObj: any = books[bookIndex]
            const chapters = bookObj?.chapters || []

            let chapterIndex = chapters.findIndex((c: any) => {
                if (!c) return false
                const cNum = typeof c.number === "string" ? parseInt(c.number, 10) : c.number
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

    // Scroll to a specific verse in list mode
    export function scrollToVerse(verseNum: number) {
        if (!versesContainer || verseNum <= 0) return

        // Find the verse button with the specified verse number
        const verseButtons = versesContainer.querySelectorAll(".verse-button")
        for (let i = 0; i < verseButtons.length; i++) {
            const button = verseButtons[i] as HTMLElement
            const verseSpan = button.querySelector("span")
            if (verseSpan && Number(verseSpan.textContent?.trim()) === verseNum) {
                // Scroll the container to show the button
                const containerRect = versesContainer.getBoundingClientRect()
                const buttonRect = button.getBoundingClientRect()
                const scrollTop = versesContainer.scrollTop + (buttonRect.top - containerRect.top) - containerRect.height / 2 + buttonRect.height / 2
                versesContainer.scrollTo({ top: scrollTop, behavior: "smooth" })
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

        const bookIndex = books.findIndex(book => {
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

    // Auto-scroll to displayed verse when switching from grid to list view
    $: if (depth === 2 && $scriptureViewList && !previousViewList && displayedVerseNumber > 0 && versesContainer && verses.length > 0) {
        // Wait for DOM to update, then scroll
        setTimeout(() => {
            if (!versesContainer) return

            // Find the verse button with the displayed verse number
            const verseButtons = versesContainer.querySelectorAll(".verse-button")
            for (let i = 0; i < verseButtons.length; i++) {
                const button = verseButtons[i] as HTMLElement
                const verseSpan = button.querySelector("span")
                if (verseSpan && Number(verseSpan.textContent?.trim()) === displayedVerseNumber) {
                    // Scroll the container to show the button
                    const containerRect = versesContainer.getBoundingClientRect()
                    const buttonRect = button.getBoundingClientRect()
                    const scrollTop = versesContainer.scrollTop + (buttonRect.top - containerRect.top) - containerRect.height / 2 + buttonRect.height / 2
                    versesContainer.scrollTo({ top: scrollTop, behavior: "smooth" })
                    break
                }
            }
        }, 150)
        previousViewList = $scriptureViewList
    } else {
        previousViewList = $scriptureViewList
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

            // Use loaded verses if available, otherwise decrement verse number
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
<div class="grid">
    {#if depth === 0}
        <div class="books">
            {#if books?.length}
                {#key books}
                    {#each books as book, i (book.number || i)}
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
                            on:keydown={e =>
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

    {#if depth === 1}
        <div class="chapters context #scripture_chapter" style="text-align: center;" class:center={!chapters?.length}>
            {#if chapters?.length}
                {#each chapters as chapter, i (chapter.number || i)}
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
                        on:keydown={e =>
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

    {#if depth === 2 || tablet || $scriptureViewList}
        <div bind:this={versesContainer} class="verses context #scripture_verse" class:center={!verses.length} class:big={verses.length > 100} class:list={$scriptureViewList} class:collection-list={isCollection && $scriptureViewList}>
            {#if verses.length}
                {#each verses as verse, i (verse.number || i)}
                    {@const verseNumber = Number(verse.number) || i + 1}
                    {@const isDisplayed = activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && verseNumber === displayedVerseNumber}
                    {@const isActive = activeVerse === verseNumber}
                    {#if tablet && i === Math.max(0, verses.length - 6)}
                        <div style="float: right; width: 220px; height: 80px;"></div>
                    {/if}

                    <button type="button" class="verse-button" class:collection-verse={isCollection && $scriptureViewList} on:click={() => playScripture(verseNumber)} on:keydown={e => e.key === "Enter" && playScripture(verseNumber)} class:active={isActive} class:displayed={isDisplayed}>
                        <span class="verse-num" style="color: var(--secondary);font-weight: bold;">
                            {verseNumber}
                        </span>
                        {#if $scriptureViewList}
                            {#if isCollection}
                                <!-- Show all scriptures, even if only one has loaded -->
                                <div class="collection-versions">
                                    {#each scriptures as scr, scrIndex}
                                        {@const scrVerse = scr.data?.books?.[activeBook]?.chapters?.[activeChapter]?.verses?.[i]}
                                        {@const verseText = scrVerse?.text || scrVerse?.value || ""}
                                        <div class="version-item" style="--version-color: {getVersionColor(scrIndex)}; --version-bg: {getVersionBgColor(scrIndex)}">
                                            <span class="version-text">{verseText ? formatBibleText(verseText) : "..."}</span>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                {formatBibleText(verse.text || verse.value)}
                            {/if}
                        {/if}
                    </button>
                {/each}
            {:else}
                <Loading />
            {/if}
        </div>
    {/if}
</div>

<style>
    /* GRID MODE */

    .grid {
        display: flex;
        flex-direction: column;
        height: 100%;
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

    .grid .books {
        flex-direction: row;
        height: 100%;
    }
    .grid .chapters,
    .grid .verses {
        flex-direction: row;
        height: 100%;
    }

    .grid .books,
    .grid .chapters,
    .grid .verses {
        flex-wrap: wrap;
        align-content: normal;
        gap: 0;
    }

    .grid .verses.list {
        flex-direction: column;
        flex-wrap: nowrap;
        padding: 0 12px 0 8px;
    }

    .grid .verse-button,
    .grid span {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.3em;
        font-weight: 600;
        /* min-width: 40px; */
        min-width: 50px;
        flex: 1;
        padding: 0;
        margin: 0;
    }
    .grid .verses.list .verse-button {
        align-items: unset;
        justify-content: unset;
        padding: 10px 0;
        gap: 12px;
    }

    .grid .verses.list .verse-button span {
        flex-shrink: 0;
        min-width: 40px;
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
        font-weight: bold;
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

    .grid .chapters span,
    .grid .verses .verse-button span {
        font-weight: bold;
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
        position: relative;
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
    }

    .grid .verses.list .displayed {
        background-color: transparent;
        box-shadow: none;
    }

    .grid .verses.list .displayed::after {
        content: "";
        position: absolute;
        left: -4px; /* Start a bit before the verse number */
        right: -4px;
        top: 0;
        bottom: 0;
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
        z-index: -1;
    }

    /* Collection multi-version display - needs high specificity to override grid styles */
    .grid .verses.list.collection-list {
        flex-direction: column !important;
        flex-wrap: nowrap !important;
        align-content: flex-start !important;
    }

    .grid .verses.list.collection-list .verse-button.collection-verse {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        flex: 0 0 auto !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
        padding: 10px 12px !important;
        gap: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .grid .verses.list.collection-list .verse-button.collection-verse .verse-num {
        width: auto !important;
        max-width: none !important;
        height: auto !important;
        min-width: 30px !important;
        flex: none !important;
        flex-shrink: 0 !important;
    }

    .grid .verses.list.collection-list .collection-versions {
        display: flex !important;
        flex-direction: column !important;
        flex: none !important;
        gap: 4px;
        width: 100%;
        max-width: 100% !important;
    }

    .grid .verses.list.collection-list .version-item {
        display: block !important;
        flex: none !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        padding: 6px 10px 6px 12px !important;
        border-left: 4px solid var(--version-color, var(--secondary));
        background: var(--version-bg, transparent);
        border-radius: 0 6px 6px 0;
        line-height: 1.3;
    }

    .grid .verses.list.collection-list .version-item .version-text {
        display: block !important;
        max-width: none !important;
        width: 100% !important;
        min-width: 0 !important;
        font-size: 0.95em;
        font-weight: normal;
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
    }

    /* Override the 50px max-width for spans in collection list */
    .grid .verses.list.collection-list span {
        max-width: none !important;
    }

    .grid .verses.list.collection-list .verse-num {
        max-width: 50px !important;
        min-width: 30px !important;
        flex-shrink: 0 !important;
    }
</style>

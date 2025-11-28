<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
    import { onDestroy } from "svelte"
    import { send } from "../../util/socket"
    import { currentScriptureState, scriptureViewList, outShow, outSlide, resized } from "../../util/stores"

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
    $: if (depth === 1 || (tablet && activeBook >= 0)) {
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
    $: if (depth === 2 || (tablet && activeChapter >= 0)) {
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

    // Auto-navigate to Genesis 1:1 in tablet mode when scripture loads
    let hasAutoNavigated = false
    $: if (tablet && books.length > 0 && !hasAutoNavigated && activeBook === -1) {
        hasAutoNavigated = true
        // Navigate to first book (Genesis), first chapter
        activeBook = 0
        activeChapter = 0
        
        // Request chapter data if not loaded
        const bookObj: any = books[0]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: 0 })
        }
        
        // Request verse data if chapter is already loaded
        const chapters = bookObj?.chapters || []
        if (chapters.length > 0) {
            const chapterObj: any = chapters[0]
            if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
                send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: 0, chapterIndex: 0 })
            }
        }
    }

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

    export function playScripture(verseNumber?: number) {
        const vNum = verseNumber || displayedVerseNumber
        if (activeBook < 0 || activeChapter < 0 || vNum <= 0) return

        const book = books[activeBook]
        const chapter = chapters[activeChapter]
        if (!book || !chapter) return

        const bookNumber = book.number ?? activeBook + 1
        const chapterNumber = chapter.number ?? activeChapter + 1
        send("API:start_scripture", { id, reference: `${bookNumber}.${chapterNumber}.${vNum}` })
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

<!-- LIST/GRID MODE -->
<div class={$scriptureViewList ? "list" : "grid"}>
    {#if depth === 0 || tablet || $scriptureViewList}
        <div class="books" class:center={!books?.length}>
            {#if books?.length}
                {#key books}
                    {#each books as book, i (book.number || i)}
                        <!-- this uses index instead of number! -->
                        {@const bookUiId = i + 1}
                        {@const color = getColorCode(books, i)}
                        {@const name = $scriptureViewList ? book.name : getShortName(book.name, i)}

                        <span
                            id={bookUiId.toString()}
                            role="button"
                            tabindex="0"
                            on:mousedown={() => {
                                activeBook = i
                                activeChapter = -1
                                activeVerse = 0
                                if (!tablet && !$scriptureViewList) depth++
                            }}
                            on:keydown={e =>
                                e.key === "Enter" &&
                                (() => {
                                    activeBook = i
                                    activeChapter = -1
                                    activeVerse = 0
                                    if (!tablet && !$scriptureViewList) depth++
                                })()}
                            class:active={activeBook === i}
                            class:displayed={i === displayedBookIndex}
                            class:output={i === displayedBookIndex}
                            style="{color ? `border-${$scriptureViewList ? 'left' : 'bottom'}: 2px solid ${color};` : ''}{$scriptureViewList ? '' : 'border-radius: 2px;'}"
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

    <div class="content">
        {#if depth === 1 || tablet || $scriptureViewList}
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
                                if (!tablet && !$scriptureViewList) depth++
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
                                    if (!tablet && !$scriptureViewList) depth++
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
</div>

<style>
    /* LIST MODE */

    .list {
        display: flex !important;
        flex-direction: row !important;
        width: 100%;
        height: 100%;
    }
    .list .content {
        display: flex;
        flex-direction: row;
        flex: 1;
    }

    /* GRID MODE */

    .grid {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
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
    .grid .content {
        display: flex;
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

    /* COMMON */

    .books, .chapters, .verses {
        display: flex;
        overflow-y: auto;
        overflow-x: hidden;
        align-content: flex-start;
        position: relative;
        scroll-behavior: smooth;
        padding: 0;
        margin: 0;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin;
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track,
    ::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    ::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .grid span {
        display: inline-block;
        text-align: center;
        vertical-align: middle;
        min-width: 40px;
        width: auto;
        flex: none;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .grid .books span {
        min-width: 52px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
        display: block;
    }
    .grid .verses span {
        color: var(--secondary);
        font-weight: bold;
    }

    /* List specific styling */
    .list .books {
        width: auto;
        flex-direction: column;
        min-width: 150px;
    }
    .list .chapters {
        width: auto;
        flex-direction: column;
        min-width: 80px;
    }
    .list .verses {
        flex: 1;
        flex-direction: column;
    }

    .list span {
        padding: 4px 10px;
        cursor: pointer;
    }
    
    .list .verse-button {
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 10px;
        gap: 12px;
        background: transparent;
        border: none;
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
        width: 100%;
    }
    .list .verse-button span {
        flex-shrink: 0;
        min-width: 40px;
        width: 40px !important;
    }

    /* Active/Hover states */
    span.active,
    .verse-button.active {
        background-color: var(--focus);
    }
    span:hover:not(.active),
    .verse-button:hover:not(.active) {
        background-color: var(--hover);
    }

    /* Highlight currently displayed scripture */
    .output, .displayed {
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
    }
    .list .displayed {
        background-color: transparent;
        box-shadow: none;
        position: relative;
    }
    .list .displayed::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
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

<script lang="ts">
    import type { Bible } from "../../../../types/Bible"
    import Loading from "../../../common/components/Loading.svelte"
        import { onDestroy } from "svelte"
    import { send } from "../../util/socket"
    import { currentScriptureState, scriptureViewList } from "../../util/stores"
 

    export let id: string
    export let scripture: Bible
    export let tablet: boolean = false
    export let currentBook: string = ""
    export let currentChapter: string = ""
    export let currentVerse: string = ""

    let activeBook = -1
    let activeChapter = -1
    let activeVerse = 0

    // Track what is actually displayed on the output
    let displayedBookIndex = -1
    let displayedChapterIndex = -1
    let displayedVerseNumber = 0

    $: books = scripture?.books || []
    $: chapters = books[activeBook]?.chapters || []
    $: if (depth === 1) {
        // If we entered chapters for an API bible and chapters are missing, request them once
        const bookObj: any = books[activeBook]
        if (bookObj?.keyName && !(bookObj?.chapters?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, bookIndex: activeBook })
        }
    }
    $: verses = chapters[activeChapter]?.verses || []
    $: if (depth === 2) {
        // If we entered verses for an API bible and verses are missing, request them once
        const bookObj: any = books[activeBook]
        const chapterObj: any = chapters[activeChapter]
        if (bookObj?.keyName && chapterObj?.keyName && !(chapterObj?.verses?.length > 0)) {
            send("GET_SCRIPTURE", { id, bookKey: bookObj.keyName, chapterKey: chapterObj.keyName, bookIndex: activeBook, chapterIndex: activeChapter })
        }
    }

    // Update current location strings for parent component based on where we are visiting (browsing)
    $: currentBook = books[activeBook]?.name || ""
    $: currentChapter = (() => {
        const num = chapters[activeChapter]?.number
        return num !== undefined && num !== null ? String(num) : ""
    })()
    $: currentVerse = activeVerse > 0 ? String(activeVerse) : ""

    // Update local state when scripture state changes from main app (normalized shape)
    let applyTimer: ReturnType<typeof setTimeout> | null = null
    const unsubscribeScripture = currentScriptureState.subscribe((state) => {
        if (!state) return
        // Debounce to coalesce quick consecutive updates (prevents transient wrong labels)
        if (applyTimer) clearTimeout(applyTimer)
        applyTimer = setTimeout(() => {
            const bookIndex = state.bookId
            const chapterIndex = state.chapterId
            const verseList = state.activeVerses

            // Capture the latest incoming state (coalesced within debounce)
            const hasBook = Number.isInteger(bookIndex) && bookIndex >= 0
            const hasChapter = Number.isInteger(chapterIndex) && chapterIndex >= 0
            const latestVerse = Array.isArray(verseList) && verseList.length > 0
                ? parseInt(String(verseList[verseList.length - 1]), 10)
                : 0
            const hasVerse = Number.isFinite(latestVerse) && latestVerse > 0

            const sameBook = hasBook ? bookIndex === displayedBookIndex : true
            const sameChapter = hasChapter ? chapterIndex === displayedChapterIndex : true
            const safeToApplyAll = hasBook && hasChapter && hasVerse

            // opportunistically accept partial updates for book/chapter to keep display in sync
            if (hasBook && displayedBookIndex !== bookIndex) displayedBookIndex = bookIndex
            if (hasChapter && displayedChapterIndex !== chapterIndex) displayedChapterIndex = chapterIndex

            // Case 1: within the same chapter, only verse changed → update verse immediately
            if (hasVerse && sameBook && sameChapter) {
                displayedVerseNumber = latestVerse
                if (depth === 2) activeVerse = latestVerse
                return
            }

            // Case 2: full change (book + chapter + verse) arrived together → apply atomically
            if (safeToApplyAll) {
                // Update displayed indices (reflect what's on output)
                displayedBookIndex = bookIndex
                displayedChapterIndex = chapterIndex
                displayedVerseNumber = latestVerse

                // Only update active browsing selection when already at verse depth
                if (depth === 2) {
                    activeBook = bookIndex
                    activeChapter = chapterIndex
                    activeVerse = latestVerse
                }
                return
            }

            // Otherwise, wait for missing parts (no forced depth change)
        }, 260)
    })
    onDestroy(() => {
        unsubscribeScripture()
        if (applyTimer) clearTimeout(applyTimer)
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
        activeVerse = verseNumber
        // chapters[activeChapter]?.number ??
        send("API:start_scripture", { id, reference: `${books[activeBook]?.number ?? activeBook + 1}.${activeChapter + 1}.${activeVerse}` })
    }

    // NAVIGATION

export let depth = 0

export function goBack() {
        if (depth > 0) {
            // Preserve activeVerse so highlight remains when returning to verse depth
            if (depth === 1) {
                // leaving chapters -> books: clear chapter selection
                activeChapter = -1
                // When going back from chapters, highlight the current book
                if (displayedBookIndex >= 0) activeBook = displayedBookIndex
            } else if (depth === 2) {
                // leaving verses -> chapters: preserve displayed chapter highlight
                activeVerse = 0
                // When going back from verses, highlight the current chapter and book
                if (displayedBookIndex >= 0) activeBook = displayedBookIndex
                if (displayedChapterIndex >= 0) activeChapter = displayedChapterIndex
            }
            depth--
        }
    }

    // Reset internal selection when the bound scripture object changes (e.g. API <-> local)
    $: if (!scripture || !Array.isArray(scripture.books)) {
        activeBook = -1
        activeChapter = -1
        activeVerse = 0
        displayedBookIndex = -1
        displayedChapterIndex = -1
        displayedVerseNumber = 0
        depth = 0
    }

    // Parse scripture reference from slide content and extract highlighting info
    function parseScriptureReference(reference: string): { bookIndex: number, chapterIndex: number, verseNumber: number } | null {
        if (!reference || !books || books.length === 0) return null
        
        // Match patterns like "Genesis 1:1", "1 John 2:3", "Psalm 23:1-6", etc.
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/)
        if (!match) return null
        
        const [, bookName, chapterStr, verseStr] = match
        const chapterNumber = parseInt(chapterStr, 10)
        const verseNumber = parseInt(verseStr, 10)
        
        // Find the book by name (case insensitive) in the current scripture collection
        const bookIndex = books.findIndex(book => {
            // Try exact match first
            if (book.name.toLowerCase() === bookName.toLowerCase().trim()) {
                return true
            }
            
            // Try matching common book name variations
            const normalizedBookName = bookName.toLowerCase().trim()
            const normalizedScriptureName = book.name.toLowerCase()
            
            // Handle common abbreviations and variations
            const commonMappings: { [key: string]: string[] } = {
                'genesis': ['gen', 'ge'],
                '1 john': ['1john', '1 jn', 'i john'],
                '2 john': ['2john', '2 jn', 'ii john'],
                '3 john': ['3john', '3 jn', 'iii john'],
                'psalms': ['psalm', 'ps'],
                'revelation': ['rev', 're'],
                'matthew': ['matt', 'mt'],
                'mark': ['mk'],
                'luke': ['lk'],
                'john': ['jn'],
                // Add more mappings as needed
            }
            
            // Check if the scripture book name matches any variations of the reference book name
            for (const [canonical, variations] of Object.entries(commonMappings)) {
                if (canonical === normalizedScriptureName || variations.includes(normalizedScriptureName)) {
                    if (canonical === normalizedBookName || variations.includes(normalizedBookName)) {
                        return true
                    }
                }
            }
            
            // Try partial match as fallback
            return normalizedScriptureName.includes(normalizedBookName) || 
                   normalizedBookName.includes(normalizedScriptureName)
        })
        
        if (bookIndex === -1) {
            return null
        }
        
        // Convert chapter number to chapter index (chapters are 0-based arrays)
        const chapterIndex = chapterNumber - 1
        
        return { bookIndex, chapterIndex, verseNumber }
    }

    // Extract scripture reference from outShow slide content
    function extractScriptureFromSlide(): { bookIndex: number, chapterIndex: number, verseNumber: number } | null {
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
                    if (textItem && textItem.value && typeof textItem.value === 'string') {
                        // Check if this looks like a scripture reference
                        if (textItem.value.match(/^.+?\s+\d+:\d+/)) {
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

    // Initialize highlighting from slide content when scripture state is empty
    $: if (scripture && Array.isArray(scripture.books) && 
           displayedBookIndex === -1 && displayedChapterIndex === -1 && displayedVerseNumber === 0 &&
           $outShow && $outSlide !== null) {
        
        const slideScripture = extractScriptureFromSlide()
        if (slideScripture) {
            displayedBookIndex = slideScripture.bookIndex
            displayedChapterIndex = slideScripture.chapterIndex
            displayedVerseNumber = slideScripture.verseNumber
        }
            }
    // This ensures that when user reloads the page and a verse is already active, 
    // the navigation will show the correct highlights when they browse back
    $: if (scripture && Array.isArray(scripture.books) && displayedBookIndex >= 0 && depth === 0) {
        // At depth 0 (books view), always ensure activeBook matches displayedBookIndex
        if (activeBook !== displayedBookIndex) {
            activeBook = displayedBookIndex
            if (displayedChapterIndex >= 0) {
                activeChapter = displayedChapterIndex
            }
            if (displayedVerseNumber > 0) {
                activeVerse = displayedVerseNumber
            }
        }
    }
    
    import { outShow, outSlide } from "../../util/stores"

    // NAV CONTROLS: navigate to next/previous chapter or verse
    export function forward() {
        // If a verse is highlighted at verse-level, move to next verse
        if (depth === 2 && activeVerse > 0) {
            const verseNumbers: number[] = verses.map((v: any, i: number) => (v?.number ?? i + 1))
            const currentIndex = verseNumbers.indexOf(activeVerse)
            if (currentIndex >= 0 && currentIndex < verseNumbers.length - 1) {
                activeVerse = verseNumbers[currentIndex + 1]
            } else if (verseNumbers.length > 0) {
                activeVerse = verseNumbers[verseNumbers.length - 1]
            }
            return
        }
        // Otherwise move to next chapter (when at or viewing verse/chapter level)
        if (depth >= 1) {
            const totalChapters = chapters.length
            if (totalChapters > 0) activeChapter = Math.min(Math.max(activeChapter, 0) + 1, totalChapters - 1)
        }
    }

    export function backward() {
        // If a verse is highlighted at verse-level, move to previous verse
        if (depth === 2 && activeVerse > 0) {
            const verseNumbers: number[] = verses.map((v: any, i: number) => (v?.number ?? i + 1))
            const currentIndex = verseNumbers.indexOf(activeVerse)
            if (currentIndex > 0) {
                activeVerse = verseNumbers[currentIndex - 1]
            } else if (verseNumbers.length > 0) {
                activeVerse = verseNumbers[0]
            }
            return
        }
        // Otherwise move to previous chapter
        if (depth >= 1) {
            const totalChapters = chapters.length
            if (totalChapters > 0) activeChapter = Math.max(Math.min(activeChapter, totalChapters - 1) - 1, 0)
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
                                activeVerse = 0
                                activeChapter = -1
                                activeBook = i
                                depth++
                            }}
                        on:keydown={(e) => e.key === 'Enter' && (() => { activeVerse = 0; activeChapter = -1; activeBook = i; depth++; })()}
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
                            // Only reset verse highlight when switching to a different chapter
                            if (activeChapter !== i) activeVerse = 0
                            activeChapter = i
                            depth++
                        }}
                        on:keydown={(e) => e.key === 'Enter' && (() => { if (activeChapter !== i) activeVerse = 0; activeChapter = i; depth++; })()}
                    class:active={activeChapter === i}
                    class:displayed={i === displayedChapterIndex && activeBook === displayedBookIndex}
                    class:output={i === displayedChapterIndex && activeBook === displayedBookIndex}
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
                    {@const id = Number(verse.number) || i + 1}
                    {@const isDisplayed = activeBook === displayedBookIndex && activeChapter === displayedChapterIndex && id === displayedVerseNumber}
                    {@const isActive = activeVerse == id}
                    <button type="button" class="verse-button" on:click={() => playScripture(id)} on:keydown={(e) => e.key === 'Enter' && playScripture(id)} class:active={isActive} class:displayed={isDisplayed}>
                        <span style="width: 100%;height: 100%;color: var(--secondary);font-weight: bold;">
                            {id}
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
    .grid div::-webkit-scrollbar { width: 8px; height: 8px; }
    .grid div::-webkit-scrollbar-track,
    .grid div::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    .grid div::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    .grid div::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }

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
    .grid .verses.list::-webkit-scrollbar { width: 8px; height: 8px; }
    .grid .verses.list::-webkit-scrollbar-track,
    .grid .verses.list::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    .grid .verses.list::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    .grid .verses.list::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }

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
    /* Distinguish displayed reference vs browsing selection at verse depth */
    .grid .verses .displayed {
        background-color: var(--focus);
        box-shadow: inset 0 0 0 2px var(--secondary);
        border-radius: 6px;
    }
</style>

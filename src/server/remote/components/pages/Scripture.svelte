<script lang="ts">
    import { tick, createEventDispatcher } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loading from "../../../common/components/Loading.svelte"
    import { keysToID } from "../../../common/util/helpers"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, scriptureCache, scriptures, scriptureSearchResults, scriptureViewList, scriptureWrapText, outSlide, outShow, openedScripture, collectionId } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import ScriptureContent from "./ScriptureContent.svelte"
    import { sanitizeVerseText } from "../../../../common/scripture/sanitizeVerseText"
    import ScriptureContentTablet from "./ScriptureContentTablet.svelte"

    export let tablet: boolean = false
    export let searchValueFromDrawer: string = ""

    const dispatch = createEventDispatcher<{ "search-clear": void }>()

    function checkScriptureExists(scriptureId: string, collId: string): boolean {
        if (!scriptureId || Object.keys($scriptures).length === 0) return false
        return !!($scriptures[scriptureId] || (collId && $scriptures[collId]))
    }

    $: scripturesLoaded = Object.keys($scriptures).length > 0

    // Validate stored scripture ID and reset if invalid (prevents infinite loading on first launch)
    $: if (scripturesLoaded && $openedScripture && !checkScriptureExists($openedScripture, $collectionId)) {
        openScripture("", "")
    }

    // Request scripture data only if it exists in store
    $: if ($openedScripture && checkScriptureExists($openedScripture, $collectionId) && !$scriptureCache[$openedScripture]) {
        send("GET_SCRIPTURE", { id: $openedScripture })
    }

    let depthBeforeSearch = 0
    let depth = 0
    let scriptureContentRef: any
    let currentBook = ""
    let currentChapter = ""
    let currentVerse = ""

    function openScripture(id: string, collection: string = "") {
        openedScripture.set(id)
        collectionId.set(collection)
        // reset browsing state when switching between bibles (API/local)
        depth = 0
        currentBook = ""
        currentChapter = ""
        currentVerse = ""
        localStorage.setItem("scripture", id)
        localStorage.setItem("collectionId", collection)
    }

    const iconForScripture = (item: any) => (item.api ? "scripture_alt" : item.collection ? "collection" : "scripture")
    const sortByName = (list: any[]) =>
        list.slice().sort((a: any, b: any) => {
            const nameA = (a.customName || a.name || "").toLowerCase()
            const nameB = (b.customName || b.name || "").toLowerCase()
            return nameA.localeCompare(nameB)
        })

    function selectScripture(scripture: any) {
        const collection = scripture.collection
        const id = scripture.id
        openScripture(collection ? collection.versions[0] : id, collection ? id : "")
    }


    function autoOpenDefaultScripture() {
        // Priority: favorites > local bibles > collections > api bibles
        const defaultScripture = favoritesList[0] || localBibles[0] || collectionList[0] || apiBibles[0]
        if (defaultScripture) {
            selectScripture(defaultScripture)
            // Auto-navigate to Genesis 1:1 (first book, first chapter) in tablet mode
            setTimeout(() => {
                if (scriptureContentRef?.navigateToVerse) {
                    scriptureContentRef.navigateToVerse(1, 1)
                }
            }, 100)
        }
    }


    $: scriptureEntries = keysToID($scriptures).map((a: any) => ({ ...a, icon: iconForScripture(a) }))
    $: favoritesList = sortByName(scriptureEntries.filter(a => a.favorite))
    $: favoriteIds = new Set(favoritesList.map(a => a.id))
    $: collectionList = sortByName(scriptureEntries.filter(a => a.collection && !favoriteIds.has(a.id)))
    $: localBibles = sortByName(scriptureEntries.filter(a => !a.collection && !a.api && !favoriteIds.has(a.id)))
    $: apiBibles = sortByName(scriptureEntries.filter(a => !a.collection && a.api && !favoriteIds.has(a.id)))

    type ScriptureSection = {
        id: string
        labelKey: string
        items: any[]
        apiDividerIndex?: number
    }

    $: scriptureSections = ([favoritesList.length ? { id: "favorites", labelKey: "category.favourites", items: favoritesList } : null, collectionList.length ? { id: "collections", labelKey: "scripture.collections", items: collectionList } : null, localBibles.length || apiBibles.length ? { id: "local", labelKey: "scripture.bibles_section", items: [...localBibles, ...apiBibles], apiDividerIndex: localBibles.length } : null] as (ScriptureSection | null)[]).filter((section): section is ScriptureSection => Boolean(section))

    // Auto-open default scripture in tablet mode when none is selected
    $: if (tablet && scripturesLoaded && !$openedScripture && scriptureEntries.length > 0) {
        autoOpenDefaultScripture()
    }

    function isActiveScripture(scripture: any): boolean {
        if (!scripture) return false
        if (scripture.collection) return $collectionId === scripture.id
        return !$collectionId && $openedScripture === scripture.id
    }

    function next() {
        scriptureContentRef?.forward?.()
    }
    function previous() {
        scriptureContentRef?.backward?.()
    }

    // UI control visibility
    $: showControlsBar = depth === 2 || !$isCleared.all
    $: showPrevNext = depth !== 2 || +currentVerse > 0 || ($isCleared.all ? $outShow && $outSlide !== null : false)

    // SEARCH

    function openSearchPanel() {
        depthBeforeSearch = depth
        openScriptureSearch = true
    }

    function closeSearch(skipExternalDispatch: boolean = false) {
        openScriptureSearch = false
        searchValue = ""
        // Clear search results
        searchResults = []
        searchResult = { reference: "", referenceFull: "", verseText: "" }
        scriptureSearchResults.set(null)
        // Restore depth to where user was before search
        // Only reset if scripture data isn't loaded
        if ($openedScripture && !$scriptureCache[$openedScripture]) {
            send("GET_SCRIPTURE", { id: $openedScripture })
            depth = 0
        } else {
            depth = depthBeforeSearch
        }

        if (usingExternalSearch) {
            if (!skipExternalDispatch) {
                awaitingExternalClear = true
                dispatch("search-clear")
            }
            usingExternalSearch = false
        }
    }

    let openScriptureSearch = false
    let searchValue = ""
    let searchInput: HTMLInputElement | null = null
    type SearchItem = { reference: string; referenceFull: string; verseText: string }
    let searchResults: SearchItem[] = []
    let searchResult: SearchItem = { reference: "", referenceFull: "", verseText: "" }
    let isApiBible = false
    let usingExternalSearch = false
    let awaitingExternalClear = false

    // Track failed chapter requests to prevent infinite retries
    const failedChapterRequests = new Set<string>()

    // Clear failed requests when search changes or scripture changes
    $: if (searchValue || $openedScripture) {
        if (searchValue.trim() === "") {
            failedChapterRequests.clear()
        }
    }

    $: isApiBible = !!($openedScripture && $scriptures[$openedScripture]?.api === true)
    $: updateSearch(searchValue, $scriptureCache, $openedScripture, isApiBible)
    $: handleApiSearchResults($scriptureSearchResults, searchValue, $openedScripture)
    $: updateSearchResultsWithLoadedVerses($scriptureCache, searchResults, $openedScripture)

    // Auto-focus search input when search is opened
    $: if (tablet) {
        const trimmedExternal = (searchValueFromDrawer || "").trim()
        if (trimmedExternal) {
            if (!awaitingExternalClear) {
                if (!openScriptureSearch) {
                    openSearchPanel()
                }
                usingExternalSearch = true
                if (searchValue !== trimmedExternal) {
                    searchValue = trimmedExternal
                }
            }
        } else {
            awaitingExternalClear = false
            if (usingExternalSearch) {
                usingExternalSearch = false
                if (openScriptureSearch) {
                    closeSearch(true)
                }
            }
        }
    }

    $: if (openScriptureSearch && !usingExternalSearch) {
        focusSearchInput()
    }

    async function focusSearchInput() {
        await tick()
        if (!searchInput) return
        searchInput.focus({ preventScroll: true })
        searchInput.select()
    }

    function formatBookSearch(search: string): string {
        return search
            .toLowerCase()
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(/[áàâã]/g, "a")
            .replace(/[éèê]/g, "e")
            .replace(/[íìî]/g, "i")
            .replace(/[óòôõ]/g, "o")
            .replace(/[úùû]/g, "u")
            .replace(/ç/g, "c")
    }

    // Common biblical book abbreviations
    const BOOK_ABBREVIATIONS: Record<string, string> = {
        jh: "john",
        jn: "john",
        jo: "john",
        gen: "genesis",
        ex: "exodus",
        exo: "exodus",
        lev: "leviticus",
        num: "numbers",
        deut: "deuteronomy",
        dt: "deuteronomy",
        josh: "joshua",
        judg: "judges",
        ru: "ruth",
        sam: "samuel",
        "1sam": "1samuel",
        "2sam": "2samuel",
        kg: "kings",
        kgs: "kings",
        "1kg": "1kings",
        "1kgs": "1kings",
        "2kg": "2kings",
        "2kgs": "2kings",
        chr: "chronicles",
        "1chr": "1chronicles",
        "2chr": "2chronicles",
        ezr: "ezra",
        neh: "nehemiah",
        est: "esther",
        ps: "psalms",
        psa: "psalms",
        prov: "proverbs",
        pr: "proverbs",
        ecc: "ecclesiastes",
        eccl: "ecclesiastes",
        song: "songofsongs",
        ss: "songofsongs",
        isa: "isaiah",
        is: "isaiah",
        jer: "jeremiah",
        lam: "lamentations",
        ezek: "ezekiel",
        ez: "ezekiel",
        dan: "daniel",
        hos: "hosea",
        joe: "joel",
        am: "amos",
        ob: "obadiah",
        jon: "jonah",
        mic: "micah",
        nah: "nahum",
        hab: "habakkuk",
        zeph: "zephaniah",
        zep: "zephaniah",
        hag: "haggai",
        zech: "zechariah",
        zec: "zechariah",
        mal: "malachi",
        mt: "matthew",
        matt: "matthew",
        mk: "mark",
        lk: "luke",
        luk: "luke",
        joh: "john",
        act: "acts",
        rom: "romans",
        cor: "corinthians",
        "1cor": "1corinthians",
        "2cor": "2corinthians",
        gal: "galatians",
        eph: "ephesians",
        phil: "philippians",
        php: "philippians",
        col: "colossians",
        thess: "thessalonians",
        thes: "thessalonians",
        "1thess": "1thessalonians",
        "1thes": "1thessalonians",
        "2thess": "2thessalonians",
        "2thes": "2thessalonians",
        tim: "timothy",
        "1tim": "1timothy",
        "2tim": "2timothy",
        tit: "titus",
        philem: "philemon",
        phlm: "philemon",
        heb: "hebrews",
        jas: "james",
        jam: "james",
        pet: "peter",
        pt: "peter",
        "1pet": "1peter",
        "1pt": "1peter",
        "2pet": "2peter",
        "2pt": "2peter",
        jude: "jude",
        rev: "revelation",
        rv: "revelation"
    }

    function findBook(books: any[], value: string): any {
        const search = formatBookSearch(value)

        // First try exact matches and common abbreviations
        const exactMatch = books.find(book => {
            const bookName = formatBookSearch(book.name)
            if (bookName === search) return true

            // Handle common abbreviations
            const expandedName = BOOK_ABBREVIATIONS[search]
            if (expandedName && bookName.includes(expandedName)) return true

            return false
        })

        if (exactMatch) return exactMatch

        // Then try partial matches (book name starts with search)
        return books.find(book => formatBookSearch(book.name).startsWith(search))
    }

    function findChapter(book: any, value: string): any {
        const chapterNumber = parseInt(value, 10)
        if (isNaN(chapterNumber) || chapterNumber < 1) return null
        return book.chapters?.[chapterNumber - 1] || null
    }

    function findVerse(chapter: any, value: string): any {
        const verseNumber = parseInt(value, 10)
        if (isNaN(verseNumber) || verseNumber < 1) return null
        return chapter.verses?.[verseNumber - 1] || null
    }

    /**
     * Extracts book name and text search term from a combined query.
     * Supports single-word, two-word, and three-word book names.
     */
    function parseCombinedQuery(query: string, books: any[]): { textTerm: string; book: any | null } {
        const trimmed = query.trim()
        const words = trimmed.split(/\s+/)

        if (words.length < 2) {
            return { textTerm: trimmed, book: null }
        }

        // Check progressively longer word combinations to match book names
        for (let i = 0; i < words.length; i++) {
            // Single word
            const singleWord = words[i]
            const book = findBook(books, singleWord)
            if (book) {
                const textTerm = words
                    .filter((_, idx) => idx !== i)
                    .join(" ")
                    .trim()
                if (textTerm.length >= 2) {
                    return { textTerm, book }
                }
            }

            // Two words
            if (i < words.length - 1) {
                const twoWords = `${words[i]} ${words[i + 1]}`
                const book2 = findBook(books, twoWords)
                if (book2) {
                    const textTerm = words
                        .filter((_, idx) => idx !== i && idx !== i + 1)
                        .join(" ")
                        .trim()
                    if (textTerm.length >= 2) {
                        return { textTerm, book: book2 }
                    }
                }
            }

            // Three words
            if (i < words.length - 2) {
                const threeWords = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
                const book3 = findBook(books, threeWords)
                if (book3) {
                    const textTerm = words
                        .filter((_, idx) => idx !== i && idx !== i + 1 && idx !== i + 2)
                        .join(" ")
                        .trim()
                    if (textTerm.length >= 2) {
                        return { textTerm, book: book3 }
                    }
                }
            }
        }

        return { textTerm: trimmed, book: null }
    }

    type RawSearchHit = { book: any; chapter: any; verse: any; reference: string; referenceFull: string; verseText: string }

    /**
     * Searches for text in verse content, optionally limited to a specific book.
     */
    function searchInBible(books: any[], searchTerm: string, filterBook: any | null = null): RawSearchHit[] {
        const results: RawSearchHit[] = []
        const searchLower = searchTerm.toLowerCase()
        const booksToSearch = filterBook ? [filterBook] : books

        booksToSearch.forEach(book => {
            book.chapters?.forEach((chapter: any) => {
                chapter.verses?.forEach((verse: any) => {
                    const verseContent = sanitizeVerseText(verse.text || "")
                    if (verseContent.toLowerCase().includes(searchLower)) {
                        results.push({
                            book: book,
                            chapter: chapter,
                            verse: verse,
                            reference: `${book.number}.${chapter.number}.${verse.number}`,
                            referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                            verseText: verseContent
                        })
                    }
                })
            })
        })

        return results.slice(0, 50)
    }

    function updateSearch(searchVal: string, scriptureCache: any, openedScriptureId: string, isApi: boolean) {
        if (!searchVal.trim()) {
            searchResults = []
            searchResult = { reference: "", referenceFull: "", verseText: "" }
            // Clear API search results store
            if (isApi) {
                scriptureSearchResults.set(null)
            }
            return
        }

        // For API bibles, parse references locally first (same as local bibles)
        // Then use API search only for text content searches
        if (isApi) {
            const scripture = scriptureCache[openedScriptureId]

            if (!scripture?.books) {
                // Books not loaded yet, use API search as fallback
                const referenceMatch = searchVal.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-(\d+))?/)
                const searchType = referenceMatch ? "reference" : "text"
                send("SEARCH_SCRIPTURE", { id: openedScriptureId, searchTerm: searchVal, searchType })
                return
            }

            const books = scripture.books
            const referenceMatch = searchVal.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-(\d+))?/)

            if (referenceMatch) {
                const [, bookPart, chapterPart, versePart1, versePart2] = referenceMatch
                const versePart = versePart1 || versePart2

                const book = findBook(books, bookPart)
                if (book) {
                    const chapterNumber = parseInt(chapterPart, 10)
                    const verseNumber = versePart ? parseInt(versePart, 10) : null
                    const chapter = findChapter(book, chapterPart)

                    if (chapter) {
                        if (versePart) {
                            // Specific verse found in cache
                            const verse = findVerse(chapter, versePart)
                            if (verse) {
                                searchResult = {
                                    reference: `${book.number}.${chapterNumber}.${verse.number}`,
                                    referenceFull: `${book.name} ${chapterNumber}:${verse.number}`,
                                    verseText: sanitizeVerseText(verse.text || "")
                                }
                                searchResults = [searchResult]
                                return
                            }
                        } else {
                            // Whole chapter found in cache
                            if (chapter.verses && chapter.verses.length > 0) {
                                searchResults = chapter.verses.map((verse: any) => ({
                                    reference: `${book.number}.${chapterNumber}.${verse.number}`,
                                    referenceFull: `${book.name} ${chapterNumber}:${verse.number}`,
                                    verseText: sanitizeVerseText(verse.text || "")
                                }))
                                if (searchResults.length > 0) {
                                    searchResult = searchResults[0]
                                    return
                                }
                            }
                        }
                    }

                    // Book found but chapter/verse data not in cache
                    // Check if chapter number is reasonable (most books don't have > 150 chapters)
                    const isReasonableChapter = chapterNumber > 0 && chapterNumber <= 150

                    if (isReasonableChapter) {
                        // Construct reference and request data
                        const requestKey = `${openedScriptureId}:${book.keyName}:${chapterNumber}`

                        if (verseNumber) {
                            searchResult = {
                                reference: `${book.number}.${chapterNumber}.${verseNumber}`,
                                referenceFull: `${book.name} ${chapterNumber}:${verseNumber}`,
                                verseText: ""
                            }
                            searchResults = [searchResult]

                            // Only send request if we haven't already failed on this chapter
                            if (book.keyName && !failedChapterRequests.has(requestKey)) {
                                send("GET_SCRIPTURE", {
                                    id: openedScriptureId,
                                    bookKey: book.keyName,
                                    chapterKey: chapterNumber,
                                    bookIndex: book.number - 1,
                                    chapterIndex: chapterNumber - 1
                                })
                            }
                            return
                        } else if (chapterNumber) {
                            searchResult = {
                                reference: `${book.number}.${chapterNumber}.1`,
                                referenceFull: `${book.name} ${chapterNumber}`,
                                verseText: ""
                            }
                            searchResults = [searchResult]

                            // Only send request if we haven't already failed on this chapter
                            if (book.keyName && !failedChapterRequests.has(requestKey)) {
                                send("GET_SCRIPTURE", {
                                    id: openedScriptureId,
                                    bookKey: book.keyName,
                                    chapterKey: chapterNumber,
                                    bookIndex: book.number - 1,
                                    chapterIndex: chapterNumber - 1
                                })
                            }
                            return
                        }
                    }
                }
            }

            // Try combined text + book search
            const combinedQuery = parseCombinedQuery(searchVal, books)

            if (combinedQuery.book && combinedQuery.textTerm.length >= 3) {
                // Search filtered to specific book
                send("SEARCH_SCRIPTURE", {
                    id: openedScriptureId,
                    searchTerm: combinedQuery.textTerm,
                    searchType: "text",
                    bookFilter: combinedQuery.book.number
                })
            } else if (searchVal.length >= 3) {
                // Regular text search across all books
                send("SEARCH_SCRIPTURE", { id: openedScriptureId, searchTerm: searchVal, searchType: "text" })
            } else {
                searchResults = []
                searchResult = { reference: "", referenceFull: "", verseText: "" }
            }
            return
        }

        // For local bibles, use cached search
        const scripture = scriptureCache[openedScriptureId]
        if (!scripture?.books) return

        const books = scripture.books

        // Try to parse as scripture reference first
        // Matches: "John 3:16", "John 3 16", "John 3.16", "John 3,16", "Gen 1:1-3"
        const referenceMatch = searchVal.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-(\d+))?/)

        if (referenceMatch) {
            const [, bookPart, chapterPart, versePart1, versePart2] = referenceMatch
            const versePart = versePart1 || versePart2 // Handle both patterns

            const book = findBook(books, bookPart)
            if (book) {
                const chapter = findChapter(book, chapterPart)
                if (chapter) {
                    if (versePart) {
                        // Specific verse
                        const verse = findVerse(chapter, versePart)
                        if (verse) {
                            searchResult = {
                                reference: `${book.number}.${chapter.number}.${verse.number}`,
                                referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                                verseText: sanitizeVerseText(verse.text || "")
                            }
                            searchResults = [searchResult]
                            return
                        }
                    } else {
                        // Whole chapter
                        searchResults =
                            chapter.verses?.map((verse: any) => ({
                                reference: `${book.number}.${chapter.number}.${verse.number}`,
                                referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                                verseText: sanitizeVerseText(verse.text || "")
                            })) || []
                        if (searchResults.length > 0) {
                            searchResult = searchResults[0]
                            return
                        }
                    }
                }
            }
        }

        // Try combined text + book search
        const combinedQuery = parseCombinedQuery(searchVal, books)

        if (combinedQuery.book && combinedQuery.textTerm.length >= 2) {
            // Search filtered to specific book
            const textResults = searchInBible(books, combinedQuery.textTerm, combinedQuery.book)
            searchResults = textResults.map(r => ({ reference: r.reference, referenceFull: r.referenceFull, verseText: r.verseText }))
        } else {
            // Regular text search across all books
            const textResults = searchInBible(books, searchVal)
            searchResults = textResults.map(r => ({ reference: r.reference, referenceFull: r.referenceFull, verseText: r.verseText }))
        }

        if (searchResults.length > 0) {
            searchResult = searchResults[0]
        } else {
            searchResult = { reference: "", referenceFull: "", verseText: "" }
        }
    }

    // Handle API search results
    function handleApiSearchResults(apiResults: any, searchVal: string, scriptureId: string) {
        // Don't process if we already have search results (from local reference parsing)
        if (searchResults.length > 0) return
        if (!apiResults || !searchVal || !searchVal.trim() || !scriptureId) return

        if (apiResults.error) {
            searchResults = []
            searchResult = { reference: "", referenceFull: "", verseText: "" }
            return
        }

        if (apiResults.type === "reference") {
            // Handle reference search results
            if (!apiResults.found && !apiResults.book) {
                searchResults = []
                searchResult = { reference: "", referenceFull: "", verseText: "" }
                return
            }

            if (apiResults.book && apiResults.chapter) {
                const verseNumbers = apiResults.verses && apiResults.verses.length > 0 ? apiResults.verses : [1]
                const verseNum = typeof verseNumbers[0] === "object" ? verseNumbers[0].number : verseNumbers[0]
                const reference = `${apiResults.book}.${apiResults.chapter}.${verseNum}`
                const referenceFull = apiResults.bookName ? `${apiResults.bookName} ${apiResults.chapter}:${verseNum}` : reference

                // For reference search, we'll need to load the verse text separately
                // For now, just create the reference
                searchResult = {
                    reference: reference,
                    referenceFull: referenceFull,
                    verseText: "" // Will be loaded when verse is displayed
                }
                searchResults = [searchResult]
            }
        } else if (apiResults.type === "text") {
            // Handle text search results
            let results = (apiResults.results || []).map((r: any) => ({
                reference: r.reference,
                referenceFull: r.referenceFull || r.reference,
                verseText: sanitizeVerseText(r.verseText || "")
            }))

            // Apply book filter if provided
            if (apiResults.bookFilter) {
                results = results.filter((r: any) => {
                    const parts = r.reference.split(".")
                    return parts.length > 0 && parseInt(parts[0], 10) === apiResults.bookFilter
                })
            }

            searchResults = results
            searchResult = results.length > 0 ? results[0] : { reference: "", referenceFull: "", verseText: "" }
        }
    }

    function playSearchVerse(reference?: string) {
        const ref = reference || searchResult.reference
        if (!ref) return

        // Parse reference: "book.chapter.verse"
        const parts = ref.split(".")
        const bookNum = parseInt(parts[0], 10)
        const chapterNum = parseInt(parts[1], 10)
        const verseNum = parts[2] ? parseInt(parts[2], 10) : 0

        // Close search first so ScriptureContent component is rendered
        openScriptureSearch = false
        searchValue = ""

        // Send the scripture reference to display
        send("API:start_scripture", { id: collectionId || openedScripture, reference: ref })

        // Wait for next tick to ensure component is rendered, then navigate
        setTimeout(() => {
            if (scriptureContentRef?.navigateToVerse) {
                scriptureContentRef.navigateToVerse(bookNum, chapterNum)
            } else {
                // Fallback: if ref still not available, try again after a short delay
                setTimeout(() => {
                    if (scriptureContentRef?.navigateToVerse) {
                        scriptureContentRef.navigateToVerse(bookNum, chapterNum)
                    }
                }, 100)
            }

            // Auto-scroll to verse in list mode after navigation
            if ($scriptureViewList && verseNum > 0) {
                setTimeout(() => {
                    if (scriptureContentRef?.scrollToVerse) {
                        scriptureContentRef.scrollToVerse(verseNum)
                    }
                }, 200)
            }
        }, 0)
    }

    // Update search results with verse text when chapter data loads
    // Also validates and removes invalid references (non-existent chapters/verses)
    function updateSearchResultsWithLoadedVerses(cache: any, results: SearchItem[], scriptureId: string) {
        if (!results.length || !scriptureId) return

        const scripture = cache[scriptureId]
        if (!scripture?.books) return

        const validResults: SearchItem[] = []
        let updated = false

        for (const result of results) {
            if (result.verseText) {
                validResults.push(result)
                continue
            }

            const parts = result.reference.split(".")
            if (parts.length !== 3) {
                validResults.push(result)
                continue
            }

            const bookIndex = parseInt(parts[0], 10) - 1
            const chapterNumber = parseInt(parts[1], 10)
            const verseNumber = parseInt(parts[2], 10)

            const book = scripture.books[bookIndex]
            if (!book?.chapters) {
                validResults.push(result)
                continue
            }

            const chapter = book.chapters[chapterNumber - 1]
            if (!chapter) {
                // Chapter doesn't exist - mark as failed and remove this result
                const requestKey = `${scriptureId}:${book.keyName}:${chapterNumber}`
                failedChapterRequests.add(requestKey)
                updated = true
                continue
            }

            if (!chapter.verses) {
                // Verses not loaded yet - keep the result
                validResults.push(result)
                continue
            }

            if (chapter.verses.length === 0) {
                // Empty verses array from failed API request - mark as failed and remove
                const requestKey = `${scriptureId}:${book.keyName}:${chapterNumber}`
                failedChapterRequests.add(requestKey)
                updated = true
                continue
            }

            const verse = chapter.verses[verseNumber - 1]
            if (!verse) {
                // Verse doesn't exist - remove this result
                updated = true
                continue
            }

            if (verse.text) {
                updated = true
                validResults.push({
                    reference: result.reference,
                    referenceFull: result.referenceFull,
                    verseText: sanitizeVerseText(verse.text || "")
                })
            } else {
                validResults.push(result)
            }
        }

        if (updated) {
            searchResults = validResults

            if (searchResult.reference) {
                const updatedResult = validResults.find(r => r.reference === searchResult.reference)
                if (updatedResult) {
                    searchResult = updatedResult
                } else if (!searchResult.verseText) {
                    searchResult = validResults.length > 0 ? validResults[0] : { reference: "", referenceFull: "", verseText: "" }
                }
            }
        }
    }

    function highlightSearchTerm(text: string, searchTerm: string): string {
        if (!searchTerm.trim()) return text

        // Don't highlight if it looks like a scripture reference
        const referenceMatch = searchTerm.match(/^(.+?)\s+(\d+)(?:[:.,]\s*(\d+)|\s+(\d+))?(?:-(\d+))?/)
        if (referenceMatch) return text

        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
        return text.replace(regex, '<mark style="background-color: #ffeb3b; color: #000; padding: 0 2px;">$1</mark>')
    }
</script>

{#if openScriptureSearch && !tablet}
    <div style="height: 100%; display: flex; flex-direction: column;">
        <div class="search-bar-row">
            <button class="header-action" aria-label="Back" on:click={() => closeSearch()}>
                <Icon id="back" size={1.2} />
            </button>
            {#if usingExternalSearch}
                <div class="external-search-pill" title={searchValue}>
                    <Icon id="search" size={1} />
                    <div class="pill-text">
                        <span>{searchValue}</span>
                        <small>Use the drawer search to edit</small>
                    </div>
                </div>
            {:else}
                <input type="text" class="input search-input" placeholder="Search" bind:value={searchValue} bind:this={searchInput} />
            {/if}
        </div>

        <div class="search-scroll" style="flex: 1; overflow-y: auto; margin: 0.5rem 0;">
            {#if searchResults.length > 0}
                {#each searchResults.slice(0, 20) as result}
                    <div class="verse" role="button" tabindex="0" on:click={() => playSearchVerse(result.reference)} on:keydown={e => (e.key === "Enter" ? playSearchVerse(result.reference) : null)} style="margin-bottom: 0.5rem; cursor: pointer; padding: 0.5rem; border: 1px solid #333; border-radius: 0.25rem;">
                        <b style="color: white;">{result.referenceFull}</b>
                        <span style="display: block; margin-top: 0.25rem;">{@html highlightSearchTerm(result.verseText, searchValue)}</span>
                    </div>
                {/each}
                {#if searchResults.length > 20}
                    <p style="text-align: center; color: #666; font-size: 0.8em; margin: 0.5rem 0;">
                        Showing first 20 of {searchResults.length} results
                    </p>
                {/if}
            {:else if searchValue.trim()}
                <p style="text-align: center; color: #666; margin: 2rem 0; white-space: normal;">
                    No results found for "{searchValue}"
                </p>
            {/if}
        </div>
    </div>
{:else if tablet || ($openedScripture && (checkScriptureExists($openedScripture, $collectionId) || !scripturesLoaded))}
    {#if !tablet}
        <div class="header-bar" class:has-ref={!!depth}>
            <button class="header-action" aria-label="Back" on:click={() => (depth ? scriptureContentRef?.goBack?.() : openScripture(""))}>
                <Icon id="back" size={1.5} />
            </button>
            <div class="header-center">
                <h2 class="header-title">
                    {$scriptures[$collectionId || $openedScripture]?.customName || $scriptures[$collectionId || $openedScripture]?.name || ""}
                </h2>
                <div class="header-ref">
                    {#if depth}
                        {#if currentBook}{currentBook}{/if}
                        {#if currentChapter}
                            {currentChapter}{#if +currentVerse > 0}:{currentVerse}{/if}
                        {/if}
                    {/if}
                </div>
            </div>
            <button class="header-action" aria-label="Search scripture" on:click={openSearchPanel}>
                <Icon id="search" size={1.5} />
            </button>
        </div>
    {/if}

    <div class="bible">
        {#if $scriptureCache[$openedScripture]}
            {#if tablet}
                {#if searchValue.trim() && searchResults.length > 0}
                    <!-- Search Results for Tablet Mode -->
                    <div class="tablet-search-results">
                        {#each searchResults.slice(0, 50) as result}
                            <div class="verse search-result" role="button" tabindex="0" on:click={() => playSearchVerse(result.reference)} on:keydown={e => (e.key === "Enter" ? playSearchVerse(result.reference) : null)}>
                                <b style="color: white;">{result.referenceFull}</b>
                                <span style="display: block; margin-top: 0.25rem;">{@html highlightSearchTerm(result.verseText, searchValue)}</span>
                            </div>
                        {/each}
                        {#if searchResults.length > 50}
                            <p style="text-align: center; color: #666; font-size: 0.8em; margin: 0.5rem 0;">
                                Showing first 50 of {searchResults.length} results
                            </p>
                        {/if}
                    </div>
                {:else if searchValue.trim() && searchResults.length === 0}
                    <div style="flex: 1; display: flex; justify-content: center; align-items: center; opacity: 0.5;">
                        No results found for "{searchValue}"
                    </div>
                {:else}
                    <ScriptureContentTablet id={$collectionId || $openedScripture} scripture={$scriptureCache[$openedScripture]} bind:currentBook bind:currentChapter bind:currentVerse bind:this={scriptureContentRef} />
                {/if}
            {:else}
                <ScriptureContent id={$collectionId || $openedScripture} scripture={$scriptureCache[$openedScripture]} bind:depth bind:currentBook bind:currentChapter bind:currentVerse bind:this={scriptureContentRef} />
            {/if}
            
            {#if tablet}
                <div class="floating-controls-container">
                    <Button on:click={() => scriptureContentRef?.backward()} center dark class="floating-control-button" title="Previous">
                        <Icon id="previous" white size={1.2} />
                    </Button>
                    <Button on:click={() => scriptureContentRef?.forward()} center dark class="floating-control-button" title="Next">
                        <Icon id="next" white size={1.2} />
                    </Button>
                    <Button on:click={() => scriptureContentRef?.playScripture()} center dark class="floating-control-button" title="Play/Update">
                        <Icon id="play" white size={1.2} />
                    </Button>
                    <div class="floating-divider" aria-hidden="true"></div>
                    {#if $scriptureViewList}
                        <Button on:click={() => scriptureWrapText.set(!$scriptureWrapText)} center dark class="floating-control-button" title={$scriptureWrapText ? "Single Line" : "Wrap Text"}>
                            <Icon id={$scriptureWrapText ? "noWrap" : "wrap"} white size={1.2} />
                        </Button>
                    {/if}
                    <Button on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark class="floating-control-button" title={$scriptureViewList ? "Grid View" : "List View"}>
                        <Icon id={$scriptureViewList ? "grid" : "list"} white size={1.2} />
                    </Button>
                </div>
            {/if}
        {:else if checkScriptureExists($openedScripture, $collectionId)}
            <Loading />
        {/if}
    </div>

    {#if showControlsBar && !tablet}
        <div class="controls-section">
            {#if showPrevNext}
                <div class="navigation-buttons">
                    <Button style="flex: 1;" on:click={previous} center dark>
                        <Icon size={1.2} id="previous" />
                    </Button>
                    <Button style="flex: 1;" on:click={next} center dark>
                        <Icon size={1.2} id="next" />
                    </Button>
                    {#if depth === 2}
                        <Button style="flex: 0;" on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                            <Icon id={$scriptureViewList ? "grid" : "list"} white />
                        </Button>
                    {/if}
                </div>
            {:else if depth === 2}
                <div class="navigation-buttons center-toggle">
                    <Button on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                        <Icon id={$scriptureViewList ? "grid" : "list"} white />
                    </Button>
                </div>
            {/if}
            {#if !$isCleared.all && !tablet}
                <div class="buttons">
                    <Clear />
                </div>
            {/if}
        </div>
    {/if}
{:else if !tablet && scriptureEntries.length}
    <h2 class="header">
        {translate("tabs.scripture", $dictionary)}
    </h2>
    <div class="scroll scripture-list" style="overflow: auto;">
        <div class="section-stack">
            {#each scriptureSections as section (section.id)}
                {@const label = translate(section.labelKey, $dictionary)}
                <div class="section-card">
                    <div class="section-heading">{label}</div>
                    <div class="section-items">
                        {#each section.items as scripture, index (scripture.id)}
                            {#if section.apiDividerIndex !== undefined && index === section.apiDividerIndex}
                                <div class="api-divider">{translate("scripture.api_section", $dictionary)}</div>
                            {/if}
                            <Button on:click={() => selectScripture(scripture)} title={scripture.customName || scripture.name} bold={false} class="scripture-item" active={isActiveScripture(scripture)}>
                                <Icon id={scripture.icon} right />
                                <p>{scripture.customName || scripture.name}</p>
                                {#if scripture.collection?.versions?.length}
                                    <span class="collection-count">{scripture.collection.versions.length}</span>
                                {/if}
                            </Button>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </div>
{:else if !tablet}
    <Center faded>{translate("empty.general", $dictionary)}</Center>
{/if}

<style>
    p {
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-wrap: break-word;
    }

    .header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        overflow: hidden;
        height: 56px; /* Match show item height */
        background-color: var(--primary-darker);
        color: var(--text);
        font-weight: 600;
        font-size: 1.05em;
    }
    .header-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        min-width: 0; /* enable ellipsis in children */
        line-height: 1;
        justify-content: center;
    }
    .header-bar.has-ref .header-center {
        justify-content: flex-start;
    }
    .header-title {
        margin: 0;
        line-height: 1.1;
        font-weight: 600;
        font-size: 0.95em; /* Match Projects header font size */
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text);
    }
    /* When reference is present, scale title smaller to fit */
    .header-bar.has-ref .header-title {
        font-size: 0.85em;
    }
    .header-ref {
        margin-top: 2px;
        font-size: 0.8em;
        color: var(--text);
        opacity: 0.9;
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .header-bar.has-ref .header-ref {
        margin-top: 2px;
    }
    /* When no reference, let title use two lines (avoid ellipsis) and hide the ref row */
    .header-bar:not(.has-ref) .header-title {
        white-space: normal;
        text-align: center;
        overflow-wrap: anywhere;
    }
    .header-bar:not(.has-ref) .header-ref {
        display: none;
    }
    /* Center the title vertically when no reference line is shown */
    .header-bar:not(.has-ref) .header-center {
        justify-content: center;
    }
    .header-action {
        background: transparent;
        border: none;
        padding: 0 12px; /* tall clickable area */
        display: flex;
        align-items: center;
        align-self: stretch; /* fill header height */
        cursor: pointer;
        color: var(--secondary);
        border-radius: 6px;
        margin-top: 0;
        min-width: 44px; /* accessible hit size */
    }
    .header-action:hover {
        background-color: var(--hover);
    }

    .header-action {
        transform: scale(1);
    }
    .bible {
        flex: 1;
        overflow-y: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
    }
    .bible :global(.grid),
    .bible :global(.list) {
        flex: 1;
        height: 100%;
        position: relative;
    }

    .verse {
        display: flex;
        flex-direction: column;
        padding: 10px;

        overflow: auto;
    }
    .verse:hover {
        background-color: var(--primary-darker);
    }



    /* Controls section */
    .controls-section {
        display: flex;
        flex-direction: column;
        gap: 0;
        background-color: var(--primary-darkest);
        border-radius: 8px 8px 0 0;
        overflow: hidden;
        margin-bottom: 0;
    }

    .navigation-buttons {
        display: flex;
        width: 100%;
        flex-direction: row;
        align-items: center;
        gap: 0;
        background-color: var(--primary-darkest);
        border-radius: 8px 8px 0 0;
        padding: 2px 4px;
    }

    .navigation-buttons.center-toggle {
        justify-content: center;
    }

    .navigation-buttons :global(button) {
        flex: 1;
        min-height: 36px !important;
        padding: 0.5rem 0.75rem !important;
        font-size: 0.9em !important;
        border-radius: 0 !important;
    }

    .navigation-buttons :global(button:first-child) {
        border-radius: 8px 0 0 0 !important;
    }

    .navigation-buttons :global(button:last-child) {
        border-radius: 0 8px 0 0 !important;
    }

    .navigation-buttons.center-toggle :global(button) {
        border-radius: 8px 8px 0 0 !important;
    }

    .controls-section .buttons {
        border-radius: 0;
    }

    .controls-section .buttons :global(button) {
        flex: 1;
        padding: 0.75rem 1rem !important;
        font-size: 1em !important;
        min-height: 48px !important;
        border-radius: 0 !important;
    }

    .buttons {
        display: flex;
        width: 100%;
    }

    .controls-section :global(.clearAll) {
        border-radius: 0 !important;
    }

    .input {
        width: 100%;

        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        padding: 10px 18px;
        border: none;
        font-size: inherit;

        border-bottom: 2px solid var(--secondary);
    }
    .search-bar-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .search-input {
        flex: 1;
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }

    .external-search-pill {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        min-height: 40px;
    }
    .pill-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .pill-text span {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .pill-text small {
        font-size: 0.7em;
        opacity: 0.6;
    }

    /* FreeShow UI scrollbar */
    .search-scroll,
    .bible {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .search-scroll::-webkit-scrollbar,
    .bible::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .search-scroll::-webkit-scrollbar-track,
    .bible::-webkit-scrollbar-track,
    .search-scroll::-webkit-scrollbar-corner,
    .bible::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .search-scroll::-webkit-scrollbar-thumb,
    .bible::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .search-scroll::-webkit-scrollbar-thumb:hover,
    .bible::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    /* Scripture list styling */
    .scripture-list {
        padding-bottom: 60px;
    }

    .section-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 10px 0;
        padding-right: 5px;
        width: 100%;
        box-sizing: border-box;
        align-items: flex-start;
    }

    .section-card {
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-left: 0;
        border-radius: 10px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        overflow: hidden;
        width: 100%;
        max-width: 520px;
    }

    .section-heading {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .section-items {
        display: flex;
        flex-direction: column;
    }

    .section-items :global(.scripture-item) {
        width: 100%;
        padding: 0.65rem 0.9rem !important;
        min-height: 50px !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        border-top: none !important;
        background-color: transparent !important;
        display: flex !important;
        align-items: center !important;
        border-bottom-left-radius: 0 !important;
    }

    .section-items :global(.scripture-item:hover) {
        background-color: rgb(255 255 255 / 0.04) !important;
    }

    .section-items :global(.scripture-item.active) {
        background-color: rgb(255 255 255 / 0.08) !important;
        box-shadow: inset 4px 0 0 var(--secondary) !important;
    }

    .section-items > :global(.scripture-item:first-child.active) {
        border-top-right-radius: 12px;
    }

    .section-items > :global(.scripture-item:last-child.active) {
        border-bottom-right-radius: 12px;
    }

    .collection-count {
        font-size: 0.75em;
        opacity: 0.75;
        margin-left: auto;
        padding-left: 0.75rem;
    }

    .api-divider {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 8px 14px 4px;
        margin-top: 4px;
        color: rgb(255 255 255 / 0.75);
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .api-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: rgb(255 255 255 / 0.12);
        border-radius: 999px;
    }

    :global(.scripture-item) {
        justify-content: flex-start !important;
        align-items: center !important;
        text-align: left !important;
        gap: 0.6rem !important;
        font-size: 1em !important;
        margin: 0 !important;
        line-height: 1.2 !important;
    }

    :global(.scripture-item p) {
        text-align: left;
        font-size: inherit !important;
        margin: 0;
        display: block;
        line-height: 1.2;
    }

    :global(.scripture-item) :global(svg) {
        width: 1.5em;
        height: 1.5em;
        flex-shrink: 0;
        margin-right: 0.5em;
        margin-top: 0;
        align-self: center;
    }

    /* Tablet and mobile styles - match project sizes exactly */
    @media screen and (max-width: 1000px) {
        .header {
            font-size: 1.2em;
            padding: 0.6em 0;
        }

        .section-stack {
            gap: 6px;
            padding-right: 8px;
        }

        .section-items :global(.scripture-item) {
            padding: 0.55rem 0.85rem !important;
            min-height: 46px !important;
            font-size: 0.95em !important;
        }

        :global(.scripture-item) :global(svg) {
            width: 1.4em !important;
            height: 1.4em !important;
        }

        .input {
            padding: 14px 20px;
            font-size: 1.1em;
        }

        .header-title {
            font-size: 1.1em;
        }

        .header-bar.has-ref .header-title {
            font-size: 1em;
        }

        .header-ref {
            font-size: 0.95em;
        }

        .verse {
            padding: 14px;
            font-size: 1.05em;
        }

        .navigation-buttons {
            padding: 2px 4px;
        }

        .navigation-buttons :global(button) {
            min-height: 36px !important;
            padding: 0.5rem 0.75rem !important;
            font-size: 0.9em !important;
        }

        .controls-section .buttons :global(button) {
            padding: 0.5rem 1rem !important;
            font-size: 0.9em !important;
            min-height: auto !important;
        }
    }
    /* Floating controls - matching main frontend FloatingInputs style */
    .floating-controls-container {
        --size: 40px;
        --padding: 12px;
        --background: rgba(25, 25, 35, 0.85);

        display: flex;
        align-items: center;
        height: var(--size);
        background-color: var(--background);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
        border-radius: var(--size);
        backdrop-filter: blur(3px);
        overflow: hidden;
        z-index: 199;

        /* Only float in tablet mode - position set via media query */
        position: absolute;
        bottom: var(--padding);
        right: var(--padding);
    }

    :global(.floating-control-button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px) !important;
        padding: 0 12px !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }

    :global(.floating-control-button:hover) {
        background: rgb(255 255 255 / 0.1) !important;
    }

    :global(.floating-control-button:active) {
        background: rgb(255 255 255 / 0.15) !important;
    }

    .floating-divider {
        height: 100%;
        width: 1px;
        background-color: var(--primary-lighter);
    }

    /* Tablet Search Results */
    .tablet-search-results {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
    }

    .tablet-search-results .search-result {
        margin-bottom: 0.5rem;
        cursor: pointer;
        padding: 0.75rem;
        border: 1px solid var(--primary-lighter);
        border-radius: 0.25rem;
        background-color: var(--primary-darker);
    }

    .tablet-search-results .search-result:hover {
        background-color: var(--primary);
    }

</style>

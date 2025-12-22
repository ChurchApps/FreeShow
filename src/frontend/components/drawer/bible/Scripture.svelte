<script lang="ts">
    import JSONBible from "json-bible"
    import { ApiBible } from "json-bible/lib/api"
    import type { Verse } from "json-bible/lib/Bible"
    import type { VerseReference } from "json-bible/lib/reference"
    import { onMount } from "svelte"
    import { sanitizeVerseText } from "../../../../common/scripture/sanitizeVerseText"
    import { defaultBibleBookNames } from "../../../converters/bebliaBible"
    import { activeEdit, activeScripture, activeTriggerFunction, customScriptureBooks, notFound, openScripture, outLocked, outputs, resized, scriptureHistory, scriptureHistoryUsed, scriptureMode, scriptures, scriptureSettings, selected } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { formatBibleText, getVerseIdParts, getVersePartLetter, joinRange, loadJsonBible, moveSelection, outputIsScripture, playScripture, scriptureRangeSelect, sortScriptureSelection, splitText, swapPreviewBible } from "./scripture"

    export let active: string | null
    export let searchValue: string

    $: activeScriptureId = active || ""
    $: activeScriptures = [activeScriptureId]
    $: if ($scriptures[activeScriptureId]?.collection?.versions) activeScriptures = $scriptures[activeScriptureId].collection.versions

    $: previewBibleIndex = $scriptures[activeScriptureId]?.collection?.previewIndex || 0
    $: previewBibleId = activeScriptures[previewBibleIndex] || activeScriptures[0]
    $: previewBibleData = clone($scriptures[previewBibleId] || null)

    $: isApi = !!previewBibleData?.api
    $: isCollection = activeScriptures.length > 1

    // custom data
    $: if (previewBibleData?.copyright) previewBibleData.metadata = { ...(previewBibleData.metadata || {}), copyright: previewBibleData.copyright }
    $: if (previewBibleData?.customName) previewBibleData.name = previewBibleData.customName

    // auto load scriptures when changed
    // timeout is to load drawer tab "instantly", before loading scripture
    $: setTimeout(() => loadScripture(previewBibleId), 10)

    // Load all scriptures in collection for multi-version display
    $: if (isCollection) {
        activeScriptures.forEach((id) => {
            if (id && !data[id]) {
                loadScriptureForCollection(id)
            }
        })
    }

    async function loadScriptureForCollection(id: string) {
        if (!id || data[id]) return
        try {
            const jsonBible = await loadJsonBible(id)
            if (!jsonBible) return

            data[id] = { bibleData: jsonBible }
            data = data // trigger reactivity
        } catch (err) {
            console.error("Error loading collection scripture:", id, err)
        }
    }

    // Track what book/chapter each scripture's data is loaded for
    let collectionLoadedFor: { [scriptureId: string]: { book: number | string | null; chapter: number | string | null } } = {}

    // Reset tracking when the active scripture/collection changes
    $: if (activeScriptureId) collectionLoadedFor = {}

    // Load book/chapter data for all collection scriptures when navigating
    async function loadCollectionBookChapter(targetBook: number | string, targetChapter: number | string) {
        if (!isCollection) return

        for (const scriptureId of activeScriptures) {
            if (scriptureId === previewBibleId) continue
            const scriptureData = data[scriptureId]
            if (!scriptureData?.bibleData) continue

            const currentLoaded = collectionLoadedFor[scriptureId]
            const bookNeedsReload = !scriptureData.bookData || currentLoaded?.book !== targetBook
            const chapterNeedsReload = !scriptureData.chapterData || currentLoaded?.chapter !== targetChapter || bookNeedsReload

            try {
                // Load book if needed (book changed or not loaded)
                if (bookNeedsReload) {
                    scriptureData.bookData = await scriptureData.bibleData.getBook(targetBook)
                    // Clear chapter data when book changes since it's for the old book
                    delete scriptureData.chapterData
                }
                // Load chapter if needed (chapter changed or not loaded)
                if (chapterNeedsReload && scriptureData.bookData) {
                    scriptureData.chapterData = await scriptureData.bookData.getChapter(Number(targetChapter))
                }

                // Update tracking for this scripture
                collectionLoadedFor[scriptureId] = { book: targetBook, chapter: targetChapter }

                data = data // trigger reactivity
            } catch (err) {
                console.error("Error loading collection book/chapter:", scriptureId, err)
            }
        }
    }

    // Trigger loading book/chapter for all collection scriptures when reference changes
    $: if (isCollection && activeReference.book && activeReference.chapters.length) {
        loadCollectionBookChapter(activeReference.book, activeReference.chapters[0])
    }

    const GOLDEN_ANGLE = 137.508
    const BASE_HUE = 330
    function getVersionColor(index: number): string {
        const hue = (BASE_HUE + index * GOLDEN_ANGLE) % 360
        return `hsl(${hue}, 75%, 65%)`
    }
    function getVersionBgColor(index: number): string {
        const hue = (BASE_HUE + index * GOLDEN_ANGLE) % 360
        return `hsla(${hue}, 70%, 50%, 0.12)`
    }

    // Get verses for all scriptures in a collection
    function getCollectionVerses(verseId: string | number): { id: string; name: string; text: string; isSplit: boolean }[] {
        if (!isCollection) return []

        const { id, subverse } = getVerseIdParts(verseId)
        const isSplit = subverse > 0
        const chars = Number($scriptureSettings.longVersesChars || 100)

        return activeScriptures
            .map((scriptureId) => {
                const scriptureData = data[scriptureId]
                const scriptureMeta = $scriptures[scriptureId]
                const name = scriptureMeta?.customName || scriptureMeta?.name || scriptureId

                if (!scriptureData?.chapterData) {
                    return { id: scriptureId, name, text: "", isSplit: false }
                }

                try {
                    const verse = scriptureData.chapterData.getVerse(id)
                    const fullText = verse.getHTML() || verse?.data?.text || ""

                    if (isSplit && fullText) {
                        const splitParts = splitText(fullText, chars)
                        if (splitParts.length > 1) {
                            return { id: scriptureId, name, text: splitParts[subverse - 1] || "", isSplit: true }
                        }
                    }

                    return { id: scriptureId, name, text: fullText, isSplit: false }
                } catch {
                    return { id: scriptureId, name, text: "", isSplit: false }
                }
            })
            .filter((v) => v.text)
    }

    $: isActiveInOutput = outputIsScripture($outputs)

    type Reference = {
        book: number | string | null
        chapters: (number | string)[] // can have multiple chapters open
        verses: (number | string)[][] // can have multiple verses open per chapter
    }

    let activeReference: Reference = {
        book: $activeScripture.reference?.book || null,
        chapters: $activeScripture.reference?.chapters || [],
        verses: $activeScripture.reference?.verses || []
    }

    type BibleReturn = Awaited<ReturnType<typeof JSONBible>> | Awaited<ReturnType<typeof ApiBible>>
    type TBook = Awaited<ReturnType<BibleReturn["getBook"]>>
    type TChapter = Awaited<ReturnType<TBook["getChapter"]>>
    type TVerse = ReturnType<TChapter["getVerses"]>
    type Data = {
        bibleData?: BibleReturn
        bookData?: TBook
        chapterData?: TChapter
        verseData?: TVerse
    }

    let data: { [key: string]: Data } = {}

    $: currentBibleData = data[previewBibleId] || null
    $: currentBible = currentBibleData?.bibleData?.data || null
    $: books = currentBible?.books || null
    $: chapters = currentBibleData?.bookData?.data?.chapters || null
    // $: verses = currentBibleData?.chapterData?.data?.verses || null
    $: verses = currentBibleData?.chapterData?.data?.verses?.map((a) => ({ ...a, text: currentBibleData?.chapterData?.getVerse(a.number).getHTML() || "" })) || null

    // category color / abbreviation data
    $: booksData = currentBibleData?.bibleData?.getBooksData() || []

    // Check if any translation in collection supports splitting for verses
    function checkCollectionSplitSupport(): { [verseNumber: number]: number } {
        if (!isCollection || !$scriptureSettings.splitLongVerses || !verses) return {}

        const chars = Number($scriptureSettings.longVersesChars || 100)
        const splitCounts: { [verseNumber: number]: number } = {}

        activeScriptures.forEach((scriptureId) => {
            const chapterData = data[scriptureId]?.chapterData
            if (!chapterData) return

            verses.forEach((verse) => {
                try {
                    const verseObj = chapterData.getVerse(verse.number)
                    const fullText = verseObj.getHTML() || verseObj?.data?.text || ""
                    if (!fullText) return

                    const splitParts = splitText(fullText, chars)
                    if (splitParts.length > 1) {
                        splitCounts[verse.number] = Math.max(splitCounts[verse.number] || 0, splitParts.length)
                    }
                } catch {}
            })
        })

        return splitCounts
    }

    $: collectionSplitCounts = isCollection && $scriptureSettings.splitLongVerses ? checkCollectionSplitSupport() : {}

    let splittedVerses: (Verse & { id: string })[] = []
    $: splittedVerses = updateSplitted(verses, $scriptureSettings, collectionSplitCounts)

    let apiError = false

    async function loadScripture(id: string) {
        apiError = false

        if (!id) return
        if (data[id]) {
            openBook()
            return
        }

        try {
            const jsonBible = await loadJsonBible(id)
            if (!jsonBible) return

            data[id] = { bibleData: jsonBible }
        } catch (err) {
            console.error(err)
            if (isApi) apiError = true
            return
        }

        openBook()
    }

    // WIP similar to getSplittedVerses in scripture.ts
    function updateSplitted(verses: Verse[] | null, _updater: any, collectionSplitCounts: { [verseNumber: number]: number } = {}) {
        if (!verses) return []
        if (!$scriptureSettings.splitLongVerses) return verses.map((verse) => ({ ...verse, id: (verse.number || "").toString() + (verse.endNumber ? "-" + verse.endNumber : "") }))

        const chars = Number($scriptureSettings.longVersesChars || 100)
        const newVerses: (Verse & { id: string })[] = []
        verses.forEach((verse) => {
            const sanitizedVerse = sanitizeVerseText(verse.text)
            const newVerseStrings = splitText(sanitizedVerse, chars)
            const end = verse.endNumber ? `-${verse.endNumber}` : ""
            const numParts = Math.max(newVerseStrings.length, collectionSplitCounts[verse.number] || 0)

            if (numParts > 1) {
                for (let i = 0; i < numParts; i++) {
                    const text = newVerseStrings[i] || (i === 0 ? newVerseStrings[0] || verse.text : "")
                    newVerses.push({ ...verse, id: `${verse.number}_${i + 1}${end}`, text })
                }
            } else {
                newVerses.push({ ...verse, id: `${verse.number}${end}`, text: newVerseStrings[0] || verse.text })
            }
        })

        return newVerses
    }

    function buildVerseLabel(id: number, subverse: number, endNumber: number, showSuffix: boolean) {
        const baseVisible = !subverse || subverse === 1 || showSuffix
        const base = baseVisible ? `${id}${endNumber ? "-" + endNumber : ""}` : ""
        const suffix = showSuffix && subverse ? getVersePartLetter(subverse) : ""
        return { base, suffix }
    }

    function toggleChapter(e: any, id: string) {
        if (e.ctrlKey || e.metaKey) {
            if (activeReference.chapters.find((cid) => cid?.toString() === id)) {
                // remove chapter
                const newChapters = activeReference.chapters.filter((cid) => cid.toString() !== id)
                const newVerses = activeReference.verses.filter((_, i) => i < newChapters.length)
                openChapter(newChapters, newVerses)
            } else {
                // add chapter
                openChapter([...activeReference.chapters, id], [...activeReference.verses, []])
            }
        } else openChapter([id])
    }

    async function openBook(bookNumber?: number | string, chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[][]) {
        // reset chapter and verse when changing book
        if (bookNumber && !chapterNumbers) activeReference.chapters = []
        if (bookNumber && !verseNumbers) activeReference.verses = []

        bookNumber = bookNumber ?? activeReference.book ?? 1
        activeReference.book = bookNumber

        const currentData = data[previewBibleId]?.bibleData
        if (!currentData) return

        // remove current data so loading shows again
        delete data[previewBibleId].bookData
        delete data[previewBibleId].chapterData
        delete data[previewBibleId].verseData
        data = data

        // load new data
        data[previewBibleId].bookData = await currentData.getBook(bookNumber)

        openChapter(chapterNumbers, verseNumbers)
    }

    async function openChapter(chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[][]) {
        // reset verse when changing chapter
        if (chapterNumbers && !verseNumbers) activeReference.verses = []

        chapterNumbers = chapterNumbers?.length ? chapterNumbers : activeReference.chapters?.length ? activeReference.chapters : [1]
        activeReference.chapters = chapterNumbers

        const currentData = data[previewBibleId]?.bookData
        if (!currentData) return

        // remove current data so loading shows again
        delete data[previewBibleId].chapterData
        delete data[previewBibleId].verseData
        data = data

        // load new data
        // NOTE: if chapter is not a number it does not work
        const chapterNumber = Number(chapterNumbers[chapterNumbers.length - 1])
        // const chapterId = chapterNumbers[chapterNumbers.length - 1]?.toString()
        // const chapterIndex = (chapters || []).findIndex((a) => a.number?.toString() === chapterId)
        data[previewBibleId].chapterData = await currentData.getChapter(chapterNumber)

        // newToast(translateText("toast.chapter_undefined").replace("{}", chapter))

        openVerse(verseNumbers)
    }

    let playWhenLoaded = false
    async function openVerse(verseNumbers?: (number | string)[][]) {
        verseNumbers = verseNumbers?.length ? verseNumbers : activeReference.verses.length ? activeReference.verses : [[1]]
        activeReference.verses = verseNumbers

        const currentData = data[previewBibleId]?.chapterData
        if (!currentData) return

        // load new data
        data[previewBibleId].verseData = currentData.getVerses(verseNumbers.map(Number))

        // newToast(translateText("toast.verse_undefined").replace("{}", verse))

        if (playWhenLoaded) setTimeout(playScripture)
        playWhenLoaded = false
    }

    // update active reference
    $: if (activeReference.verses[0]?.length && activeReference.book !== null) {
        activeScripture.set({
            id: previewBibleId,
            reference: {
                book: activeReference.book,
                chapters: activeReference.chapters,
                verses: activeReference.verses
            }
        })
    }

    // WIP move this?
    // select book & chapter when opening bible show reference
    $: if ($openScripture) setTimeout(openReference, 200)
    function openReference() {
        if ($openScripture?.book === undefined) {
            openScripture.set(null)
            return
        }

        if ($openScripture.play) playWhenLoaded = true

        let verses = $openScripture.verses
        if (!Array.isArray(verses)) verses = [[1]]
        if (!Array.isArray(verses[0])) verses = [verses]

        openBook(Number($openScripture.book), [$openScripture.chapter], verses)

        openScripture.set(null)
    }

    /// HISTORY ///

    let historyOpened = false
    $: currentHistory = clone($scriptureHistory.filter((a) => a.id === previewBibleId)).reverse()

    /// AUTOSCROLL ///

    let booksScrollElem: HTMLElement | undefined
    let chaptersScrollElem: HTMLElement | undefined
    let versesScrollElem: HTMLElement | undefined
    $: if (activeScriptureId && activeReference.book) setTimeout(() => scrollToActive(booksScrollElem))
    $: if (activeScriptureId && activeReference.chapters.length) setTimeout(() => scrollToActive(chaptersScrollElem))
    $: if (activeScriptureId && activeReference.verses[0]?.length) setTimeout(() => scrollToActive(versesScrollElem))
    function scrollToActive(scrollElem) {
        if (!scrollElem || isSelected) return

        let selectedElemTop = scrollElem.querySelector(".isActive")?.offsetTop || 0

        // don't scroll if elem is in view
        let visibleElemPos = selectedElemTop - scrollElem.scrollTop
        if (visibleElemPos > 0 && visibleElemPos < scrollElem.offsetHeight) return

        scrollElem.scrollTo(0, Math.max(0, selectedElemTop - 70))
    }

    /// SELECTION ///

    onMount(() => selected.set({ id: "scripture", data: [] }))

    let previousSelection: (number | string)[] = []
    let isSelected = false
    function updateVersesSelection(e: any, verseNumber: string, isClick: boolean = false) {
        const selectedVerses = clone(activeReference.verses)

        if (isClick) {
            if (previousSelection.find((a) => a.toString() === verseNumber)) {
                return [[verseNumber]]
            }
            return selectedVerses
        }

        previousSelection = clone(selectedVerses[selectedVerses.length - 1])

        isSelected = true
        setTimeout(() => (isSelected = false), 100)

        const keys = e.ctrlKey || e.metaKey || e.shiftKey
        if (keys || !selectedVerses[selectedVerses.length - 1]?.find((a) => a && (a.toString() === verseNumber || a === getVerseId(verseNumber)))) {
            selectedVerses[selectedVerses.length - 1] = scriptureRangeSelect(e, selectedVerses[selectedVerses.length - 1], verseNumber, splittedVerses)

            // deselecting a verse
            if (!selectedVerses[selectedVerses.length - 1]?.find((id) => id.toString() === verseNumber)) {
                previousSelection = clone(selectedVerses[selectedVerses.length - 1])
            }
        }

        // drop action (create slide/show from drag&drop)
        selected.set({ id: "scripture", data: [] })

        return selectedVerses

        function getVerseId(verseRef: number | string) {
            if (!verseRef) return 1
            return Number(verseRef.toString().split("_")[0])
        }
    }

    $: if ($activeTriggerFunction === "scripture_selectAll") selectAllVerses()
    function selectAllVerses() {
        if (!splittedVerses) return

        openVerse([splittedVerses.map((a) => a.id)])

        // update
        setTimeout(() => (activeReference = activeReference))
    }

    /// SEARCH ///

    $: if (searchValue.length) referenceSearch()

    let freezeTimeout: NodeJS.Timeout | null = null
    let freezeInput: string | null = null
    async function referenceSearch() {
        // if search value ends with any number, unfreeze
        if (/\d$/.test(searchValue) || searchValue.length < (freezeInput?.length || 0)) {
            if (freezeTimeout) clearTimeout(freezeTimeout)
            freezeInput = null
        } else if (freezeInput) {
            searchValue = freezeInput
            return
        }

        const multiReference = await parseMultiChapterReference(searchValue)
        if (multiReference) {
            // normalize the search box so it reflects the exact selection the user will get
            searchValue = multiReference.referenceLabel
            openBook(multiReference.bookNumber, multiReference.chapters, multiReference.verses)
            return
        }

        const result = currentBibleData?.bibleData?.bookSearch(searchValue)
        if (!result) return

        if (result.autocompleted) searchValue = result.autocompleted

        if (result.book) {
            // BOOK
            openBook(result.book)

            // prevent inputs right after auto complete
            if (!result.chapter) {
                freezeInput = searchValue
                freezeTimeout = setTimeout(() => (freezeInput = null), 1500)
            }
        }

        if (result.chapter) {
            // CHAPTER
            openChapter([result.chapter])

            // VERSES
            if (result.verses.length) openVerse([result.verses])
            else setTimeout(selectAllVerses)
        }
    }

    type MultiReference = {
        bookNumber: number
        referenceLabel: string
        chapters: (number | string)[]
        verses: (number | string)[][]
    }

    // Parse references like "Genesis 1:1-12;2:1-10" into discrete chapter/verse selections.
    async function parseMultiChapterReference(value: string): Promise<MultiReference | null> {
        const bibleData = currentBibleData?.bibleData
        if (!bibleData) return null

        const sanitizedValue = value?.replace(/\s+/g, " ").trim()
        if (!sanitizedValue) return null

        const rawSegments = sanitizedValue
            .split(";")
            .map((segment) => segment.trim())
            .filter(Boolean)
        const segmentsToProcess = rawSegments.length ? rawSegments : [sanitizedValue]

        const firstSegment = segmentsToProcess[0]
        let baseResult = bibleData.bookSearch(firstSegment)
        if (!baseResult?.book && firstSegment.includes("-")) {
            const fallbackTarget = firstSegment.split("-")[0]?.trim()
            if (fallbackTarget) baseResult = bibleData.bookSearch(fallbackTarget)
        }
        if (!baseResult?.book) return null

        const bookNumber = Number(baseResult.book)
        const canonicalBookName = books?.find((book) => Number(book.number) === bookNumber)?.name || firstSegment

        const resolvedSegments: string[] = []
        for (let i = 0; i < segmentsToProcess.length; i++) {
            const rawSegment = segmentsToProcess[i]
            const normalizedSegment = normalizeSegment(rawSegment, canonicalBookName, bookNumber, bibleData)
            const expandedSegments = await expandCrossChapterSegment(normalizedSegment, canonicalBookName, bookNumber, bibleData)
            resolvedSegments.push(...expandedSegments)
        }

        const hasExplicitSplit = rawSegments.length > 1
        if (!hasExplicitSplit && resolvedSegments.length <= 1) return null

        const chapters: (number | string)[] = []
        const verses: (number | string)[][] = []
        for (const segment of resolvedSegments) {
            const parsed = bibleData.bookSearch(segment)
            if (!parsed?.chapter) return null

            const chapterNumber = Number(parsed.chapter)
            const verseList = parsed.verses?.length ? parsed.verses : await getEntireChapterVerses(bookNumber, chapterNumber, bibleData)
            if (!verseList?.length) return null

            chapters.push(chapterNumber)
            verses.push(verseList)
        }

        return {
            bookNumber,
            referenceLabel: buildReferenceLabel(canonicalBookName, resolvedSegments),
            chapters,
            verses
        }
    }

    // Ensure a reference chunk includes the book name so bookSearch can resolve it reliably.
    function normalizeSegment(segment: string, bookName: string, bookNumber: number, bibleData: any) {
        const trimmed = segment?.trim()
        if (!trimmed) return bookName

        const attempt = bibleData.bookSearch(trimmed)
        if (attempt?.book === bookNumber) return trimmed

        return `${bookName} ${trimmed}`.replace(/\s+/g, " ").trim()
    }

    // Break a cross-chapter span (e.g. "1:1-2:10") into per-chapter segments.
    async function expandCrossChapterSegment(segment: string, bookName: string, bookNumber: number, bibleData: any) {
        const escapedBook = escapeRegExp(bookName)
        const remainder = segment.replace(new RegExp(`^${escapedBook}\\s*`, "i"), "").trim()
        const multiChapterMatch = remainder.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)/)
        if (!multiChapterMatch) return [segment]

        const [_, startChapterStr, startVerseStr, endChapterStr, endVerseStr] = multiChapterMatch
        const startChapter = Number(startChapterStr)
        const startVerse = Number(startVerseStr)
        const endChapter = Number(endChapterStr)
        const endVerse = Number(endVerseStr)
        if (!startChapter || !endChapter || startChapter === endChapter) return [segment]

        const expanded: string[] = []
        for (let chapter = startChapter; chapter <= endChapter; chapter++) {
            const chapterStart = chapter === startChapter ? startVerse : 1
            const chapterEnd = chapter === endChapter ? endVerse : await getChapterLastVerse(bookNumber, chapter, bibleData)
            if (!chapterEnd) return [segment]
            expanded.push(`${bookName} ${chapter}:${chapterStart}-${chapterEnd}`)
        }

        return expanded
    }

    // Get the final verse number for a chapter so we can include the whole section when needed.
    async function getChapterLastVerse(bookNumber: number, chapterNumber: number, bibleData: any) {
        const bookData = await bibleData.getBook(bookNumber)
        const chapterData = await bookData.getChapter(chapterNumber)
        const verseEntries = chapterData?.data?.verses || []
        return Number(verseEntries[verseEntries.length - 1]?.number || verseEntries.length || 0)
    }

    // Return every verse index for a chapter when no explicit range was provided.
    async function getEntireChapterVerses(bookNumber: number, chapterNumber: number, bibleData: any) {
        const bookData = await bibleData.getBook(bookNumber)
        const chapterData = await bookData.getChapter(chapterNumber)
        return (chapterData?.data?.verses || []).map((verse) => Number(verse.number)).filter(Boolean)
    }

    // Format the combined reference so the UI shows "Book 1:1-12 ; 2:1-10".
    function buildReferenceLabel(bookName: string, segments: string[]) {
        const escapedBook = escapeRegExp(bookName)
        const bookRegex = new RegExp(`^${escapedBook}\\s*`, "i")
        const [firstSegment, ...rest] = segments
        const firstLabel = firstSegment.replace(bookRegex, "").trim() || firstSegment
        const restLabels = rest.map((segment) => segment.replace(bookRegex, "").trim())
        const suffix = restLabels.length ? restLabels.map((label) => ` ; ${label}`).join("") : ""
        return `${bookName} ${firstLabel}${suffix}`.trim()
    }

    // Escape user-facing book names before building regular expressions.
    function escapeRegExp(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }

    let contentSearchFieldActive = false
    let contentSearchValue = ""
    let contentSearchResults: VerseReference[] | null = null

    // auto search when char length is 5 or longer
    function searchValueChanged(e: any) {
        contentSearchValue = e.target?.value || ""
        if (contentSearchValue.length < 5) {
            contentSearchResults = null
            return
        }

        searchInBible()
    }

    async function searchInBible() {
        if (contentSearchValue.length < 3) {
            contentSearchResults = null
            return
        }

        const result = await currentBibleData?.bibleData?.textSearch(contentSearchValue)
        if (!result) return

        contentSearchResults = result
    }

    // reset if another reference is loaded
    $: if (activeReference) resetContentSearch()
    function resetContentSearch() {
        contentSearchValue = ""
        contentSearchResults = null
        contentSearchFieldActive = false
    }

    /// KEYBOARD SHORTCUTS ///

    function mouseup(e: any) {
        if (e.target.closest(".drawer")) return
        if (!contentSearchResults) resetContentSearch()
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            resetContentSearch()
            return
        }

        if (e.key === "Enter") {
            // Enter in search to play
            if (e.target?.closest(".search")) {
                playScripture()
                ;(document.activeElement as any)?.blur()
                return
            }

            // Ctrl+Enter to play
            if (e.target?.closest(".edit")) return
            if (e.ctrlKey || e.metaKey) playScripture()
            return
        }

        // assign chapter:verse divider when pressing arrow right
        if (e.key === "ArrowRight" && document.activeElement?.classList?.contains("search")) {
            if (searchValue.includes(" ") && searchValue.length > 3 && /\d/.test(searchValue) && !searchValue.includes(":")) {
                searchValue += ":"

                // move caret
                let searchInput: any = document.activeElement
                setTimeout(() => (searchInput.selectionStart = searchInput.selectionEnd = 100))
            }

            return
        }

        if (!e.ctrlKey && !e.metaKey) return

        // Ctrl+N Converts to show (shortcuts.ts)

        // Refresh
        if (e.key === "r") {
            if (!isActiveInOutput) return
            e.preventDefault()
            playScripture()
            return
        }

        // Toggle History
        if (e.key === "h") {
            e.preventDefault()
            historyOpened = !historyOpened
            scriptureHistoryUsed.set(true)
            return
        }

        // toggle Bible content search
        if (e.key === "b") {
            if (contentSearchFieldActive) resetContentSearch()
            else contentSearchFieldActive = true
            return
        }

        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        if ($activeEdit.items.length) return

        // go to next/previous verse
        let left = e.key.includes("Left")
        _moveSelection(left)
    }

    /// MOVE SELECTION ///

    let chapterLengths: { [key: number]: number } = {}
    $: if ($activeTriggerFunction === "scripture_next") _moveSelection(false)
    $: if ($activeTriggerFunction === "scripture_previous") _moveSelection(true)
    function _moveSelection(moveLeft: boolean) {
        if (!activeReference.book) return

        // Check if we're dealing with split verses
        const currentVerses = sortScriptureSelection(activeReference.verses[0] || [])
        const currentVerseId = currentVerses[0]?.toString()
        const selectionCount = currentVerses.length
        if (currentVerseId && splittedVerses.length) {
            const currentIndex = splittedVerses.findIndex((v) => v.id === currentVerseId || getVerseIdParts(v.id).id === Number(currentVerseId))
            if (currentIndex !== -1) {
                // Navigate within split verses, maintaining selection count
                const newIndex = moveLeft ? currentIndex - selectionCount : currentIndex + selectionCount

                if (newIndex >= 0 && newIndex + selectionCount - 1 < splittedVerses.length) {
                    // Stay within current split verses range, select the same count
                    const newSelection: string[] = []
                    for (let i = 0; i < selectionCount; i++) {
                        newSelection.push(splittedVerses[newIndex + i].id)
                    }
                    openVerse([newSelection])
                    if (isActiveInOutput) setTimeout(playScripture)
                    return
                } else if (newIndex < 0 || newIndex + selectionCount - 1 >= splittedVerses.length) {
                    // Need to move to next/previous chapter or book
                    // Fall through to the regular moveSelection logic below
                }
            }
        }

        let versesCount = verses?.length || 0 // splittedVerses.length

        // get length from previous chapter when moving left from verse 1
        const normalizedVerses = (verses || []).map((v) => getVerseIdParts(v.number).id)
        const firstVerse = normalizedVerses[0]
        if (moveLeft && firstVerse === 1) {
            // get verses count from previous chapter
            const chapterNumber = activeReference.chapters[0]
            const prevChapterIndex = (chapters || []).findIndex((c) => c.number?.toString() === chapterNumber?.toString()) - 1
            const prevChapter = chapters?.[prevChapterIndex]
            versesCount = prevChapter ? prevChapter.verses.length || chapterLengths[Number(chapterNumber) - 1] : 0
        }

        const lengths = {
            book: books?.length || 0,
            chapters: chapters?.length || 0,
            verses: versesCount
        }

        const selection = {
            book: Number(activeReference.book),
            chapters: [Number(activeReference.chapters[0])],
            verses: sortScriptureSelection(activeReference.verses[0] || [])
        }

        // store
        if (lengths.verses) chapterLengths[selection.chapters[0]] = lengths.verses

        const newSelection = moveSelection(lengths, selection, moveLeft)

        openBook(newSelection.book, newSelection.chapters, [newSelection.verses])

        if (isActiveInOutput) setTimeout(playScripture)
    }

    $: reference = getReference({ data, activeReference })
    function getReference(_updater: any) {
        const book = data[previewBibleId]?.bookData?.name || ""
        const referenceDivider = $scriptureSettings.referenceDivider || ":"
        const range = joinRange(sortScriptureSelection(activeReference.verses[0] || []))
        const reference = `${book} ${activeReference.chapters}${referenceDivider}${range}`
        return reference
    }
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} />

<div class="scroll" style="flex: 1;overflow-y: auto;">
    <div class="main scripture">
        {#if !previewBibleId || $notFound.bible?.includes(previewBibleId) || !$scriptures[previewBibleId] || apiError}
            <Center faded>
                <T id="error.bible{apiError ? '_api' : ''}" />
            </Center>
        {:else if contentSearchResults !== null}
            {#if contentSearchResults.length}
                <div class="verses verseList">
                    {#each contentSearchResults as match}
                        <span
                            class="verse"
                            class:showAllText={$resized.rightPanelDrawer <= 5}
                            on:dblclick={() => {
                                openBook(match.book, [match.chapter], [[match.verse.number]])
                                playWhenLoaded = true
                            }}
                            data-title={formatBibleText(match.verse.text)}
                        >
                            <span style="width: 250px;text-align: start;color: var(--text);" class="v">{match.reference}</span>{@html formatBibleText(match.verse.text, true)}
                        </span>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.search" />
                </Center>
            {/if}
        {:else if historyOpened}
            {#if currentHistory.length}
                <div class="verses verseList">
                    {#each currentHistory as verse}
                        <span
                            class="verse"
                            class:showAllText={$resized.rightPanelDrawer <= 5}
                            on:dblclick={() => {
                                openBook(verse.book, [verse.chapter], [[verse.verse]])
                                playWhenLoaded = true
                            }}
                            data-title={formatBibleText(verse.text)}
                        >
                            <span style="width: 250px;text-align: start;color: var(--text);" class="v">{verse.reference}</span>{@html formatBibleText(verse.text, true)}
                        </span>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.general" />
                </Center>
            {/if}
        {:else}
            <!-- LIST/GRID MODE -->
            <div class={$scriptureMode === "grid" ? "grid" : "list"}>
                <div class="books" bind:this={booksScrollElem} class:center={!books?.length}>
                    {#if books?.length}
                        {#key books}
                            {#each books as book, i}
                                {@const id = book.number?.toString()}
                                {@const color = booksData[i]?.category?.color || ""}
                                {@const name = $scriptureMode === "grid" ? booksData[i]?.abbreviation : $customScriptureBooks[previewBibleId]?.[i] || book.name}
                                {@const isActive = activeReference.book?.toString() === id}

                                <span {id} class={isApi || isCollection || !Object.values(defaultBibleBookNames).includes(book.name) ? "" : "context #bible_book_local"} class:isActive style="{color ? `border-${$scriptureMode === 'grid' ? 'bottom' : 'left'}: 2px solid ${color};` : ''}{$scriptureMode === 'grid' ? 'border-radius: 2px;' : ''}" on:click={() => openBook(id)} role="none">
                                    {name}
                                </span>
                            {/each}
                        {/key}
                    {:else}
                        <Loader />
                    {/if}
                </div>
                <div class="content">
                    <div class="chapters context #scripture_chapter" bind:this={chaptersScrollElem} style="text-align: center;" class:center={!chapters?.length}>
                        {#if chapters?.length}
                            {#each chapters as chapter}
                                {@const id = chapter.number.toString()}
                                {@const isActive = activeReference.chapters.find((cid) => cid.toString() === id)}

                                <span
                                    {id}
                                    class:isActive
                                    on:click={(e) => toggleChapter(e, id)}
                                    on:contextmenu={() => {
                                        openChapter([id])
                                        setTimeout(selectAllVerses)
                                    }}
                                    role="none"
                                >
                                    {chapter.number}
                                </span>
                            {/each}
                        {:else}
                            <Loader />
                        {/if}
                    </div>
                    <div class="verses context #scripture_verse" class:showFloatingButtons={$resized.rightPanelDrawer > 5 && splittedVerses.length > 10} bind:this={versesScrollElem} class:center={!splittedVerses.length}>
                        {#if splittedVerses.length}
                            {#each splittedVerses as content}
                                {@const { id, subverse, endNumber } = getVerseIdParts(content.id)}
                                {@const showSplitSuffix = $scriptureSettings.splitLongVersesSuffix}
                                {@const showSuffixInPicker = $scriptureMode === "grid" || (isCollection && $scriptureSettings.showAllVersions) ? true : showSplitSuffix}
                                {@const verseLabel = buildVerseLabel(id, subverse, endNumber, showSuffixInPicker)}
                                {@const isActive = activeReference.verses[activeReference.verses.length - 1]?.find((vid) => vid.toString() === content.id || vid.toString() === id.toString())}
                                {@const text = formatBibleText(content.text, true) || (isCollection ? '<span style="opacity: 0.6; font-size: 0.85em; margin: 0; padding: 0;">~</span>' : "")}
                                {@const collectionVerses = $scriptureSettings.showAllVersions && isCollection && $scriptureMode !== "grid" ? getCollectionVerses(content.id) : []}

                                <!-- custom drag -->
                                <span
                                    id={content.id.toString()}
                                    class="verse"
                                    class:showAllText={$resized.rightPanelDrawer <= 5}
                                    class:isActive
                                    class:collection-verse={isCollection && $scriptureMode !== "grid"}
                                    data-title="{text}<br><br>{translateText('tooltip.scripture')}"
                                    draggable="true"
                                    on:mousedown={(e) => openVerse(updateVersesSelection(e, content.id))}
                                    on:click={(e) => openVerse(updateVersesSelection(e, content.id, true))}
                                    on:click={(e) => (isActiveInOutput && !e.ctrlKey && !e.metaKey ? playScripture() : false)}
                                    on:dblclick={(e) => (isActiveInOutput && !e.ctrlKey && !e.metaKey ? false : playScripture())}
                                    role="none"
                                >
                                    <span class="v" style={endNumber && subverse && showSuffixInPicker ? "width: 60px;" : ""}
                                        >{verseLabel.base}{#if verseLabel.suffix}<span style="padding: 0;color: var(--text);opacity: 0.5;font-size: 0.8em;">{verseLabel.suffix}</span>{/if}</span
                                    >

                                    {#if $scriptureMode !== "grid"}
                                        {#if isCollection && $scriptureSettings.showAllVersions}
                                            <!-- Show all versions for collections -->
                                            <div class="collection-versions">
                                                {#each collectionVerses as cv, cvIndex}
                                                    <div class="version-item" style="--version-color: {getVersionColor(cvIndex)}; --version-bg: {getVersionBgColor(cvIndex)}">
                                                        <span class="version-text">
                                                            <!-- && cv.text !== collectionVerses.reduce((acc, v) => acc + v.text, "") -->
                                                            {#if cv.isSplit}
                                                                <span style="opacity: 0.6; font-size: 0.85em; margin: 0; padding: 0;">~</span>
                                                            {/if}
                                                            {@html formatBibleText(cv.text, true)}
                                                        </span>
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            {@html text}
                                        {/if}
                                    {/if}
                                </span>
                            {/each}

                            {#if $scriptureMode !== "grid"}
                                {#if previewBibleData?.metadata?.copyright}
                                    <copy>{previewBibleData?.metadata?.copyright}</copy>
                                {/if}
                            {/if}
                        {:else}
                            <Loader />
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

{#if $scriptureMode !== "grid"}
    <FloatingInputs side="left">
        <span class="version" style={isCollection && $scriptureSettings.showAllVersions === false ? "padding-left: 0;" : ""}>
            {#if previewBibleData?.name}
                <!-- swap translation preview in collections -->
                {#if isCollection && $scriptureSettings.showAllVersions}
                    <!--  -->
                {:else if isCollection}
                    <MaterialButton icon="refresh" on:click={() => swapPreviewBible(activeScriptureId)} title={$scriptures[activeScriptures[(previewBibleIndex + 1) % activeScriptures.length]]?.name || ""} style="padding-right: 0.2em;font-weight: normal;">
                        {#if isApi}<Icon id="web" style="margin: 0 5px;" size={0.8} white />{/if}
                        {previewBibleData.name}:
                    </MaterialButton>
                {:else}
                    {#if isApi}<Icon id="web" style="margin-right: 5px;" white />{/if}
                    <span style="opacity: 0.8;">{previewBibleData.name}:</span>
                {/if}

                {#key data}
                    {reference}

                    {#if isCollection}
                        <MaterialCheckbox
                            label="scripture.show_all"
                            checked={$scriptureSettings.showAllVersions}
                            on:change={(e) => {
                                scriptureSettings.update((s) => ({ ...s, showAllVersions: e.detail }))
                            }}
                            small
                        />
                    {/if}

                    <!-- WIP had some issues with selecting multiple verses -->
                    <!-- !NaN = temp solution to split long verses -->
                    <!-- {#if !currentBibleData?.verseData?.getReference()?.includes("NaN")}
                        {currentBibleData?.verseData?.getReference() || "..."}
                    {/if} -->
                {/key}
            {/if}
        </span>
    </FloatingInputs>
{/if}

{#if contentSearchFieldActive}
    <FloatingInputs>
        <TextInput placeholder={translateText("scripture.search")} value={contentSearchValue} on:input={searchValueChanged} on:change={searchInBible} style="width: 300px;border-radius: 20px;" autofocus />
    </FloatingInputs>
{:else if $scriptureMode !== "grid" || $resized.rightPanelDrawer > 5}
    <FloatingInputs arrow let:open>
        {#if open || isActiveInOutput}
            <MaterialButton disabled={activeReference.book?.toString() === "1" && !!activeReference.chapters.find((a) => a.toString() === "1") && !!activeReference.verses[0]?.find((a) => a.toString() === "1")} title="{translateText('preview._previous_slide')} [Ctrl+Arrow Left]" on:click={() => _moveSelection(true)}>
                <Icon size={1.3} id="previous" white={!isActiveInOutput} />
            </MaterialButton>
            <MaterialButton disabled={activeReference.book?.toString() === books?.length.toString() && activeReference.chapters.includes(chapters ? chapters.length : 1) && activeReference.verses[0]?.includes(verses ? verses.length : 1)} title="{translateText('preview._next_slide')} [Ctrl+Arrow Right]" on:click={() => _moveSelection(false)}>
                <Icon size={1.3} id="next" white={!isActiveInOutput} />
            </MaterialButton>
        {/if}

        <MaterialButton disabled={$outLocked} title={isActiveInOutput ? "preview._update [Ctrl+R]" : "menu._title_display"} on:click={playScripture}>
            <Icon size={isActiveInOutput ? 1.1 : 1.3} id={isActiveInOutput ? "refresh" : "play"} white={!isActiveInOutput} />
        </MaterialButton>

        <div class="divider" />

        <MaterialButton disabled={historyOpened} on:click={() => scriptureMode.set($scriptureMode === "list" ? "grid" : "list")} title="show.{[$scriptureMode === 'grid' ? 'grid' : 'list']}">
            <Icon size={1.3} id={$scriptureMode === "grid" ? "grid" : "list"} white />
        </MaterialButton>

        {#if open || $scriptureHistoryUsed}
            <div class="divider" />

            <MaterialButton
                disabled={!currentHistory.length && !historyOpened}
                isActive={historyOpened}
                on:click={() => {
                    historyOpened = !historyOpened
                    scriptureHistoryUsed.set(true)
                }}
                title="popup.history [Ctrl+H]"
            >
                <Icon size={1.2} id="history" white={!currentHistory.length} />
            </MaterialButton>
        {/if}

        <MaterialButton title="scripture.search [Ctrl+B]" on:click={() => (contentSearchFieldActive = true)}>
            <Icon size={1.1} id="search" white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
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

    .main .grid .verses.showFloatingButtons::after {
        content: "";
        display: block;
        width: 250px;
        height: 50px;
        flex-shrink: 0;
    }

    .main div.center {
        display: flex;
        align-content: center;
        justify-content: center;
    }

    .main span {
        padding: 4px 10px;
    }
    .main span.isActive,
    .main :global(p).isActive {
        background-color: var(--focus);
        outline: none;
    }
    .main span:hover:not(.isActive):not(.v),
    .main :global(p):hover:not(.isActive) {
        background-color: var(--hover);
    }
    .main span:focus,
    .main span:active:not(.isActive):not(.v),
    .main :global(p):focus,
    .main :global(p):active:not(.isActive) {
        background-color: var(--focus);
    }

    .main span.verse {
        width: 100%;
        padding: 4px 10px;

        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        /* text-align-last: justify; */
    }
    .main .list :global(.v),
    .main .verseList :global(.v) {
        color: var(--secondary);
        font-weight: bold;
        display: inline-block;
        width: 45px;
        margin-inline-end: 10px;
        text-align: center;
        white-space: nowrap;
    }
    .main span.verse.showAllText {
        white-space: initial;
    }
    /* .add, .wj, .w, .xt */
    /* .main :global(.add) {
    font-style: italic;
  } */
    .main :global(.wj) {
        color: #ff5050;
    }
    .main :global(.xt) {
        position: absolute;
        display: flex;
        width: 400px;
        white-space: initial;
        background-color: var(--primary-lighter);
        padding: 10px;

        display: none;
    }
    .main copy {
        opacity: 0.5;
        padding: 32px 120px;
        font-size: 0.8em;
        font-style: italic;
        width: 100%;
        text-align: center;
    }

    /* bible parts */
    .main :global(.uncertain) {
        opacity: 0.7;
        font-size: 0.8em;
        font-style: italic;
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

    /* GRID MODE */

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
    .grid .verses .v span {
        display: inline;
        flex: none;
        min-width: 0;
    }
    .grid .books span {
        min-width: 52px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
    }

    /* Version */

    .version {
        flex: 1;
        padding: 0 10px;
        display: flex;
        gap: 5px;
        align-items: center;
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

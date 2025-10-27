<script lang="ts">
    import JSONBible from "json-bible"
    import { ApiBible } from "json-bible/lib/api"
    import type { Verse } from "json-bible/lib/Bible"
    import type { VerseReference } from "json-bible/lib/reference"
    import { defaultBibleBookNames } from "../../../converters/bebliaBible"
    import {
        activeEdit,
        activeScripture,
        activeTriggerFunction,
        customScriptureBooks,
        notFound,
        openScripture,
        outLocked,
        outputs,
        resized,
        scriptureHistory,
        scriptureHistoryUsed,
        scriptureMode,
        scriptures,
        scriptureSettings,
        selected
    } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, rangeSelect } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { formatBibleText, getVerseIdParts, getVersePartLetter, loadJsonBible, moveSelection, outputIsScripture, playScripture, splitText, swapPreviewBible } from "./scripture"
    import { onMount } from "svelte"

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
    $: loadScripture(previewBibleId)

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
    $: verses = currentBibleData?.chapterData?.data?.verses || null

    // category color / abbreviation data
    $: booksData = currentBibleData?.bibleData?.getBooksData() || []

    let splittedVerses: (Verse & { id: string })[] = []
    $: splittedVerses = updateSplitted(verses, $scriptureSettings)

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
            data[id] = { bibleData: jsonBible }
        } catch (err) {
            console.error(err)
            if (isApi) apiError = true
            return
        }

        openBook()
    }

    function updateSplitted(verses: Verse[] | null, _updater: any) {
        if (!verses) return []
        if (!$scriptureSettings.splitLongVerses) return verses.map((verse) => ({ ...verse, id: verse.number.toString() + (verse.endNumber ? "-" + verse.endNumber : "") }))

        const chars = Number($scriptureSettings.longVersesChars || 100)
        const newVerses: (Verse & { id: string })[] = []
        verses.forEach((verse) => {
            let newVerseStrings = splitText(verse.text, chars)
            const end = verse.endNumber ? `-${verse.endNumber}` : ""

            for (let i = 0; i < newVerseStrings.length; i++) {
                const key = newVerseStrings.length === 1 ? "" : `_${i + 1}`
                newVerses.push({ ...verse, id: verse.number + key + end, text: newVerseStrings[i] })
            }
        })

        return newVerses
    }

    function toggleChapter(e: any, id: string) {
        if (e.ctrlKey || e.metaKey) {
            if (activeReference.chapters.find((cid) => cid.toString() === id)) {
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
        openBook(Number($openScripture.book), [$openScripture.chapter], $openScripture.verses)
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

    let isSelected = false
    function updateVersesSelection(e: any, verseNumber: string) {
        isSelected = true
        setTimeout(() => (isSelected = false), 20)

        const selectedVerses = clone(activeReference.verses)
        selectedVerses[selectedVerses.length - 1] = rangeSelect(e, selectedVerses[selectedVerses.length - 1], verseNumber)

        // drop action (create slide/show from drag&drop)
        selected.set({ id: "scripture", data: [] })

        return selectedVerses
    }

    $: if ($activeTriggerFunction === "scripture_selectAll") selectAllVerses()
    function selectAllVerses() {
        if (!verses) return
        openVerse([verses.map((a) => a.number)])
    }

    /// SEARCH ///

    $: if (searchValue.length) referenceSearch()

    let freezeInput: string | null = null
    function referenceSearch() {
        if (freezeInput) {
            searchValue = freezeInput
            return
        }

        // WIP multiple chapters search with ; or / divider ??

        const result = currentBibleData?.bibleData?.bookSearch(searchValue)
        if (!result) return

        if (result.autocompleted) searchValue = result.autocompleted

        if (result.book) {
            // BOOK
            openBook(result.book)

            // prevent inputs right after auto complete
            if (!result.chapter) {
                freezeInput = searchValue
                setTimeout(() => (freezeInput = null), 200)
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

    $: if ($activeTriggerFunction === "scripture_next") _moveSelection(false)
    $: if ($activeTriggerFunction === "scripture_previous") _moveSelection(true)
    function _moveSelection(moveLeft: boolean) {
        if (!activeReference.book) return

        const lengths = {
            book: books?.length || 0,
            chapters: chapters?.length || 0,
            verses: splittedVerses.length || 0
        }

        const selection = {
            book: Number(activeReference.book),
            chapters: [Number(activeReference.chapters[0])],
            verses: activeReference.verses[0] || []
        }

        const newSelection = moveSelection(lengths, selection, moveLeft)
        newSelection.verses = newSelection.verses

        openBook(newSelection.book, newSelection.chapters, [newSelection.verses])

        if (isActiveInOutput) setTimeout(playScripture)
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
                                openBook(verse.book, [verse.chapter], [verse.verse])
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

                                <span
                                    {id}
                                    class={isApi || isCollection || !Object.values(defaultBibleBookNames).includes(book.name) ? "" : "context #bible_book_local"}
                                    class:isActive
                                    style="{color ? `border-${$scriptureMode === 'grid' ? 'bottom' : 'left'}: 2px solid ${color};` : ''}{$scriptureMode === 'grid' ? 'border-radius: 2px;' : ''}"
                                    on:click={() => openBook(id)}
                                    role="none"
                                >
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
                    <div class="verses context #scripture_verse" bind:this={versesScrollElem} class:center={!splittedVerses.length}>
                        {#if splittedVerses.length}
                            {#each splittedVerses as content}
                                {@const { id, subverse, endNumber } = getVerseIdParts(content.id)}
                                {@const isActive = activeReference.verses[activeReference.verses.length - 1]?.find((vid) => vid.toString() === content.id || vid.toString() === id.toString())}
                                {@const text = formatBibleText(content.text, true)}

                                <!-- custom drag -->
                                <span
                                    id={content.id.toString()}
                                    class="verse"
                                    class:showAllText={$resized.rightPanelDrawer <= 5}
                                    class:isActive
                                    data-title="{text}<br><br>{translateText('tooltip.scripture')}"
                                    draggable="true"
                                    on:click={(e) => {
                                        openVerse(updateVersesSelection(e, content.id))
                                    }}
                                    on:dblclick={(e) => (isActiveInOutput && !e.ctrlKey && !e.metaKey ? false : playScripture())}
                                    on:click={(e) => (isActiveInOutput && !e.ctrlKey && !e.metaKey ? playScripture() : false)}
                                    role="none"
                                >
                                    <!-- on:mouseup={(e) => updateVersesSelection(e, id)}
                                    on:mousedown={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.shiftKey) return
                                        openVerse(id)
                                    }} -->
                                    <span class="v" style={endNumber && subverse ? "width: 60px;" : ""}>
                                        {id}{#if endNumber}-{endNumber}{/if}
                                        <!-- WIP style position not very good -->
                                        {#if subverse}<span style="padding: 0;color: var(--text);opacity: 0.5;font-size: 0.8em;">{getVersePartLetter(subverse)}</span>{/if}
                                    </span>

                                    {#if $scriptureMode !== "grid"}
                                        {@html text}
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
        <span style="flex: 1;padding: 0 10px;display: flex;gap: 5px;align-items: center;{isCollection ? 'padding-left: 0;' : ''}">
            {#if previewBibleData?.name}
                <!-- swap translation preview in collections -->
                {#if isCollection}
                    <MaterialButton
                        icon="refresh"
                        on:click={() => swapPreviewBible(activeScriptureId)}
                        title={$scriptures[activeScriptures[(previewBibleIndex + 1) % activeScriptures.length]]?.name || ""}
                        style="padding-right: 0.2em;font-weight: normal;"
                    >
                        {#if isApi}<Icon id="web" style="margin: 0 5px;" size={0.8} white />{/if}
                        {previewBibleData.name}:
                    </MaterialButton>
                {:else}
                    {#if isApi}<Icon id="web" style="margin-right: 5px;" white />{/if}
                    <span style="opacity: 0.8;">{previewBibleData.name}:</span>
                {/if}

                {#key data}
                    <!-- temp solution to split long verses -->
                    {#if !currentBibleData?.verseData?.getReference()?.includes("NaN")}
                        {currentBibleData?.verseData?.getReference() || "..."}
                    {/if}
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
            <MaterialButton
                disabled={activeReference.book?.toString() === "1" && !!activeReference.chapters.find((a) => a.toString() === "1") && !!activeReference.verses[0]?.find((a) => a.toString() === "1")}
                title="{translateText('preview._previous_slide')} [Ctrl+Arrow Left]"
                on:click={() => _moveSelection(true)}
            >
                <Icon size={1.3} id="previous" white={!isActiveInOutput} />
            </MaterialButton>
            <MaterialButton
                disabled={activeReference.book?.toString() === books?.length.toString() && activeReference.chapters.includes(chapters ? chapters.length : 1) && activeReference.verses[0]?.includes(verses ? verses.length : 1)}
                title="{translateText('preview._next_slide')} [Ctrl+Arrow Right]"
                on:click={() => _moveSelection(false)}
            >
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
    .grid .books span {
        min-width: 52px;
    }

    .grid .verses {
        color: var(--secondary);
        font-weight: bold;
    }
</style>

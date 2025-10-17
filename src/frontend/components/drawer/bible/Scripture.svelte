<script lang="ts">
    import JSONBible from "json-bible"
    import { ApiBible } from "json-bible/lib/api"
    import type { Verse } from "json-bible/lib/Bible"
    import type { VerseReference } from "json-bible/lib/reference"
    import { defaultBibleBookNames } from "../../../converters/bebliaBible"
    import { activeEdit, activeScripture, activeTriggerFunction, customScriptureBooks, notFound, outLocked, outputs, resized, scriptureHistory, scriptureHistoryUsed, scriptureMode, scriptures, scriptureSettings } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, rangeSelect } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { formatBibleText, getShortBookName, getVersePartLetter, loadJsonBible, moveSelection, playScripture, splitText } from "./scripture"

    export let active: string | null
    export let searchValue: string

    $: activeSubTab = active || ""
    // $: activeSubTab = $drawerTabsData.scripture?.activeSubTab || ""

    $: activeScriptures = [activeSubTab]
    $: if ($scriptures[activeSubTab]?.collection) activeScriptures = $scriptures[activeSubTab].collection!.versions || [activeSubTab]

    $: biblePreviewIndex = $scriptures[activeSubTab]?.biblePreviewIndex || 0
    $: previewBibleId = activeScriptures[biblePreviewIndex] || activeScriptures[0]
    $: displayedBible = $scriptures[previewBibleId] || null
    $: if (displayedBible?.copyright) displayedBible.metadata = { ...(displayedBible.metadata || {}), copyright: displayedBible.copyright }
    $: if (displayedBible?.customName) displayedBible.name = displayedBible.customName

    // Function to swap between available bible translations
    function swapDisplayedBible() {
        if (activeScriptures.length <= 1) return
        biblePreviewIndex = (biblePreviewIndex + 1) % activeScriptures.length

        scriptures.update((a) => {
            a[active!].biblePreviewIndex = biblePreviewIndex
            return a
        })
    }

    $: outputIsScripture = $outputs[getActiveOutputs($outputs, true, true, true)[0]]?.out?.slide?.id === "temp"

    function playOrClearScripture(forcePlay = false) {
        if (outputIsScripture && !forcePlay) {
            setOutput("slide", null)
            return
        }

        playScripture()
        // playScripture.set(true)
    }

    // auto load scriptures when changed
    $: if (previewBibleId) loadScripture(previewBibleId)

    let apiError = false

    let bookColors: string[] = []

    async function loadScripture(scriptureId: string) {
        if (data[scriptureId]) {
            openBook()
            return
        }

        try {
            const jsonBible = await loadJsonBible(scriptureId)

            data[scriptureId] = { bibleData: jsonBible }

            // book colors
            if (jsonBible.data.books.length === 66) bookColors = jsonBible.getDefaultBooks().colors
            else bookColors = []
        } catch (err) {
            console.error(err)
            if (isApi) apiError = true
            return
        }

        openBook()
    }

    type Reference = {
        book: number | string | null
        chapters: (number | string)[] // can have multiple chapters open
        verses: (number | string)[] // can have multiple verses open
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

    $: isApi = !!$scriptures[previewBibleId]?.api
    $: isCollection = !!$scriptures[previewBibleId]?.collection

    $: currentBibleData = data[previewBibleId] || null
    $: currentBible = currentBibleData?.bibleData?.data || null
    $: books = currentBible?.books || null
    $: chapters = currentBibleData?.bookData?.data?.chapters || null
    $: verses = currentBibleData?.chapterData?.data?.verses || null
    // $: chapters = books && activeReference.book ? books.find((b) => b.number === activeReference.book)?.chapters || null : null
    // $: verses = chapters && activeReference.chapters.length ? chapters.find((c) => c.number === activeReference.chapters[0])?.verses || null : null

    let splittedVerses: (Verse & { id: string })[] = []
    $: if (verses || $scriptureSettings.longVersesChars) splittedVerses = updateSplitted(previewBibleId)
    $: if (!verses) splittedVerses = []
    function updateSplitted(scriptureId: string) {
        const verses = data[scriptureId]?.chapterData?.data?.verses
        if (!verses) return []
        if (!$scriptureSettings.splitLongVerses) return verses.map((verse) => ({ ...verse, id: verse.number.toString() }))

        const chars = Number($scriptureSettings.longVersesChars || 100)
        const newVerses: (Verse & { id: string })[] = []
        verses.forEach((verse) => {
            let newVerseStrings = splitText(verse.text, chars)

            for (let i = 0; i < newVerseStrings.length; i++) {
                const key = newVerseStrings.length === 1 ? "" : `_${i + 1}`
                newVerses.push({ ...verse, id: verse.number + key, text: newVerseStrings[i] })
            }
        })

        return newVerses
    }

    async function openBook(bookNumber?: number | string, chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[]) {
        if (bookNumber) activeReference.chapters = []
        if (bookNumber) activeReference.verses = []

        bookNumber = bookNumber ?? activeReference.book ?? 1

        // if (activeReference.book === bookNumber && data[previewBibleId]?.bookData) {
        //     openChapter()
        //     return
        // }

        activeReference.book = bookNumber

        const currentData = data[previewBibleId]?.bibleData
        if (!currentData) return

        delete data[previewBibleId].bookData
        delete data[previewBibleId].chapterData
        delete data[previewBibleId].verseData
        data = data

        data[previewBibleId].bookData = await currentData.getBook(bookNumber)

        openChapter(chapterNumbers, verseNumbers)
    }

    // TODO: support multiple chapters
    async function openChapter(chapterNumbers?: (number | string)[], verseNumbers?: (number | string)[]) {
        if (chapterNumbers) activeReference.verses = []

        chapterNumbers = chapterNumbers?.length ? chapterNumbers : activeReference.chapters?.length ? activeReference.chapters : [1]

        // if (activeReference.book === null || data[previewBibleId]?.bookData === null) return
        // if (activeReference.chapters.includes(chapterNumbers[0]) && data[previewBibleId]?.chapterData) {
        //     openVerse()
        //     return
        // }

        activeReference.chapters = chapterNumbers

        const currentData = data[previewBibleId]?.bookData
        if (!currentData) return

        delete data[previewBibleId].chapterData
        delete data[previewBibleId].verseData
        data = data

        data[previewBibleId].chapterData = await currentData.getChapter(Number(chapterNumbers[0]))
        // translateText("toast.chapter_undefined")

        openVerse(verseNumbers)
    }

    async function openVerse(verseNumbers?: (number | string)[]) {
        verseNumbers = verseNumbers?.length ? verseNumbers : activeReference.verses.length ? activeReference.verses : [1]

        // if (activeReference.book === null || data.bookData === null || activeReference.chapters.length === 0 || data.chapterData === null) return
        // if (activeReference.verses.includes(verseNumbers[0])) return

        activeReference.verses = verseNumbers

        const currentData = data[previewBibleId]?.chapterData
        if (!currentData) return

        // data[previewBibleId].verseData = currentData.data.verses
        data[previewBibleId].verseData = currentData.getVerses(verseNumbers.map(Number))
        // translateText("toast.verse_undefined")
    }

    // update active reference
    $: if (activeReference.verses.length && activeReference.book !== null) {
        activeScripture.set({
            id: previewBibleId,
            reference: {
                book: activeReference.book,
                chapters: activeReference.chapters,
                verses: activeReference.verses
            }
        })
    }

    /////// AUTOSCROLL

    // autoscroll
    let booksScrollElem: HTMLElement | undefined
    let chaptersScrollElem: HTMLElement | undefined
    let versesScrollElem: HTMLElement | undefined
    $: if (active && activeReference.book) setTimeout(() => scrollToActive(booksScrollElem))
    $: if (active && activeReference.chapters.length) setTimeout(() => scrollToActive(chaptersScrollElem))
    $: if (active && activeReference.verses.length) setTimeout(() => scrollToActive(versesScrollElem))
    function scrollToActive(scrollElem) {
        if (!scrollElem || isSelected) return

        let selectedElemTop = scrollElem.querySelector(".active")?.offsetTop || 0

        // don't scroll if elem is in view
        let visibleElemPos = selectedElemTop - scrollElem.scrollTop
        if (visibleElemPos > 0 && visibleElemPos < scrollElem.offsetHeight) return

        // wait to allow user to click
        setTimeout(() => {
            scrollElem.scrollTo(0, Math.max(0, selectedElemTop - 70))
        }, 150)
    }

    /// SELECTION ///

    let isSelected = false
    function getVersesSelection(e: any, verseNumber: string) {
        isSelected = true
        setTimeout(() => (isSelected = false), 20)

        const selectedVerses = rangeSelect(e, activeReference.verses.map(Number), Number(verseNumber))

        // selected.set({ id: "scripture", data: [{ bibles, sorted: selectedVerses.sort((a, b) => a - b) }] })
        return selectedVerses
    }

    $: if ($activeTriggerFunction === "scripture_selectAll") selectAllVerses()
    function selectAllVerses() {
        openVerse(verses?.map((a) => a.number))
    }

    /// SEARCH ///

    $: if (searchValue.length) search()

    let freezeInput: string | null = null
    function search() {
        if (freezeInput) {
            searchValue = freezeInput
            return
        }

        const result = currentBibleData?.bibleData?.bookSearch(searchValue)
        if (!result) return

        if (result.autocompleted) searchValue = result.autocompleted

        if (result.book) {
            // BOOK
            openBook(result.book)

            if (!result.chapter) {
                freezeInput = searchValue
                setTimeout(() => (freezeInput = null), 200)
            }
        }

        if (result.chapter) {
            // CHAPTER
            openChapter([result.chapter])

            // VERSES
            if (result.verses.length) openVerse(result.verses)
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

    $: if (activeScripture) resetContentSearch()
    function resetContentSearch() {
        contentSearchValue = ""
        contentSearchResults = null
        contentSearchFieldActive = false
    }

    /// KEYBOARD SHORTCUTS ///

    function mouseup(e: any) {
        if (e.target.closest(".drawer")) return
        resetContentSearch()
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            resetContentSearch()
            return
        }

        if (e.key === "ArrowRight" && document.activeElement?.classList?.contains("search")) {
            if (searchValue.includes(" ") && searchValue.length > 3 && /\d/.test(searchValue) && !searchValue.includes(":")) {
                searchValue += ":"

                // move caret
                let searchInput: any = document.activeElement
                setTimeout(() => {
                    searchInput.selectionStart = searchInput.selectionEnd = 100
                })
            }

            return
        }

        if (!e.ctrlKey && !e.metaKey) return

        if (e.key === "r") {
            if (!outputIsScripture) return
            e.preventDefault()
            playOrClearScripture(true)
            return
        }

        if (e.key === "h") {
            e.preventDefault()
            history = !history
            scriptureHistoryUsed.set(true)
            return
        }

        if (e.key === "b") {
            contentSearchResults = null
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

        // if (!activeReference.verses.length) {
        //     if (verses) openVerse(moveLeft ? [verses[verses.length - 1].number] : [verses[0].number])
        //     return
        // }

        const lengths = {
            book: books?.length || 0,
            chapters: chapters?.length || 0,
            verses: splittedVerses.length || 0
        }

        const selection = {
            book: Number(activeReference.book),
            chapters: activeReference.chapters.map(Number),
            verses: activeReference.verses.map(Number)
        }

        const newSelection = moveSelection(lengths, selection, moveLeft)
        // TODO: splitted subverses
        newSelection.verses = newSelection.verses // .map((v) => splittedVerses[v].number)

        // const newVerseSelection = activeReference.verses.map((v) => {
        //     const index = splittedVerses.findIndex((sv) => sv.number.toString() === v.toString())
        //     return splittedVerses[moveLeft ? index - 1 : index + 1]?.number
        // })

        openBook(newSelection.book, newSelection.chapters, newSelection.verses)
        // openVerse(newVerseSelection.filter((v) => v !== undefined))

        if (outputIsScripture) setTimeout(() => playOrClearScripture(true))
    }

    /// HISTORY ///

    let history = false
    $: currentHistory = clone($scriptureHistory.filter((a) => a.id === previewBibleId)).reverse()
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} />

<div class="scroll" style="flex: 1;overflow-y: auto;">
    <div class="main scripture">
        {#if !previewBibleId || $notFound.bible?.find((a) => a.id === previewBibleId)}
            <Center faded>
                <T id="error.bible" />
            </Center>
        {:else if apiError}
            <Center faded>
                <T id="error.bible_api" />
            </Center>
        {:else if contentSearchResults !== null}
            {#if contentSearchResults.length}
                <div class="verses verseList">
                    {#each contentSearchResults as match}
                        <span
                            class="verse"
                            class:showAllText={$resized.rightPanelDrawer <= 5}
                            on:dblclick={() => {
                                openBook(match.book, [match.chapter], [match.verse.number])
                                setTimeout(
                                    () => {
                                        playOrClearScripture(true)
                                        resetContentSearch()
                                    },
                                    isApi ? 500 : 10
                                )
                            }}
                            data-title={formatBibleText(match.verse.text)}
                        >
                            <span style="width: 250px;text-align: start;color: var(--text);" class="v">{match.reference}</span>{@html formatBibleText(match.verse.text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                        </span>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.search" />
                </Center>
            {/if}
        {:else if history}
            {#if currentHistory.length}
                <div class="verses verseList">
                    {#each currentHistory as verse}
                        <span
                            class="verse"
                            class:showAllText={$resized.rightPanelDrawer <= 5}
                            on:dblclick={() => {
                                openBook(verse.book, [verse.chapter], [verse.verse])
                                setTimeout(() => playOrClearScripture(true), isApi ? 500 : 10)
                            }}
                            data-title={formatBibleText(verse.text)}
                        >
                            <span style="width: 250px;text-align: start;color: var(--text);" class="v">{verse.reference}</span>{@html formatBibleText(verse.text?.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                        </span>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.general" />
                </Center>
            {/if}
        {:else}
            <!-- LIST MODE -->
            <div class={$scriptureMode === "grid" ? "grid" : "list"}>
                <div class="books" bind:this={booksScrollElem} class:center={!books?.length}>
                    {#if books?.length}
                        {#key books}
                            {#each books as book, i}
                                {@const id = book.number?.toString()}
                                <!-- {@const color = getColorCode(books, book.id)} -->
                                <!-- {@const color = data[displayBibleId]?.bookData?.getCategory()?.color} -->
                                {@const color = bookColors?.[i] || ""}
                                {@const name = $scriptureMode === "grid" ? getShortBookName(previewBibleId, book, i) : $customScriptureBooks[previewBibleId]?.[id] || book.name}

                                <span
                                    {id}
                                    on:click={() => {
                                        openBook(id)
                                        // autoComplete = false
                                    }}
                                    role="none"
                                    class={isApi || isCollection || !Object.values(defaultBibleBookNames).includes(book.name) ? "" : "context #bible_book_local"}
                                    class:active={activeReference.book?.toString() === id}
                                    style="{color ? `border-${$scriptureMode === 'grid' ? 'bottom' : 'left'}: 2px solid ${color};` : ''}{$scriptureMode === 'grid' ? 'border-radius: 2px;' : ''}"
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

                                <span
                                    {id}
                                    on:click={() => {
                                        openChapter([id])
                                        // autoComplete = false
                                    }}
                                    role="none"
                                    class:active={activeReference.chapters.find((cid) => cid.toString() === id)}
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
                                {@const splitted = content.id.toString().split("_")}
                                {@const id = splitted[0]}
                                {@const subverse = Number(splitted[1] || 0)}

                                <!-- custom drag -->
                                <span
                                    class="verse"
                                    class:showAllText={$resized.rightPanelDrawer <= 5}
                                    {id}
                                    draggable="true"
                                    on:click={(e) => {
                                        openVerse(getVersesSelection(e, id))
                                    }}
                                    on:dblclick={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? false : playOrClearScripture(true))}
                                    on:click={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? playOrClearScripture(true) : false)}
                                    role="none"
                                    class:active={activeReference.verses.find((vid) => vid.toString() === id)}
                                    data-title="{formatBibleText(content.text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}<br><br>{translateText('tooltip.scripture')}"
                                >
                                    <!-- on:mouseup={(e) => selectVerse(e, id)}
                                    on:mousedown={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.shiftKey) return
                                        openVerse(id)
                                    }} -->
                                    <span class="v">
                                        {id}
                                        <!-- WIP style position not very good -->
                                        {#if subverse}<span style="padding: 0;color: var(--text);opacity: 0.5;font-size: 0.8em;">{getVersePartLetter(subverse)}</span>{/if}
                                    </span>

                                    {#if $scriptureMode !== "grid"}
                                        {@html formatBibleText(content.text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                                    {/if}
                                </span>
                            {/each}

                            {#if $scriptureMode !== "grid"}
                                {#if displayedBible?.metadata?.copyright}
                                    <copy>{displayedBible?.metadata?.copyright}</copy>
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
        <span style="flex: 1;padding: 0 10px;display: flex;gap: 5px;align-items: center;{activeScriptures.length > 1 ? 'padding-left: 0;' : ''}">
            <!-- {#if currentBibleData?.verseData} -->
            {#if displayedBible?.name}
                <!-- Translation swap button if there are multiple bibles -->
                {#if activeScriptures.length > 1}
                    <MaterialButton icon="refresh" on:click={swapDisplayedBible} title={$scriptures[activeScriptures[(biblePreviewIndex + 1) % activeScriptures.length]]?.name || ""} style="padding-right: 0.2em;font-weight: normal;">
                        {displayedBible.name}:
                    </MaterialButton>
                {:else}
                    {#if displayedBible?.api}<Icon id="web" style="margin-right: 5px;" white />{/if}
                    <span style="opacity: 0.8;">{displayedBible.name}:</span>
                {/if}

                {#key data}
                    {currentBibleData?.verseData?.getReference() || "..."}
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
        {#if open || outputIsScripture}
            <MaterialButton
                disabled={activeReference.book?.toString() === "1" && !!activeReference.chapters.find((a) => a.toString() === "1") && !!activeReference.verses.find((a) => a.toString() === "1")}
                title={translateText("preview._previous_slide")}
                on:click={() => _moveSelection(true)}
            >
                <Icon size={1.3} id="previous" white={!outputIsScripture} />
            </MaterialButton>
            <MaterialButton
                disabled={activeReference.book?.toString() === books?.length.toString() && activeReference.chapters.includes(chapters ? chapters.length : 1) && activeReference.verses.includes(verses ? verses.length : 1)}
                title={translateText("preview._next_slide")}
                on:click={() => _moveSelection(false)}
            >
                <Icon size={1.3} id="next" white={!outputIsScripture} />
            </MaterialButton>
        {/if}

        <MaterialButton disabled={$outLocked} title={outputIsScripture ? "preview._update [Ctrl+R]" : "menu._title_display"} on:click={() => playOrClearScripture(true)}>
            <Icon size={outputIsScripture ? 1.1 : 1.3} id={outputIsScripture ? "refresh" : "play"} white={!outputIsScripture} />
        </MaterialButton>

        <div class="divider" />

        <MaterialButton disabled={history} on:click={() => scriptureMode.set($scriptureMode === "list" ? "grid" : "list")} title="show.{[$scriptureMode === 'grid' ? 'grid' : 'list']}">
            <Icon size={1.3} id={$scriptureMode === "grid" ? "grid" : "list"} white />
        </MaterialButton>

        {#if open || $scriptureHistoryUsed}
            <div class="divider" />

            <MaterialButton
                disabled={!currentHistory.length && !history}
                active={history}
                on:click={() => {
                    history = !history
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
    .main span.active,
    .main :global(p).active {
        background-color: var(--focus);
        outline: none;
    }
    .main span:hover:not(.active):not(.v),
    .main :global(p):hover:not(.active) {
        background-color: var(--hover);
    }
    .main span:focus,
    .main span:active:not(.active):not(.v),
    .main :global(p):focus,
    .main :global(p):active:not(.active) {
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

<script lang="ts">
    import { onMount } from "svelte"
    import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
    import Loader from "../../main/Loader.svelte"
    // import type { Bible } from "../../../../types/Bible"
    import { BIBLE } from "../../../../types/Channels"
    import { activeScripture, bibleApiKey, dictionary, notFound, openScripture, outLocked, outputs, playScripture, scriptures, scripturesCache, selected } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import { fetchBible, joinRange, loadBible, searchBibleAPI } from "./scripture"
    import BibleApiKey from "./BibleApiKey.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    export let active: any
    export let bibles: Bible[]
    export let searchValue: string

    let books: { [key: string]: Book[] } = {}
    let chapters: { [key: string]: Chapter[] } = {}
    let versesList: { [key: string]: Verse[] } = {}

    let bookId: any = $activeScripture[active]?.bookId || "GEN"
    let chapterId: any = $activeScripture[active]?.chapterId || "GEN.1"
    let verses: { [key: string]: any[] } = $activeScripture[active]?.verses || {}

    let activeVerses: string[] = $activeScripture[active]?.activeVerses || ["1"]

    $: if (bookId || chapterId || verses || activeVerses) updateActive()
    function updateActive() {
        if (!loaded) return
        activeScripture.set({ ...$activeScripture, [active]: { bookId, chapterId, verses, activeVerses } })
    }

    let loaded: boolean = false
    onMount(() => {
        getBible()

        setTimeout(() => {
            loaded = true
        }, 2000)
    })

    let error: null | string = null

    let firstBibleId = ""
    // $: bibleId = $scriptures[active].collection?.versions[0] || active

    // select book & chapter when opening bible show reference
    $: if ($openScripture) setTimeout(openReference, 200)
    function openReference() {
        if (!$openScripture?.book) {
            openScripture.set(null)
            return
        }

        bookId = $openScripture.book

        setTimeout(() => {
            chapterId = Number($openScripture.chapter)
            if ($openScripture.api) {
                chapterId = bookId + "." + chapterId
            } else chapterId--
            // verses

            openScripture.set(null)
        }, 100)
    }

    function createBiblesList() {
        let selectedScriptureData = $scriptures[active] || Object.values($scriptures).find((a) => a.id === active)
        if (!selectedScriptureData) return

        let versions: string[] = [active]
        if (selectedScriptureData.collection?.versions) versions = selectedScriptureData.collection.versions
        firstBibleId = versions[0] || active

        bibles = versions.map((id) => {
            return { id, version: null, book: null, chapter: null, verses: [], activeVerses: [] }
        })
    }

    function getBibleId(index: number, bible: any = null) {
        let selectedScriptureData = $scriptures[active] || Object.values($scriptures).find((a) => a.id === active)
        return bible?.id || selectedScriptureData?.collection?.versions?.[index] || active
    }

    async function loadAPIBible(bibleId: string, load: string, index: number = 0) {
        error = null
        let data: any = null

        // fix chapterId beeing 0 instead of "GEN.1" for Bible.API
        if (typeof bookId === "number") bookId = "GEN"
        if (typeof chapterId === "number") chapterId = bookId + "." + (chapterId + 1)

        let objectId = Object.entries($scriptures).find(([_id, a]: any) => a.id === bibleId)?.[0] || ""
        if (load === "books" && $scriptures[objectId]?.books) {
            // load books cache
            data = $scriptures[objectId].books
        } else {
            try {
                data = await fetchBible(load, bibleId, { versesList: versesList[bibleId] || [], bookId, chapterId })

                // set books cache
                if (load === "books" && data?.length) {
                    scriptures.update((a) => {
                        a[objectId].books = data
                        a[objectId].cacheUpdate = new Date()
                        return a
                    })
                }
            } catch (err) {
                error = err
            }
        }

        if (!data) return

        let hasId = false
        switch (load) {
            case "books":
                data.forEach((d: Book) => {
                    if (d.id === bookId) hasId = true
                })
                if (!hasId) bookId = data[0].id

                books[bibleId] = data
                break
            case "chapters":
                data.forEach((d: Chapter) => {
                    if (d.id === chapterId) hasId = true
                })
                if (!hasId) chapterId = bookId + ".1"

                if (data[0].number === "intro") chapters[bibleId] = data.slice(1, data.length)
                else chapters[bibleId] = data
                break
            case "verses":
                versesList[bibleId] = data
                break
            case "versesText":
                verses[bibleId] = divide(data, index)
                bibles[index].verses = verses[bibleId]
                // WIP verses[id] =
                break
        }
    }

    function divide(data: VerseText, index: number = 0): VerseText[] {
        let newVerses: any = {}
        let verse: string

        data.content
            .toString()
            .split("span")
            .forEach((content) => {
                // let xt = /(<span class="xt"\b[^>]*>)[^<>]*(<\/span>)/i
                let brackets = / *\[[^\]]*]/g
                content = content.replace(brackets, "").replace(/(<([^>]+)>)/gi, "")
                if (content.includes("data-number")) {
                    verse = content.split('"')[1]
                    newVerses[verse] = ""
                } else if (content.includes("class")) {
                    newVerses[verse] += "<span" + content + "span>"
                } else {
                    let noHTML = ""
                    content.split(/<|>/).forEach((a) => {
                        if (a.length) noHTML += a
                    })
                    if (newVerses[verse] !== undefined) newVerses[verse] += noHTML
                }

                if (newVerses[verse]) newVerses[verse] = newVerses[verse].replaceAll("¶ ", "")
            })

        if (bibles[index]) bibles[index].copyright = data.copyright

        return newVerses
    }

    let notLoaded: boolean = false
    window.api.receive(BIBLE, (msg: any) => {
        if (msg.error === "not_found") {
            notLoaded = true
            notFound.update((a) => {
                a.bible.push({ id: msg.id })
                return a
            })
        } else if (msg.content) {
            scripturesCache.update((a) => {
                a[msg.content[0]] = msg.content[1]
                return a
            })

            if (!bibles) return console.error("could not find bibles")
            let currentIndex = msg.data?.index || 0
            if (!bibles[currentIndex]) return console.error("could not find bible at index")

            let id = msg.content[0] || msg.id

            bibles[currentIndex].version = $scriptures[id]?.customName || msg.content[1].name || $scriptures[id]?.name || ""
            bibles[currentIndex].copyright = msg.content[1].copyright || ""
            bibles[currentIndex].id = msg.content[0]
            books[id] = msg.content[1].books as any

            if (typeof bookId === "string") bookId = 0
        }
    })

    $: if (active) getBible()
    $: if (books[firstBibleId]?.length && bookId !== undefined) getBook()
    $: if (chapters[firstBibleId]?.length && chapterId !== undefined) getChapter()

    $: if (versesList[firstBibleId]?.length) getVerses()
    $: isApiVerses = !bibles[0]?.api && bibles[0]?.activeVerses
    $: if (isApiVerses) getVerses()

    function getBible() {
        notLoaded = false

        createBiblesList()
        if (!bibles) return

        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            bibles[i] = loadBible(id, i, bible)
            verses[id] = []

            if (!bibles[i]?.version) return

            if (bibles[i].api) loadAPIBible(id, "books")
            else if ($scripturesCache[id]) {
                books[id] = ($scripturesCache[id].books as any) || []
                bookId = $activeScripture[active]?.bookId || 0
            }
        })
    }

    function getBook() {
        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!books[id]) return

            bibles[i].bookId = bookId

            if (bible.api) {
                books[id].forEach((b) => {
                    if (b.id === bookId) bibles[i].book = b.name
                })
                loadAPIBible(id, "chapters")
            } else if (books[id][bookId]) {
                bibles[i].book = books[id][bookId].name || ""
                chapters[id] = (books[id][bookId] as any).chapters
                chapterId = $activeScripture[active]?.chapterId || 0
            }
        })
    }

    function getChapter() {
        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!chapters[id]) return

            if (bible.api) {
                chapters[id].forEach((c) => {
                    if (c.id === chapterId) bibles[i].chapter = c.number
                })
                loadAPIBible(id, "verses")
            } else if (chapters[id][chapterId]) {
                let content: any = {}
                bibles[i].chapter = (chapters[id][chapterId] as any).number || 0
                ;(chapters[id][chapterId] as any).verses?.forEach((a: any) => {
                    content[a.number] = a.value
                })
                verses[id] = content
            }

            selectFirstVerse(id, i)
        })
    }

    // prevent loop when loading collection with API Bible
    let preventLoop = false
    function getVerses() {
        if (preventLoop) return
        preventLoop = true
        setTimeout(() => {
            preventLoop = false
        }, 200)

        bibles.forEach(async (bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!verses[id]) return

            if (bible.api) {
                verses[id] = []
                await loadAPIBible(id, "versesText", i)
            } else {
                bibles[i].verses = verses[id]
            }

            selectFirstVerse(id, i)
        })
    }

    function selectFirstVerse(bibleId: string, index: number) {
        if (!verses[bibleId] || !bibles[index]) return

        if (loaded) activeVerses = activeVerses.length ? activeVerses.filter((a) => verses[bibleId]?.[a]) : ["1"]
        bibles[index].activeVerses = activeVerses
    }

    function selectVerse(e: any, id: string) {
        console.log(id)
        autoComplete = false

        if (e.ctrlKey || e.metaKey) {
            if (activeVerses.includes(id)) activeVerses = activeVerses.filter((a) => a !== id)
            else activeVerses = [...activeVerses, id]
        } else if (e.shiftKey && activeVerses.length) {
            let found = false
            let arr: any = verses[firstBibleId]
            let sorted = activeVerses.sort((a, b) => Number(a) - Number(b))[0]
            let first = id
            let last = sorted
            if (Number(id) > Number(sorted)) {
                first = last
                last = id
            }

            Object.keys(arr).forEach((id: any) => {
                if (id === first) found = true
                if (found && !activeVerses.includes(id)) activeVerses.push(id)
                if (id === last) found = false
            })
            activeVerses = activeVerses
            // } else if (activeVerses.length === 1 && activeVerses[0] === id) activeVerses = []
        } else if (!activeVerses.includes(id)) activeVerses = [id]

        bibles[0].activeVerses = activeVerses

        let sorted = activeVerses.sort((a, b) => Number(a) - Number(b)) || []
        selected.set({ id: "scripture", data: [{ bibles, sorted }] })
    }

    // search
    const updateSearchValue = (v: string) => (searchValue = v)

    let autoComplete: boolean = false
    // $: if (searchValue) autoComplete = true

    let searchValues: { [key: string]: any } = {
        bookName: "",
        book: "",
        chapter: "",
        verses: [],
    }

    $: if (searchValue) updateSearch()

    let tempDisableInputs: boolean = false
    let storedSearch = ""
    $: if (tempDisableInputs && searchValue) updateSearchValue(storedSearch)

    function updateSearch() {
        if (tempDisableInputs) return
        // if (!autoComplete) return
        if (searchValue.length < 2) {
            autoComplete = true
            searchValues = { bookName: "", book: "", chapter: "", verses: [] }
            return
        }

        searchValues.book = findBook()
        if (searchValues.book === "") {
            searchValues.bookName = ""
            return
        }

        resetContentSearch()

        if (bookId !== searchValues.book) {
            bookId = searchValues.book
            getBook()
            getChapter()
        }

        let bookLength = (searchValues.bookName + " ").length
        let searchEnd = searchValue.slice(bookLength)
        let splitChar = searchEnd.includes(":") ? ":" : searchEnd.includes(",") ? "," : searchEnd.includes(".") ? "." : ""
        let splittedEnd = splitChar ? searchEnd.split(splitChar) : [searchEnd]

        searchValues.chapter = findChapter({ splittedEnd })
        if (searchValues.chapter === "") return
        if (chapterId !== searchValues.chapter) {
            chapterId = searchValues.chapter
            getChapter()
        }

        searchValues.verses = findVerse({ splittedEnd })
        if (!searchValues.verses.length) return
        if (bibles[0].activeVerses !== searchValues.verses) {
            activeVerses = [...new Set(searchValues.verses)] as any
            activeVerses = activeVerses.map((a) => a.toString())
            bibles[0].activeVerses = activeVerses
        }
    }

    let searchBibleActive: boolean = false
    let contentSearch: string = ""
    let contentSearchActive: boolean = false
    let contentSearchMatches: any[] = []
    let tempCache: any = {}

    $: if (active) resetContentSearch()
    function resetContentSearch() {
        contentSearch = ""
        contentSearchActive = false
        searchBibleActive = false
    }

    function mouseup(e: any) {
        if (e.target.closest(".drawer") || contentSearch.length) return
        resetContentSearch()
    }

    async function searchInBible(e: any) {
        contentSearch = e.target?.value || ""
        contentSearchActive = false

        if (contentSearch.length < 3) {
            searchBibleActive = false
            return
        }

        if (tempCache[firstBibleId]?.[contentSearch]) {
            contentSearchMatches = tempCache[firstBibleId][contentSearch]
            contentSearchActive = true
        }

        let bible = bibles[0]
        if (!bible) return

        let matches: any[] = []
        if (bible.api) {
            let searchResult: any = await searchBibleAPI(active, contentSearch)
            matches = searchResult?.verses?.map((a) => ({ book: a.bookId, chapter: a.chapterId, verse: a.reference.slice(a.reference.indexOf(":") + 1), reference: a.reference, text: a.text, api: true }))
        } else {
            let allBooks: any[] = books[firstBibleId]
            allBooks.forEach((book, bookIndex) => {
                book.chapters.forEach((chapter, chapterIndex) => {
                    chapter.verses.forEach((verse) => {
                        if (verse.value?.toLowerCase().includes(contentSearch.toLowerCase()))
                            matches.push({ book: bookIndex, chapter: chapterIndex, verse: verse.number, reference: `${book.name} ${chapter.number}:${verse.number}`, text: verse.value })
                    })
                })
            })
        }

        contentSearchMatches = matches
        contentSearchActive = true

        if (!tempCache[firstBibleId]) tempCache[firstBibleId] = {}
        tempCache[firstBibleId][contentSearch] = matches
    }

    function findBook() {
        let booksList = books[firstBibleId]?.map((b: any, i: number) => ({ ...b, id: b.id || i })) || []

        let lowerSearch = searchValue.toLowerCase()
        let splittedSearch = lowerSearch.split(" ")

        // make an array with different combinations of words, starting from first word and adding more words
        splittedSearch.forEach((_, i) => {
            if (i === 0) return

            let index = 0
            let joinedValue = splittedSearch[0]
            while (index < i) {
                index++
                joinedValue += " " + splittedSearch[index]
            }

            splittedSearch.push(joinedValue)
        })

        // find the biggest string with a returned value
        let findMatches: any[] = []
        let matchingArray: any[] = []
        splittedSearch.forEach((value) => {
            matchingArray = []
            booksList.forEach((book: any) => {
                if (book.name.toLowerCase().includes(value)) matchingArray.push(book)
            })
            if (matchingArray.length) findMatches = matchingArray
        })

        // remove books with number if no number in start of search
        if (findMatches.length && !hasNumber(lowerSearch.slice(0, 3))) {
            findMatches = findMatches.filter((a) => !hasNumber(a.name))
        }

        let exactMatch = findMatches.find((a: any) => a.name === searchValues.bookName)
        if (!exactMatch && findMatches.length !== 1) return ""

        let matchingBook = exactMatch || findMatches[0]
        searchValues.bookName = matchingBook.name
        if (searchValues.book !== undefined && searchValues.book === matchingBook.id) return matchingBook.id

        let fullMatch = searchValue.toLowerCase().includes(matchingBook.name.toLowerCase() + " ")
        if (fullMatch || !autoComplete) return matchingBook.id

        // auto complete
        // let rest = searchValue.slice(match.length)
        updateSearchValue(matchingBook.name + " ") // + rest.trim()

        storedSearch = matchingBook.name + " "
        tempDisableInputs = true
        setTimeout(() => {
            tempDisableInputs = false
        }, 500)

        autoComplete = false

        return matchingBook.id
    }
    function hasNumber(str) {
        return /\d/.test(str)
    }

    function findChapter({ splittedEnd }) {
        let chapter: string = splittedEnd[0] || ""

        if (!chapter.length) return ""

        // GEN.1 || 0
        let formattedChapter: string | number | null = null
        chapters[firstBibleId]?.forEach((c, i) => {
            if (c.id?.replace(/\D+/g, "") === chapter) formattedChapter = c.id
            else if (c.number === chapter) formattedChapter = i
        })

        if (formattedChapter === null) {
            // if (isNaN(Number(chapter))) return ""
            if (chapter.length > 2) return ""
            let msg = $dictionary.toast?.chapter_undefined
            msg = msg.replace("{}", chapter)
            newToast(msg)
            return ""
        }

        // if (!autoComplete)
        // updateSearchValue(searchValues.bookName + " " + (splitChar ? [chapter, splittedEnd[1]].join(splitChar) : chapter))

        return formattedChapter
    }

    function findVerse({ splittedEnd }) {
        let verse: string = splittedEnd[1]

        // || !splitChar
        if (!verse?.length) return []

        // select range (GEN.1.1 || "1")
        let currentVerses: number[] = []
        verse.split("+").forEach((a) => {
            let split = a.split("-")

            if (split.length > 1 && split[1].length) {
                let number: any = Number(split[0])
                let end: any = Number(split[1])

                while (number <= end) {
                    currentVerses.push(number.toString())
                    number++
                }
            } else if (split[0].length) currentVerses.push(Number(split[0]))
        })

        if (!currentVerses.length) {
            return []
        } else if (currentVerses.length === 1 && verses[firstBibleId]) {
            if (currentVerses[0] > Object.keys(verses[firstBibleId]).length) {
                let msg = $dictionary.toast?.verse_undefined
                msg = msg.replace("{}", verse)
                if (verse.length < 3) newToast(msg)
            }
        }

        // if (!autoComplete)
        // updateSearchValue(searchValues.bookName + " " + [splittedEnd[0], verse].join(splitChar))

        return currentVerses
    }

    function keydown(e: any) {
        if (!e.ctrlKey && !e.metaKey) return

        if (e.key === "r") {
            e.preventDefault()
            playOrClearScripture(true)
            return
        }

        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return

        // go to next/previous verse
        let left = e.key.includes("Left")
        moveSelection(left)
    }

    function moveSelection(moveLeft: boolean) {
        if (!activeVerses.length) {
            activeVerses = [moveLeft ? Object.keys(verses[firstBibleId] || []).length.toString() : "1"]
            bibles[0].activeVerses = activeVerses
            return
        }

        let currentIndex: number = Number(moveLeft ? activeVerses[0] : activeVerses.at(-1))

        let newSelection: string[] = []
        ;[...Array(activeVerses.length)].map((_, i: number) => {
            let newIndex: number = moveLeft ? currentIndex - i - 1 : currentIndex + i + 1
            if (moveLeft ? newIndex > 0 : newIndex <= Object.keys(verses[firstBibleId] || []).length) newSelection.push(newIndex.toString())
        })
        if (newSelection.length) {
            activeVerses = newSelection.sort((a: any, b: any) => a - b)
            bibles[0].activeVerses = activeVerses
        }

        if (!outputIsScripture) return
        setTimeout(() => {
            playScripture.set(true)
        }, 10)
    }

    $: outputIsScripture = $outputs[getActiveOutputs()[0]]?.out?.slide?.id === "temp"

    function playOrClearScripture(forcePlay: boolean = false) {
        if (outputIsScripture && !forcePlay) {
            // let id = Object.keys(verses[firstBibleId] || {})[0]
            // console.log(activeVerses)
            // console.log(id)
            // showVerse(id)
            setOutput("slide", null)
            return
        }

        playScripture.set(true)
    }

    $: sortedVerses = bibles?.[0]?.activeVerses?.sort((a, b) => Number(a) - Number(b)) || []
    let verseRange = ""
    $: verseRange = sortedVerses.length ? joinRange(sortedVerses) : ""
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} />

<div class="scroll" style="flex: 1;overflow-y: auto;">
    <div class="main">
        {#if notLoaded || !bibles[0]}
            <Center faded>
                <T id="error.bible" />
            </Center>
        {:else if bibles[0].api && !$bibleApiKey}
            <BibleApiKey />
        {:else if error}
            <Center faded>
                <T id="error.bible_api" />
            </Center>
        {:else if contentSearchActive}
            {#if contentSearchMatches.length}
                <div class="verses">
                    {#each contentSearchMatches as match}
                        <p
                            on:dblclick={() => {
                                bookId = match.book
                                chapterId = match.chapter
                                selectVerse({}, match.verse)
                                setTimeout(() => playOrClearScripture(true), match.api ? 500 : 10)
                            }}
                            title={match.text.replaceAll("/ ", " ")}
                        >
                            <span style="width: 250px;text-align: left;color: var(--text);" class="v">{match.reference}</span>{@html match.text.replaceAll("/ ", " ")}
                        </p>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.search" />
                </Center>
            {/if}
        {:else}
            <div class:center={!books[firstBibleId]?.length}>
                {#if books[firstBibleId]?.length}
                    {#key books[firstBibleId]}
                        {#each books[firstBibleId] as book, i}
                            <span
                                on:click={() => {
                                    bibles[0].api ? (bookId = book.id) : (bookId = i)
                                    autoComplete = false
                                }}
                                class:active={bibles[0].api ? bookId === book.id : bookId === i}
                            >
                                {book.name}
                            </span>
                        {/each}
                    {/key}
                {:else}
                    <Loader />
                {/if}
            </div>
            <div style="text-align: center;" class:center={!chapters[firstBibleId]?.length}>
                {#if chapters[firstBibleId]?.length}
                    {#each chapters[firstBibleId] as chapter, i}
                        <span
                            on:click={() => {
                                bibles[0].api ? (chapterId = chapter.id) : (chapterId = i)
                                autoComplete = false
                            }}
                            class:active={bibles[0].api ? chapterId === chapter.id : chapterId === i}
                        >
                            {chapter.number}
                        </span>
                    {/each}
                {:else}
                    <Loader />
                {/if}
            </div>
            <div class="verses" class:center={!Object.keys(verses[firstBibleId] || {}).length}>
                {#if Object.keys(verses[firstBibleId] || {}).length}
                    {#each Object.entries(verses[firstBibleId] || {}) as [id, content]}
                        <!-- custom drag -->
                        <p draggable="true" on:mousedown={(e) => selectVerse(e, id)} on:dblclick={() => playOrClearScripture(true)} class:active={activeVerses.includes(id)} title={$dictionary.tooltip?.scripture}>
                            <span class="v">{id}</span>{@html content.replaceAll("/ ", " ")}
                        </p>
                    {/each}
                    {#if bibles[0].copyright}
                        <copy>{bibles[0].copyright}</copy>
                    {/if}
                {:else}
                    <Loader />
                {/if}
            </div>
        {/if}
    </div>
</div>

<div class="tabs" style="display: flex;align-items: center;">
    <!-- text-align: center; -->
    <span style="flex: 1;padding: 0 10px;">
        {#if bibles[0]?.version}
            <span style="opacity: 0.8;">{bibles[0].version}:</span>
            {bibles[0]?.book || ""}
            {bibles[0]?.chapter || ""}{#if verseRange.length}:{verseRange}{/if}
        {/if}
    </span>
    <!-- <div class="seperator" /> -->
    <!-- TODO: change view (grid easy select) ? -->

    <div class="seperator" />

    {#if searchBibleActive}
        <TextInput placeholder={$dictionary.scripture?.search} value={contentSearch} on:change={searchInBible} style="width: 300px;" autofocus />
    {:else}
        <Button disabled={activeVerses.includes("1")} title={$dictionary.preview?._previous_slide} on:click={() => moveSelection(true)}>
            <Icon size={1.3} id="previous" />
        </Button>
        <Button disabled={$outLocked} title={outputIsScripture ? $dictionary.preview?._update : $dictionary.menu?._title_display} on:click={() => playOrClearScripture(true)}>
            <Icon size={outputIsScripture ? 1.1 : 1.3} id={outputIsScripture ? "refresh" : "play"} white={!outputIsScripture} />
        </Button>
        <Button disabled={Object.keys(verses[firstBibleId] || {}).length && activeVerses.includes(Object.keys(verses[firstBibleId] || {}).length.toString())} title={$dictionary.preview?._next_slide} on:click={() => moveSelection(false)}>
            <Icon size={1.3} id="next" />
        </Button>

        <div class="seperator" />
        <Button title={$dictionary.scripture?.search} on:click={() => (searchBibleActive = true)}>
            <Icon size={1.1} id="search" white />
        </Button>
    {/if}
</div>

<style>
    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }
    .seperator {
        width: 2px;
        height: 100%;
        background-color: var(--primary);
    }

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
    }
    .main div:not(.verses) {
        border-right: 2px solid var(--primary-lighter);
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
    .main span:hover:not(.active),
    .main :global(p):hover:not(.active) {
        background-color: var(--hover);
    }
    .main span:focus,
    .main span:active:not(.active),
    .main :global(p):focus,
    .main :global(p):active:not(.active) {
        background-color: var(--focus);
    }

    .main :global(p) {
        width: 100%;
        padding: 4px 10px;
        /* text-align-last: justify; */
    }
    .main :global(.v) {
        color: var(--secondary);
        font-weight: bold;
        display: inline-block;
        width: 45px;
        margin-right: 10px;
        text-align: center;
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
</style>

<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BIBLE } from "../../../../types/Channels"
    import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
    import { activeEdit, activeScripture, activeTriggerFunction, dictionary, notFound, openScripture, os, outLocked, outputs, playScripture, resized, scriptureHistory, scriptures, scripturesCache, selected } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { destroy } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, removeDuplicates } from "../../helpers/array"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { bookIds, fetchBible, formatBibleText, getColorCode, joinRange, loadBible, receiveBibleContent, searchBibleAPI, setBooksCache } from "./scripture"

    export let active: any
    export let bibles: Bible[]
    export let searchValue: string

    let books: { [key: string]: Book[] } = {}
    let chapters: { [key: string]: Chapter[] } = {}
    let verses: { [key: string]: { [key: string]: string } } = {}

    let cachedRef: any = {}
    if ($activeScripture) cachedRef = $activeScripture[bibles[0]?.api ? "api" : "bible"] || {}
    let bookId: any = cachedRef?.bookId ?? "GEN"
    let chapterId: any = cachedRef?.chapterId ?? "GEN.1"
    let activeVerses: string[] = cachedRef?.activeVerses || ["1"]

    $: if (bookId || chapterId || verses || activeVerses) updateActive()
    function updateActive() {
        if (!loaded) return

        activeScripture.set({ ...$activeScripture, [bibles[0]?.api ? "api" : "bible"]: { bookId, chapterId, activeVerses } })
        cachedRef = $activeScripture[bibles[0]?.api ? "api" : "bible"] || {}
    }

    let error: null | string = null

    let firstBibleId = ""

    // select book & chapter when opening bible show reference
    $: if ($openScripture) setTimeout(openReference, 200)
    function openReference() {
        if ($openScripture?.book === undefined) {
            openScripture.set(null)
            return
        }

        bookId = $openScripture.book

        setTimeout(() => {
            chapterId = Number($openScripture.chapter)
            if ($openScripture.api) chapterId = bookId + "." + chapterId
            else chapterId--

            // verses
            activeVerses = $openScripture.verses
            bibles[0].activeVerses = activeVerses

            openScripture.set(null)
        }, 100)
    }

    function createBiblesList() {
        let selectedScriptureData = $scriptures[active]
        if (!selectedScriptureData) return

        let versions: string[] = [selectedScriptureData.id || active]
        if (selectedScriptureData.collection?.versions) versions = selectedScriptureData.collection.versions
        firstBibleId = versions[0]

        bibles = versions.map((id) => {
            return { id, version: null, book: null, chapter: null, verses: [], activeVerses: [] }
        })
    }

    function getBibleId(index: number, bible: any = null) {
        let selectedScriptureData = $scriptures[active]
        let bibleId = selectedScriptureData?.collection?.versions?.[index] || selectedScriptureData?.id || bible?.id || active
        return bibleId
    }

    let versesList: { [key: string]: Verse[] } = {}
    async function loadAPIBible(bibleId: string, load: string, index: number = 0) {
        error = null
        let data: any = null

        // fix chapterId beeing 0 instead of "GEN.1" for Bible.API
        if (typeof bookId === "number") bookId = bookIds[bookId] || "GEN"
        if (typeof chapterId === "number") chapterId = bookId + "." + (chapterId + 1)

        let objectId = Object.entries($scriptures).find(([_id, a]: any) => a.id === bibleId)?.[0] || ""
        if (load === "books" && $scriptures[objectId]?.books) {
            // load books cache
            data = $scriptures[objectId].books
        } else {
            try {
                // get actual api id from the abbr
                let apiId = $scriptures[bibleId]?.id || bibleId
                data = await fetchBible(load, apiId, { versesList: versesList[bibleId] || [], bookId, chapterId })
                // WIP will always not work if previous local selected Bible has unknown chapter index..

                if (load === "books" && data?.length) setBooksCache(objectId, data)
            } catch (err) {
                if (bibles[0].api) error = err
            }
        }

        if (!data) return

        let hasId = false
        switch (load) {
            case "books":
                data.forEach((d: Book) => {
                    if (d.id === bookId) hasId = true
                })
                if (!hasId) {
                    bookId = cachedRef?.bookId
                    if (!data[bookId]) bookId = data[0].id
                }

                books[bibleId] = data
                break
            case "chapters":
                data.forEach((d: Chapter) => {
                    if (d.id === chapterId) hasId = true
                })
                if (!hasId) {
                    chapterId = cachedRef?.chapterId
                    if (!data[chapterId]) chapterId = bookId + ".1"
                }

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

    function divide(data: VerseText, index: number = 0): { [key: string]: string } {
        let newVerses: any = {}
        let verse: string

        data.content.toString().split("span").forEach(trimVerse)
        function trimVerse(content) {
            // let xt = /(<span class="xt"\b[^>]*>)[^<>]*(<\/span>)/i
            let brackets = / *\[[0-9\]]*]/g // remove [1], not [text]
            content = content.replace(brackets, "").replace(/(<([^>]+)>)/gi, "")

            if (content.includes("data-number")) {
                verse = content.split('"')[1]
                newVerses[verse] = ""
            } else if (content.includes("class")) {
                newVerses[verse] += "<span" + content + "span>"
            } else {
                let noHTML = ""
                content.split(/<|>/).forEach((a) => {
                    noHTML += a || ""
                })
                if (newVerses[verse] !== undefined) newVerses[verse] += noHTML
            }

            if (newVerses[verse]) newVerses[verse] = newVerses[verse].replaceAll("¶ ", "")
        }

        if (bibles[index]) {
            bibles[index].metadata = data.metadata || {}
            if (data.copyright) bibles[index].metadata.copyright = data.copyright
        }

        return newVerses
    }

    let listenerId = uid()
    onDestroy(() => destroy(BIBLE, listenerId))

    let notLoaded: boolean = false
    window.api.receive(BIBLE, receiveContent, listenerId)
    function receiveContent(msg: any) {
        if (msg.error === "not_found") {
            notLoaded = true
            notFound.update((a) => {
                a.bible.push({ id: msg.id })
                return a
            })

            return
        }

        if (!bibles) return console.error("could not find bibles")
        let currentIndex = msg.data?.index || 0
        if (!bibles[currentIndex]) return console.error("could not find bible at index")

        const content = receiveBibleContent(msg)
        bibles[currentIndex] = content

        let id = msg.content[0] || msg.id
        books[id] = content.books as any

        if (typeof bookId === "string") bookId = 0
        if (books[id][cachedRef?.bookId]) bookId = cachedRef?.bookId
    }

    $: if (active) getBible()
    $: if (books[firstBibleId]?.length && bookId !== undefined) getBook()
    $: if (chapters[firstBibleId]?.length && chapterId !== undefined) getChapter()
    $: if (Object.keys(verses?.[firstBibleId] || {})?.length) getVerses()

    function getBible() {
        notLoaded = false

        createBiblesList()
        if (!bibles) return

        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            bibles[i] = loadBible(id, i, bible)
            verses[id] = {}

            if (!bibles[i]?.version) return

            if (bibles[i].api) loadAPIBible(id, "books", i)
            else if ($scripturesCache[id]) {
                books[id] = ($scripturesCache[id].books as any) || []
                bookId = cachedRef?.bookId || 0
                if (typeof bookId === "string") bookId = bookIds.findIndex((a) => a === bookId)
                if (!books[id][bookId]) bookId = 0
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
                loadAPIBible(id, "chapters", i)
            } else if (books[id][bookId]) {
                bibles[i].book = books[id][bookId].name || ""
                chapters[id] = (books[id][bookId] as any).chapters

                chapterId = cachedRef?.chapterId || 0
                if (typeof chapterId === "string") chapterId = Number(chapterId.split(".")[1]) - 1
                if (!chapters[id][chapterId]) chapterId = 0
            }
        })
    }

    function getChapter() {
        bibles.forEach(async (bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!chapters[id]) return

            if (bible.api) {
                chapters[id].forEach((c) => {
                    if (c.id === chapterId) bibles[i].chapter = c.number
                })

                verses[id] = {}
                await loadAPIBible(id, "verses", i)
                await loadAPIBible(id, "versesText", i)
            } else if (chapters[id][chapterId]) {
                let content: any = {}
                bibles[i].chapter = (chapters[id][chapterId] as any).number || 0
                ;(chapters[id][chapterId] as any).verses?.forEach((a: any) => {
                    content[a.number] = a.text || a.value || ""
                })

                verses[id] = content
                bibles[i].verses = verses[id]
            }
        })
    }

    function getVerses() {
        bibles.forEach(async (bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!verses[id]) return

            bibles[i].verses = verses[id]

            selectFirstVerse(id, i)
        })
    }

    let loaded: boolean = false
    $: if (active) loaded = false
    function selectFirstVerse(bibleId: string, index: number) {
        if (!verses[bibleId] || !bibles[index]) return

        if (cachedRef?.activeVerses?.length && verses[bibleId]?.[cachedRef?.activeVerses[0]]) {
            activeVerses = cachedRef.activeVerses
        } else if (loaded) {
            activeVerses = activeVerses.length ? activeVerses.filter((a) => verses[bibleId]?.[a]) : ["1"]
        }

        updateActiveVerses(index)

        // timeout here because svelte updates ($: if (active) loaded = false) after this (should be before)
        setTimeout(() => (loaded = true))
    }

    function updateActiveVerses(bibleIndex: number = 0) {
        bibles[bibleIndex].activeVerses = activeVerses

        // add to selected (for drag/drop)
        let sorted = activeVerses.sort((a, b) => Number(a) - Number(b)) || []
        selected.set({ id: "scripture", data: [{ bibles, sorted }] })
    }

    function selectVerse(e: any, id: string) {
        autoComplete = false
        const rightClick: boolean = e.button === 2 || e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

        if (e.ctrlKey || e.metaKey) {
            if (activeVerses.includes(id)) {
                if (activeVerses.length === 1) return
                activeVerses = activeVerses.filter((a) => a !== id)
            } else activeVerses = [...activeVerses, id]
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
        } else if (!rightClick) activeVerses = [id]

        updateActiveVerses()
    }

    // search
    const updateSearchValue = (v: string) => (searchValue = v)

    // let mainElem: any = null
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

        // this should auto update when e.g. bookId changed, but it does not
        setTimeout(updateActive, 1000)

        if (bookId !== searchValues.book) {
            bookId = searchValues.book
            getBook()
            getChapter()
        }

        let bookLength = (searchValues.bookName + " ").length
        let searchEnd = searchValue.slice(bookLength)
        let splitChar = searchEnd.includes(":") ? ":" : searchEnd.includes(",") ? "," : searchEnd.includes(".") ? "." : ""
        let splittedEnd = splitChar ? searchEnd.split(splitChar) : [searchEnd]
        splittedEnd = splittedEnd.filter((a) => a.trim())

        searchValues.chapter = findChapter({ splittedEnd })
        if (searchValues.chapter === "") return
        if (chapterId !== searchValues.chapter) {
            chapterId = searchValues.chapter
            getChapter()
        }
        if (splittedEnd.length === 1 && splittedEnd[0].endsWith(" ")) updateSearchValue(searchValue.trim() + ":")
        if (splittedEnd.length === 1 && searchValue.endsWith(" ")) updateSearchValue(searchValue.trim())

        searchValues.verses = findVerse({ splittedEnd })
        if (!searchValues.verses.length) return selectAllVerses()
        if (bibles[0].activeVerses !== searchValues.verses) {
            activeVerses = removeDuplicates(searchValues.verses)
            activeVerses = activeVerses.map((a) => a.toString())
            bibles[0].activeVerses = activeVerses

            let trimmed = splittedEnd[1].trim()
            if (trimmed.length && !trimmed.endsWith("-") && !trimmed.endsWith("+")) {
                const minus = (searchValue.match(/-/g) || []).length
                const plus = (searchValue.match(/\+/g) || []).length
                if (splittedEnd[1].endsWith(" ")) updateSearchValue(searchValue.trim() + (minus === plus ? "-" : "+"))
            } else {
                updateSearchValue(searchValue.trim())
            }
        }
        if (splittedEnd[1]?.endsWith(" ")) updateSearchValue(searchValue.trim())
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
        // || contentSearch.length
        if (e.target.closest(".drawer")) return
        resetContentSearch()
    }

    // auto search when char length is 5 or longer
    function searchValueChanged(e: any) {
        contentSearch = e.target?.value || ""
        if (contentSearch.length < 5) {
            contentSearchActive = false
            return
        }

        searchInBible(e)
    }
    let previousSearch: string = ""
    let cachedSearches: number = 0
    async function searchInBible(e: any) {
        contentSearch = e.target?.value || ""
        contentSearchActive = false

        if (contentSearch.length < 3) {
            searchBibleActive = false
            return
        }

        let searchValue = formatText(contentSearch)

        if (tempCache[firstBibleId]?.[searchValue]?.length) {
            contentSearchMatches = tempCache[firstBibleId][searchValue]
            contentSearchActive = true
            return
        }

        let bible = bibles[0]
        if (!bible) return

        let matches: any[] = []

        // if new search includes previous search, then just search through previously filtered data
        // Bible.API will only give a fixed result, so search that again when "cachedSearches" is more than 5
        if (previousSearch && searchValue.includes(previousSearch) && (!bible.api || cachedSearches < 5) && contentSearchMatches?.length) {
            matches = contentSearchMatches.filter((a) => formatText(a.text).includes(searchValue))
            cachedSearches++
        } else if (bible.api) {
            let bibleId: string = getBibleId(0, bible)
            let apiId = $scriptures[bibleId]?.id || bibleId
            let searchResult: any = await searchBibleAPI(apiId, contentSearch)
            matches = searchResult?.verses?.map((a) => ({ book: a.bookId, chapter: a.chapterId, verse: a.reference.slice(a.reference.indexOf(":") + 1), reference: a.reference, text: a.text, api: true })) || []
        } else {
            matches = await bibleContentSearch(searchValue)
        }

        contentSearchMatches = matches
        contentSearchActive = true
        previousSearch = searchValue

        if (!tempCache[firstBibleId]) tempCache[firstBibleId] = {}
        tempCache[firstBibleId][searchValue] = matches

        function formatText(text: string) {
            if (!text) return ""
            return text.toLowerCase().replace(/[`!*()-?;:'",.]/gi, "")
        }

        function bibleContentSearch(searchValue: string): Promise<any[]> {
            let matches: any[] = []
            let extraMatches: any[] = []
            let allBooks: any[] = books[firstBibleId]

            return new Promise((resolve) => {
                allBooks.forEach((book, bookIndex) => {
                    book.chapters.forEach((chapter, chapterIndex) => {
                        chapter.verses.forEach((verse) => {
                            let verseValue = formatText(verse.text || verse.value || "")
                            if (verseValue.includes(searchValue)) {
                                matches.push({ book: bookIndex, chapter: chapterIndex, verse: verse.number, reference: `${book.name} ${chapter.number}:${verse.number}`, text: verse.text || verse.value })
                            } else {
                                let wordInSearch = searchValue.split(" ")
                                let matchingWords = wordInSearch.reduce((count, word) => (count += verseValue.includes(word) ? 1 : 0), 0)
                                if (matchingWords === wordInSearch.length)
                                    extraMatches.push({ book: bookIndex, chapter: chapterIndex, verse: verse.number, reference: `${book.name} ${chapter.number}:${verse.number}`, text: verse.text || verse.value || "" })
                            }
                        })
                    })
                })

                matches.push(...extraMatches)
                resolve(matches)
            })
        }
    }

    function findBook() {
        let booksList = books[firstBibleId]?.map((b: any, i: number) => ({ ...b, id: b.id || i, abbr: b.id })) || []

        let lowerSearch = formatBookSearch(searchValue)
        let splittedSearch = lowerSearch.split(" ")

        // search by abbreviation (id)
        if (searchValue.endsWith(" ") && splittedSearch.length === 2) {
            const book = booksList.find((a) => a.abbr && formatBookSearch(a.abbr) === splittedSearch[0])
            if (book) {
                updateSearchValue(book.name + " ")
                return book.id
            }
        }

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

        // remove just numbers not at start
        const isNumber = (a) => /^\d+$/.test(a)
        splittedSearch = splittedSearch.filter((a, i) => i < 1 || !isNumber(a))

        // find the biggest string with a returned value
        let findMatches: any[] = []
        splittedSearch.forEach((value) => {
            let matchingArray: any[] = []

            booksList.forEach((book: any) => {
                let bookName = formatBookSearch(book.name)
                if (bookName.includes(value) || bookName.replaceAll(" ", "").includes(value)) matchingArray.push(book)
            })

            if (matchingArray.length) findMatches = matchingArray
        })

        // remove books with number if no number in start of search
        if (findMatches.length && !hasNumber(lowerSearch.slice(0, 3))) {
            findMatches = findMatches.filter((a) => !hasNumber(a.name))
        }

        let exactMatch = findMatches.find((a: any) => a.name === searchValues.bookName)
        if (!exactMatch && findMatches.length !== 1) {
            // autocomplete e.g. "First ..."
            const firstWordMatch = [...new Set(findMatches.map((a) => a.name.split(" ")[0]))]
            if (firstWordMatch.length === 1 && !hasNumber(lowerSearch.slice(0, 3))) {
                updateSearchValue(firstWordMatch[0] + " ")
                storedSearch = firstWordMatch[0] + " "
                tempDisableInputs = true
                setTimeout(() => (tempDisableInputs = false), 400)
            }
            return ""
        }

        let matchingBook = exactMatch || findMatches[0]
        searchValues.bookName = matchingBook.name
        if (searchValues.book !== undefined && searchValues.book === matchingBook.id) return matchingBook.id

        let fullMatch = formatBookSearch(searchValue).includes(formatBookSearch(matchingBook.name) + " ")
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
    function formatBookSearch(value: string) {
        // replace diacritic values like á -> a & ö -> o
        // https://stackoverflow.com/a/37511463/10803046
        return value
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/[!()-,.]/gi, "")
            .toLowerCase()
    }
    function hasNumber(str) {
        return /\d/.test(str)
    }

    function findChapter({ splittedEnd }) {
        let chapter: string = splittedEnd[0]?.trim() || ""

        if (!chapter.length) return ""

        // GEN.1 || 0
        let formattedChapter: string | number | null = null
        chapters[firstBibleId]?.forEach((c, i) => {
            if (c.id?.replace(/\D+/g, "") === chapter) formattedChapter = c.id
            else if (c.number.toString() === chapter) formattedChapter = i
        })

        if (formattedChapter === null) {
            // if (isNaN(Number(chapter))) return ""
            if (chapter.length > 2) return ""
            let msg = $dictionary.toast?.chapter_undefined || ""
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
            let split = a.split("-").filter((a) => a.trim())

            if (split.length > 1 && split[1].length) {
                let number: any = Number(split[0])
                let end: any = Number(split[1])

                // inverted order
                if (end < number) {
                    let tempStart = number
                    number = end
                    end = tempStart
                }

                while (number <= end) {
                    currentVerses.push(number.toString())
                    number++
                }
            } else if (split[0]?.length) currentVerses.push(Number(split[0]))
        })

        if (!currentVerses.length) {
            return []
        } else if (currentVerses.length === 1 && verses[firstBibleId]) {
            if (currentVerses[0] > Object.keys(verses[firstBibleId]).length) {
                let msg = $dictionary.toast?.verse_undefined || ""
                msg = msg.replace("{}", verse)
                if (verse.length < 3) newToast(msg)
            }
        }

        // if (!autoComplete)
        // updateSearchValue(searchValues.bookName + " " + [splittedEnd[0], verse].join(splitChar))

        return currentVerses
    }

    function keydown(e: any) {
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

        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        if ($activeEdit.items.length) return

        // go to next/previous verse
        let left = e.key.includes("Left")
        moveSelection(left)
    }

    $: if ($activeTriggerFunction === "scripture_selectAll") selectAllVerses()
    function selectAllVerses() {
        let currentVerses: string[] = []
        Object.keys(verses[firstBibleId]).forEach((id) => {
            currentVerses.push(id)
        })

        activeVerses = currentVerses
        updateActiveVerses()
    }

    function moveSelection(moveLeft: boolean) {
        if (!activeVerses.length) {
            activeVerses = [moveLeft ? Object.keys(verses[firstBibleId] || []).length.toString() : "1"]
            bibles[0].activeVerses = activeVerses
            return
        }

        let currentIndex: number = Number(moveLeft ? activeVerses[0] : activeVerses.at(-1))
        let changeChapter = moveLeft ? currentIndex <= 1 : currentIndex >= Object.keys(verses[firstBibleId]).length
        if (changeChapter) {
            // find current chapter
            let notApi = typeof chapterId === "number"
            let chapterIndex = notApi ? chapterId : chapters[firstBibleId].findIndex((a) => a.id === chapterId)

            if (moveLeft) chapterIndex--
            else chapterIndex++

            let newChapter: any = chapters[firstBibleId][chapterIndex]
            if (!newChapter) return

            // set new chapter
            let newChapterId = notApi ? chapterIndex : newChapter.id
            chapterId = newChapterId

            // select verses
            if (moveLeft) currentIndex = (newChapter.verses?.length ?? 150) + 1
            else currentIndex = 0

            // WIP: auto scroll to verses
        }

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
            setOutput("slide", null)
            return
        }

        playScripture.set(true)
    }

    $: sortedVerses = bibles?.[0]?.activeVerses?.sort((a, b) => Number(a) - Number(b)) || []
    let verseRange = ""
    $: verseRange = sortedVerses.length ? joinRange(sortedVerses) : ""

    // autoscroll
    let booksScrollElem: any
    let chaptersScrollElem: any
    let versesScrollElem: any
    $: if (active && bookId) setTimeout(() => scrollToActive(booksScrollElem))
    $: if (active && chapterId) setTimeout(() => scrollToActive(chaptersScrollElem))
    $: if (active && activeVerses?.length < 5) setTimeout(() => scrollToActive(versesScrollElem))
    function scrollToActive(scrollElem) {
        if (!scrollElem) return

        let selectedElemTop = scrollElem.querySelector(".active")?.offsetTop || 0

        // don't scroll if elem is in view
        let visibleElemPos = selectedElemTop - scrollElem.scrollTop
        if (visibleElemPos > 0 && visibleElemPos < scrollElem.offsetHeight) return

        // wait to allow user to click
        setTimeout(() => {
            scrollElem.scrollTo(0, Math.max(0, selectedElemTop - 70))
        }, 150)
    }

    let usedNames: string[] = []
    function getShortName(name: string, i: number) {
        let shortName = isNaN(parseInt(name[0])) ? name.slice(0, 3) : name.replace(" ", "").slice(0, 4)

        // use four characters if same short name ("Jud"ges="Jud"e)
        if (i === 0) usedNames = []
        if (usedNames.includes(shortName) && shortName.length === 3) shortName = name.slice(0, 4)
        usedNames.push(shortName)

        return shortName
    }

    let gridMode: boolean = false
    let history: boolean = false

    $: currentHistory = clone($scriptureHistory.filter((a) => a.id === bibles[0].id)).reverse()
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} />

<div class="scroll" style="flex: 1;overflow-y: auto;">
    <div class="main">
        {#if notLoaded || !bibles[0]}
            <Center faded>
                <T id="error.bible" />
            </Center>
            <!-- {:else if bibles[0].api && !$bibleApiKey}
            <BibleApiKey /> -->
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
                                setTimeout(
                                    () => {
                                        playOrClearScripture(true)
                                        resetContentSearch()
                                    },
                                    match.api ? 500 : 10
                                )
                            }}
                            title={formatBibleText(match.text)}
                        >
                            <span style="width: 250px;text-align: left;color: var(--text);" class="v">{match.reference}</span>{@html formatBibleText(match.text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                        </p>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.search" />
                </Center>
            {/if}
        {:else if history}
            {#if currentHistory.length}
                <div class="verses">
                    {#each currentHistory as verse}
                        <p
                            on:dblclick={() => {
                                bookId = verse.book
                                chapterId = verse.chapter
                                selectVerse({}, verse.verse)
                                setTimeout(() => playOrClearScripture(true), verse.api ? 500 : 10)
                            }}
                            title={formatBibleText(verse.text)}
                        >
                            <span style="width: 250px;text-align: left;color: var(--text);" class="v">{verse.reference}</span>{@html formatBibleText(verse.text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                        </p>
                    {/each}
                </div>
            {:else}
                <Center faded>
                    <T id="empty.general" />
                </Center>
            {/if}
        {:else if gridMode}
            <!-- GRID MODE -->
            <div class="grid">
                <div class="books">
                    {#if books[firstBibleId]?.length}
                        {#key books[firstBibleId]}
                            {#each books[firstBibleId] as book, i}
                                {@const id = bibles[0].api ? book.id : i}
                                {@const color = getColorCode(books[firstBibleId], book.id ?? i)}
                                {@const name = getShortName(book.name, i)}

                                <span
                                    id={id.toString()}
                                    on:click={() => {
                                        bookId = id
                                        autoComplete = false
                                    }}
                                    class:active={bibles[0].api ? bookId === book.id : bookId === i}
                                    style="color: {color};"
                                    title={book.name}
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
                    <div class="chapters context #scripture_chapter" bind:this={chaptersScrollElem} style="text-align: center;" class:center={!chapters[firstBibleId]?.length}>
                        {#if chapters[firstBibleId]?.length}
                            {#each chapters[firstBibleId] as chapter, i}
                                {@const id = bibles[0].api ? chapter.id : i}
                                <span
                                    id={id.toString()}
                                    on:mousedown={() => {
                                        chapterId = id
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
                    <div class="verses context #scripture_verse" bind:this={versesScrollElem} class:center={!Object.keys(verses[firstBibleId] || {}).length}>
                        {#if Object.keys(verses[firstBibleId] || {}).length}
                            {#each Object.keys(verses[firstBibleId] || {}) as id}
                                <!-- custom drag -->
                                <span
                                    class:showAllText={$resized.rightPanelDrawer <= 5}
                                    {id}
                                    draggable="true"
                                    on:mouseup={(e) => selectVerse(e, id)}
                                    on:mousedown={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.shiftKey) return
                                        if (!activeVerses.includes(id)) activeVerses = [id]
                                        updateActiveVerses()
                                    }}
                                    on:dblclick={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? false : playOrClearScripture(true))}
                                    on:click={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? playOrClearScripture(true) : false)}
                                    class:active={activeVerses.includes(id)}
                                    title={$dictionary.tooltip?.scripture}
                                >
                                    {id}
                                </span>
                            {/each}
                        {:else}
                            <Loader />
                        {/if}
                    </div>
                </div>
                <!-- {#if bibles[0].copyright}
                    <copy>{bibles[0].copyright}</copy>
                {/if} -->
            </div>
        {:else}
            <!-- LIST MODE -->
            <div class="books" bind:this={booksScrollElem} class:center={!books[firstBibleId]?.length}>
                {#if books[firstBibleId]?.length}
                    {#key books[firstBibleId]}
                        {#each books[firstBibleId] as book, i}
                            {@const id = bibles[0].api ? book.id : i}
                            {@const color = getColorCode(books[firstBibleId], book.id ?? i)}

                            <span
                                id={id.toString()}
                                on:click={() => {
                                    bookId = id
                                    autoComplete = false
                                }}
                                class:active={bibles[0].api ? bookId === book.id : bookId === i}
                                style={color ? `border-left: 2px solid ${color};` : ""}
                            >
                                {book.name}
                            </span>
                        {/each}
                    {/key}
                {:else}
                    <Loader />
                {/if}
            </div>
            <div class="chapters context #scripture_chapter" bind:this={chaptersScrollElem} style="text-align: center;" class:center={!chapters[firstBibleId]?.length}>
                {#if chapters[firstBibleId]?.length}
                    {#each chapters[firstBibleId] as chapter, i}
                        {@const id = bibles[0].api ? chapter.id : i}
                        <span
                            id={id.toString()}
                            on:mousedown={() => {
                                chapterId = id
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
            <div class="verses context #scripture_verse" bind:this={versesScrollElem} class:center={!Object.keys(verses[firstBibleId] || {}).length}>
                {#if Object.keys(verses[firstBibleId] || {}).length}
                    {#each Object.entries(verses[firstBibleId] || {}) as [id, content]}
                        <!-- custom drag -->
                        <p
                            class:showAllText={$resized.rightPanelDrawer <= 5}
                            {id}
                            draggable="true"
                            on:mouseup={(e) => selectVerse(e, id)}
                            on:mousedown={(e) => {
                                if (e.ctrlKey || e.metaKey || e.shiftKey) return
                                if (!activeVerses.includes(id)) activeVerses = [id]
                                updateActiveVerses()
                            }}
                            on:dblclick={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? false : playOrClearScripture(true))}
                            on:click={(e) => (outputIsScripture && !e.ctrlKey && !e.metaKey ? playOrClearScripture(true) : false)}
                            class:active={activeVerses.includes(id)}
                            title={$dictionary.tooltip?.scripture}
                        >
                            <span class="v">{id}</span>{@html formatBibleText(content.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>'))}
                        </p>
                    {/each}
                    {#if bibles[0].copyright || bibles[0].metadata?.copyright}
                        <copy>{bibles[0].copyright || bibles[0].metadata?.copyright}</copy>
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
        <TextInput placeholder={$dictionary.scripture?.search} value={contentSearch} on:input={searchValueChanged} on:change={searchInBible} style="width: 300px;" autofocus />
    {:else}
        <Button disabled={activeVerses.includes("1") && (chapterId <= 0 || chapterId.toString() === `${bookId}.1`)} title={$dictionary.preview?._previous_slide} on:click={() => moveSelection(true)}>
            <Icon size={1.3} id="previous" />
        </Button>
        <Button disabled={$outLocked} title={outputIsScripture ? $dictionary.preview?._update : $dictionary.menu?._title_display} on:click={() => playOrClearScripture(true)}>
            <Icon size={outputIsScripture ? 1.1 : 1.3} id={outputIsScripture ? "refresh" : "play"} white={!outputIsScripture} />
        </Button>
        <Button
            disabled={Object.keys(verses[firstBibleId] || {}).length &&
                activeVerses.includes(Object.keys(verses[firstBibleId] || {}).length.toString()) &&
                (chapterId >= chapters[firstBibleId].length - 1 || chapterId.toString() === `${bookId}.${chapters[firstBibleId].length + 1}`)}
            title={$dictionary.preview?._next_slide}
            on:click={() => moveSelection(false)}
        >
            <Icon size={1.3} id="next" />
        </Button>

        <div class="seperator" />
        <Button on:click={() => (gridMode = !gridMode)} title={$dictionary.show?.[gridMode ? "grid" : "list"]}>
            <Icon size={1.3} id={gridMode ? "grid" : "list"} white />
        </Button>

        <div class="seperator" />
        <Button disabled={!currentHistory.length} active={history} on:click={() => (history = !history)} title={$dictionary.popup?.history}>
            <Icon size={1.2} id="history" white={!currentHistory.length} />
        </Button>

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
        width: 1px;
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

        position: relative;
        scroll-behavior: smooth;
    }
    .main div:not(.verses):not(.grid):not(.grid div) {
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
    .main p.showAllText {
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

    /* GRID MODE */

    .grid {
        display: flex;
        flex-direction: column;
    }
    .grid .books {
        border-bottom: 2px solid var(--primary-lighter);
    }
    .grid .chapters {
        border-right: 2px solid var(--primary-lighter);
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

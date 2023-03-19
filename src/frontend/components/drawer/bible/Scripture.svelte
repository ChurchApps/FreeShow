<script lang="ts">
    import { onMount } from "svelte"
    import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
    import Loader from "../../main/Loader.svelte"
    // import type { Bible } from "../../../../types/Bible"
    import { BIBLE } from "../../../../types/Channels"
    import type { OutSlide } from "../../../../types/Show"
    import { activeShow, dictionary, notFound, outLocked, outputs, scriptures, scripturesCache, scriptureSettings, templates } from "../../../stores"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import { fetchBible, loadBible } from "./scripture"

    export let active: any
    export let bibles: Bible[]
    export let searchValue: string
    let books: { [key: string]: Book[] } = {}
    let chapters: { [key: string]: Chapter[] } = {}
    let versesList: { [key: string]: Verse[] } = {}
    let bookId: any = "GEN"
    let chapterId: any = "GEN.1"
    let verses: { [key: string]: any[] } = {}

    let activeVerses: string[] = []

    let error: null | string = null

    let firstBibleId = ""
    // $: bibleId = $scriptures[active].collection?.versions[0] || active

    onMount(async () => {
        await createBiblesList()
        getBible()
    })

    async function createBiblesList() {
        return new Promise((resolve) => {
            let selectedScriptureData = $scriptures[active] || Object.values($scriptures).find((a) => a.id === active)
            if (!selectedScriptureData) return

            let versions: string[] = [active]
            if (selectedScriptureData.collection) versions = selectedScriptureData.collection.versions
            firstBibleId = versions[0] || active

            bibles = versions.map((id) => {
                return { id, version: null, book: null, chapter: null, verses: [], activeVerses: [] }
            })
            resolve("done")
        })
    }

    function getBibleId(index: number, bible: any = null) {
        let selectedScriptureData = $scriptures[active] || Object.values($scriptures).find((a) => a.id === active)
        return bible?.id || selectedScriptureData?.collection?.versions?.[index] || active
    }

    async function loadAPIBible(bibleId: string, load: string, index: number = 0) {
        let data: any = null

        try {
            data = await fetchBible(load, bibleId, { versesList: versesList[bibleId] || [], bookId, chapterId })
        } catch (err) {
            error = err
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

                if (data[0].number === "intro") chapters[bibleId] = data.slice(1, data.length - 1)
                else chapters[bibleId] = data
                break
            case "verses":
                versesList[bibleId] = data
                break
            case "versesText":
                verses[bibleId] = divide(data, index)
                bibles[index].verses = verses[bibleId]
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

        bibles[index].copyright = data.copyright

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
        } else {
            scripturesCache.update((a) => {
                a[msg.content[0]] = msg.content[1]
                return a
            })

            let id = msg.content[0] || msg.id

            bibles[msg.data.index || 0].version = msg.content[1].name
            bibles[msg.data.index || 0].copyright = msg.content[1].copyright
            bibles[msg.data.index || 0].id = msg.content[0]
            books[id] = msg.content[1].books as any

            if (typeof bookId === "string") bookId = 0
        }
    })

    $: if (active) getBible()
    $: if (books[firstBibleId]?.length && bookId !== undefined) getBook()
    $: if (chapters[firstBibleId]?.length && chapterId !== undefined) getChapter()

    $: if (versesList[firstBibleId]?.length) getVerses()
    $: if (!bibles[0]?.api && bibles[0]?.activeVerses) getVerses()

    async function getBible() {
        notLoaded = false
        error = null

        await createBiblesList()

        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            bibles[i] = loadBible(id, i, bible)

            verses[id] = []
            if (!bibles[i].version) return
            if (bibles[i].api) loadAPIBible(id, "books")
            else if ($scripturesCache[id]) {
                books[id] = $scripturesCache[id].books as any
                bookId = 0
            }
        })
    }

    function getBook() {
        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!books[id]) return

            if (bible.api) {
                books[id].forEach((b) => {
                    if (b.id === bookId) bibles[i].book = b.name
                })
                loadAPIBible(id, "chapters")
            } else if (books[id][bookId]) {
                bibles[i].book = books[id][bookId].name
                chapters[id] = (books[id][bookId] as any).chapters
                chapterId = 0
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
                bibles[i].chapter = (chapters[id][chapterId] as any).number
                ;(chapters[id][chapterId] as any).verses.forEach((a: any) => {
                    content[a.number] = a.value
                })
                verses[id] = content
            }

            if (activeVerses.length && verses[id]) {
                activeVerses = activeVerses.filter((a) => verses[id][a])
                bibles[i].activeVerses = activeVerses
            }
        })
    }

    function getVerses() {
        bibles.forEach((bible, i) => {
            let id: string = getBibleId(i, bible)
            if (!verses[id]) return

            if (bible.api) {
                verses[id] = []
                loadAPIBible(id, "versesText", i)
            } else {
                bibles[i].verses = verses[id]
            }
        })
    }

    function selectVerse(e: any, id: string) {
        auto = false
        if (e.ctrlKey || e.metaKey) {
            console.log("A", activeVerses, id)
            if (activeVerses.includes(id)) activeVerses = activeVerses.filter((a) => a !== id)
            else activeVerses = [...activeVerses, id]
            console.log(activeVerses)
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
        } else if (activeVerses.length === 1 && activeVerses[0] === id) activeVerses = []
        else activeVerses = [id]

        bibles[0].activeVerses = activeVerses
    }

    $: template = $templates[$scriptureSettings.template]?.items || []
    $: itemStyle = template[0]?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
    function showVerse(id: string) {
        if ($outLocked) return

        // TODO: multiple versions

        let value = verses[firstBibleId]?.[id] || ""
        value = value.replace(/(<([^>]+)>)/gi, "")
        let text: any[] = []

        if ($scriptureSettings.verseNumbers) {
            text.push({ value: id + " ", style: "font-size: 100px;color: " + ($scriptureSettings.numberColor || "#919191") + ";" + template[0]?.lines?.[0].text?.[0].style || "" })
        }

        text.push({ style: template[0]?.lines?.[0].text?.[0].style || "font-size: 80px;", value })

        let tempItems: any[] = []
        tempItems.push({
            style: itemStyle,
            align: "",
            lines: [{ align: template[0]?.lines?.[0].align || "text-align: justify;", text }],
        })

        // add data
        let lines: any[] = []
        let verseStyle = template[1]?.lines?.[0].text?.[0].style || "font-size: 50px;"
        if ($scriptureSettings.showVersion && bibles[0].version) lines.push({ text: [{ value: bibles[0].version, style: verseStyle }], align: "" })
        if ($scriptureSettings.showVerse) lines.push({ text: [{ value: bibles[0].book + " " + bibles[0].chapter + ":" + id, style: verseStyle }], align: "" })
        if (($scriptureSettings.showVersion && bibles[0].version) || $scriptureSettings.showVerse)
            tempItems.push({
                lines,
                style: template[1]?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
            })

        // TODO: outline on outputted verses
        setOutput("slide", { id: "temp", tempItems })
    }

    // search
    // TODO: what if it's spaces: 1 Peter, Songs of Solomon
    let auto: boolean = false
    $: if (searchValue) auto = true
    let previousBook = ""
    $: split = searchValue.split(" ")
    // split chapter / verse range with ":" or "," or "." or " "
    $: split2 = split[1]?.includes(":")
        ? split[1].split(":")
        : split[1]?.includes(",")
        ? split[1]?.split(",")
        : split[1]?.includes(".")
        ? split[1]?.split(".")
        : [split[1] || "", split[2] || ""]

    // book
    $: book = split[0]
    $: if (book.length && books[firstBibleId]?.length && auto) {
        let newBooks = JSON.parse(JSON.stringify(books[firstBibleId] || [])).map((b: any, i: number) => ({ ...b, id: b.id || i }))
        let matches = newBooks.filter((a: any) => a.name.toLowerCase().includes(book.toLowerCase()))
        let exactMatch = matches.find((a: any) => a.name.toLowerCase() === book.toLowerCase())
        if ((matches.length === 1 || exactMatch) && !split[1]?.length && split[0].length >= previousBook.length) {
            updateSearchValue(matches[0].name + " ")
            previousBook = matches[0].name + " "

            if (bookId !== matches[0].id) {
                bookId = matches[0].id
                getBook()
            }
        }
    } else previousBook = ""
    const updateSearchValue = (v: string) => (searchValue = v)

    // chapter
    $: chapter = split2?.[0]?.length ? split2?.[0] : null
    $: if (chapter) updateSearchValue(book + " " + chapter.replace(/[^0-9:.,]/g, ""))
    $: if (chapter && chapter !== chapterId && auto) {
        // GEN.1 || 0
        chapters[firstBibleId]?.forEach((c, i) => {
            if (c.id?.replace(/\D+/g, "") === chapter) chapterId = c.id
            else if (c.number === chapter) chapterId = i
        })
        getChapter()
    }

    // verses
    $: verse = split2?.[1]?.length ? split2?.[1] : null
    $: if (verse) updateSearchValue(book + " " + chapter + ":" + verse.replace(/[^0-9-+]/g, ""))
    $: if (verse && auto) {
        // select range (GEN.1.1 || "1")
        activeVerses = []
        verse.split("+").forEach((a) => {
            let split = a.split("-")
            if (split.length > 1 && split[1].length) {
                let number: any = Number(split[0])
                let end: any = Number(split[1])
                while (number <= end) {
                    activeVerses.push(number.toString())
                    number++
                }
            } else if (split[0].length) activeVerses.push(split[0])
        })
        activeVerses = [...new Set(activeVerses)]
        bibles[0].activeVerses = activeVerses
    }

    function keydown(e: any) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        let currentOutput: any = $outputs[getActiveOutputs()[0]]
        let slide: null | OutSlide = currentOutput.out?.slide || null
        if ($activeShow && slide?.id !== "temp" && !e.ctrlKey && !e.metaKey) return

        // go to next/previous verse
        let left = e.key.includes("Left")
        if (!activeVerses.length) {
            activeVerses = [left ? Object.keys(verses[firstBibleId] || []).length.toString() : "1"]
            bibles[0].activeVerses = activeVerses
            return
        }

        let currentIndex: number = Number(left ? activeVerses[0] : activeVerses.at(-1))
        console.log(verses, currentIndex)
        let newSelection: string[] = []
        ;[...Array(activeVerses.length)].map((_, i: number) => {
            let newIndex: number = left ? currentIndex - i - 1 : currentIndex + i + 1
            if (left ? newIndex > 0 : newIndex <= Object.keys(verses[firstBibleId] || []).length) newSelection.push(newIndex.toString())
        })
        if (newSelection.length) {
            activeVerses = newSelection.sort((a: any, b: any) => a - b)
            bibles[0].activeVerses = activeVerses
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    {#if notLoaded}
        <Center faded>
            <T id="error.bible" />
        </Center>
    {:else if error}
        <Center faded>
            <T id="error.bible_api" />
        </Center>
    {:else}
        <div class:center={!books[firstBibleId]?.length}>
            {#if books[firstBibleId]?.length}
                {#key books[firstBibleId]}
                    {#each books[firstBibleId] as book, i}
                        <span
                            on:click={() => {
                                bibles[0].api ? (bookId = book.id) : (bookId = i)
                                auto = false
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
                            auto = false
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
                    <p on:mousedown={(e) => selectVerse(e, id)} on:dblclick={() => showVerse(id)} class:active={activeVerses.includes(id)} title={$dictionary.tooltip?.scripture}>
                        <span class="v">{id}</span>{@html content}
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

<!-- TODO: select multiple verses -->
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

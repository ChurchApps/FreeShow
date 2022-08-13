<script lang="ts">
  import { onMount } from "svelte"
  import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
  import Loader from "../../main/Loader.svelte"
  // import type { Bible } from "../../../../types/Bible"
  import { BIBLE } from "../../../../types/Channels"
  import type { StringObject } from "../../../../types/Main"
  import { dictionary, notFound, outLocked, scriptures, scripturesCache, scriptureSettings, templates } from "../../../stores"
  import { setOutput } from "../../helpers/output"
  import T from "../../helpers/T.svelte"
  import Center from "../../system/Center.svelte"

  export let active: any
  export let bible: Bible
  export let searchValue: string
  let books: Book[] = []
  let chapters: Chapter[] = []
  let versesList: Verse[] = []
  let bookId: any = "GEN"
  let chapterId: any = "GEN.1"
  let verses: any = null

  let activeVerses: string[] = []

  let error: null | string = null

  // API.Bible key. Will propably change in the future (Please don't abuse)
  let key: string = "320b5b593fa790ced135a98861de51a9"

  async function fetchBible(id: string) {
    const api = "https://api.scripture.api.bible/v1/bibles/"
    let versesId = null
    if (versesList.length) {
      versesId = versesList[0].id + "-" + versesList[versesList.length - 1].id
      versesId = versesId.split("-")
      versesId = versesId[0] + "-" + versesId[versesId.length - 1]
    }
    const urls: StringObject = {
      books: `${api}${active}/books`,
      chapters: `${api}${active}/books/${bookId}/chapters`,
      verses: `${api}${active}/chapters/${chapterId}/verses`,
      versesText: `${api}${active}/verses/${versesId}`,
    }
    fetch(urls[id], { headers: { "api-key": key } })
      .then((response) => response.json())
      .then((data) => {
        let hasId = false
        switch (id) {
          case "books":
            if (bible.api) {
              data.data.forEach((d: Book) => {
                if (d.id === bookId) hasId = true
              })
              if (!hasId) bookId = data.data[0].id

              // console.trace(data.data)
              books = data.data
            }
            break
          case "chapters":
            data.data.forEach((d: Chapter) => {
              if (d.id === chapterId) hasId = true
            })
            if (!hasId) chapterId = bookId + ".1"

            if (data.data[0].number === "intro") chapters = data.data.slice(1, data.data.length - 1)
            else chapters = data.data
            break
          case "verses":
            console.log(data.data)
            versesList = data.data
            break
          case "versesText":
            verses = divide(data.data)
            break
        }
      })
      .catch((e) => {
        error = e
      })
  }

  function divide(data: VerseText): VerseText {
    let verses: any = {}
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
          verses[verse] = ""
        } else if (content.includes("class")) {
          verses[verse] += "<span" + content + "span>"
        } else {
          let noHTML = ""
          content.split(/<|>/).forEach((a) => {
            if (a.length) noHTML += a
          })
          if (verses[verse] !== undefined) verses[verse] += noHTML
        }

        if (verses[verse]) verses[verse] = verses[verse].replaceAll("¶ ", "")
      })

    // let newContent: string[][] = []
    // verses.forEach((v: any) => {
    //   if (v.content.length) {
    //     newContent.push([v.number, v.content.replaceAll("¶ ", "")])
    //   }
    // })

    bible.copyright = data.copyright
    bible.verses = verses
    return verses
  }

  onMount(async () => {
    if (bible.api) fetchBible("books")
  })

  let notLoaded: boolean = false
  window.api.receive(BIBLE, (data: any) => {
    if (data.error === "not_found") {
      notLoaded = true
      notFound.update((a) => {
        a.bible.push({ id: data.id })
        return a
      })
    } else {
      scripturesCache.update((a) => {
        a[data.bible[0]] = data.bible[1]
        return a
      })

      bible.version = data.bible[1].name
      bible.copyright = data.bible[1].copyright
      bible.id = data.bible[0]
      console.log(bible)
      books = data.bible[1].books as any
      console.log(books)
      if (typeof bookId === "string") bookId = 0
    }
  })

  $: if (active) getBible()
  $: if (books.length && bookId !== undefined) getBook()
  $: if (chapters.length && chapterId !== undefined) getChapter()
  $: console.log(versesList)
  $: if (versesList?.length) getVerses()
  $: if (!bible.api && bible.activeVerses) getVerses()

  function getBible() {
    notLoaded = false
    error = null

    Object.entries($scriptures).forEach(([id, scripture]: any) => {
      if (scripture.id === active || id === active) {
        if (scripture.api) {
          bible.api = true
          bible.version = scripture.name
        } else {
          if ($scripturesCache[id]) {
            bible.version = scripture.name
            bible.copyright = $scripturesCache[id].copyright
            bible.id = id
          } else window.api.send(BIBLE, { name: scripture.name, id: scripture.id })
          delete bible.api
        }
      }
    })
    verses = null
    if (bible.version) {
      if (bible.api) fetchBible("books")
      else if ($scripturesCache[bible.id!]) {
        books = $scripturesCache[bible.id!].books as any
        bookId = 0
      }
    }
  }

  function getBook() {
    if (bible.api) {
      books.forEach((b) => {
        if (b.id === bookId) bible.book = b.name
      })
      fetchBible("chapters")
    } else if (books[bookId]) {
      bible.book = books[bookId].name
      console.log(chapters, books, bookId)
      chapters = (books[bookId] as any).chapters
      console.log(chapters)
      chapterId = 0
    }
  }

  function getChapter() {
    let content: any = {}

    if (bible.api) {
      chapters.forEach((c) => {
        if (c.id === chapterId) bible.chapter = c.number
      })
      fetchBible("verses")
    } else if (chapters[chapterId]) {
      console.log(bible, books, chapters)
      bible.chapter = (chapters[chapterId] as any).number
      ;(chapters[chapterId] as any).verses.forEach((a: any) => {
        content[a.number] = a.value
      })
      verses = content
    }

    if (activeVerses.length && verses) {
      activeVerses = activeVerses.filter((a) => verses[a])
      bible.activeVerses = activeVerses
    }
  }

  function getVerses() {
    // console.log(versesList)
    if (bible.api) {
      verses = null
      fetchBible("versesText")
    } else {
      bible.verses = verses
    }
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
      let arr: any = verses
      let sorted = activeVerses.sort((a, b) => Number(a) - Number(b))[0]
      let first = id
      let last = sorted
      if (id > sorted) {
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

    bible.activeVerses = activeVerses
  }

  $: template = $templates[$scriptureSettings.template]?.items || []
  $: itemStyle = template[0]?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
  function showVerse(id: string) {
    if ($outLocked) return

    let value = verses[id] || ""
    value = value.replace(/(<([^>]+)>)/gi, "")
    let text = []

    if ($scriptureSettings.verseNumbers) {
      text.push({ value: id + " ", style: "font-size: 100px;color: gray;" + template[0]?.lines?.[0].text?.[0].style || "" })
    }

    text.push({ style: template[0]?.lines?.[0].text?.[0].style || "font-size: 80px;", value })

    let tempItems = []
    tempItems.push({
      style: itemStyle,
      align: "",
      lines: [{ align: template[0]?.lines?.[0].align || "text-align: justify;", text }],
    })

    // add data
    let lines = []
    let verseStyle = template[1]?.lines?.[0].text?.[0].style || "font-size: 50px;"
    if ($scriptureSettings.showVersion && bible.version) lines.push({ text: [{ value: bible.version, style: verseStyle }], align: "" })
    if ($scriptureSettings.showVerse) lines.push({ text: [{ value: bible.book + " " + bible.chapter + ":" + id, style: verseStyle }], align: "" })
    if (($scriptureSettings.showVersion && bible.version) || $scriptureSettings.showVerse)
      tempItems.push({
        lines,
        style: template[1]?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
      })

    setOutput("slide", { id: "temp", tempItems })
  }

  // search
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
  $: if (book.length && books.length && auto) {
    let newBooks = JSON.parse(JSON.stringify(books)).map((b: any, i: number) => ({ ...b, id: b.id || i }))
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
    chapters.forEach((c, i) => {
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
    bible.activeVerses = activeVerses
  }
</script>

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
    <div class:center={!books.length}>
      {#if books.length}
        {#key books}
          {#each books as book, i}
            <span
              on:click={() => {
                bible.api ? (bookId = book.id) : (bookId = i)
                auto = false
              }}
              class:active={bible.api ? bookId === book.id : bookId === i}
            >
              {book.name}
            </span>
          {/each}
        {/key}
      {:else}
        <Loader />
      {/if}
    </div>
    <div style="text-align: center;" class:center={!chapters.length}>
      {#if chapters.length}
        {#each chapters as chapter, i}
          <span
            on:click={() => {
              bible.api ? (chapterId = chapter.id) : (chapterId = i)
              auto = false
            }}
            class:active={bible.api ? chapterId === chapter.id : chapterId === i}
          >
            {chapter.number}
          </span>
        {/each}
      {:else}
        <Loader />
      {/if}
    </div>
    <div class="verses" class:center={!verses}>
      {#if verses}
        {#each Object.entries(verses) as [id, content]}
          <p on:mousedown={(e) => selectVerse(e, id)} on:dblclick={() => showVerse(id)} class:active={activeVerses.includes(id)} title={$dictionary.tooltip?.scripture}>
            <span class="v">{id}</span>{@html content}
          </p>
        {/each}
        {#if bible.copyright}
          <copy>{bible.copyright}</copy>
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

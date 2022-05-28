<script lang="ts">
  import { onMount } from "svelte"
  import Loader from "../../main/Loader.svelte"
  import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
  // import type { Bible } from "../../../../types/Bible"
  import type { StringObject } from "../../../../types/Main"
  import Center from "../../system/Center.svelte"
  import T from "../../helpers/T.svelte"
  import { dictionary, notFound, outLocked, outSlide, scriptures, scripturesCache, scriptureSettings, templates } from "../../../stores"
  import { BIBLE } from "../../../../types/Channels"

  export let active: any
  export let bible: Bible
  let books: Book[] = []
  let chapters: Chapter[] = []
  let versesList: Verse[] = []
  let bookId: any = "GEN"
  let chapterId: any = "GEN.1"
  let verses: null | VerseText = null

  let activeVerses: number[] = []

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
            data.data.forEach((d: Book) => {
              if (d.id === bookId) hasId = true
            })
            if (!hasId) bookId = data.data[0].id

            books = data.data
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
    let verseArray: any[] = []
    let index: number = -1
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
          index++
          verseArray[index] = { number: verse, content: "" }
        } else if (content.includes("class")) {
          verseArray[index].content += "<span" + content + "span>"
        } else {
          let noHTML = ""
          content.split(/<|>/).forEach((a) => {
            if (a.length) noHTML += a
          })
          if (verseArray[index] !== undefined) verseArray[index].content += noHTML
        }
      })
    let newContent: string[][] = []
    verseArray.forEach((v) => {
      if (v.content.length) {
        newContent.push([v.number, v.content.replaceAll("¶ ", "")])
      }
    })
    if (activeVerses.length) {
      let av: number[] = []
      newContent.forEach((_v, i: number) => {
        if (activeVerses.includes(i)) av.push(i)
      })
      activeVerses = av
      bible.activeVerses = av
    }
    bible.verses = newContent
    data.content = newContent
    return data
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
      bible.id = data.bible[0]
      books = data.bible[1].books as any
      if (typeof bookId === "string") bookId = 0
    }
  })

  $: if (active) getBible()
  $: if (books.length && bookId !== undefined) getBook()
  $: if (chapters.length && chapterId !== undefined) getChapter()
  $: if (versesList.length) getVerses()
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
            bible.id = id
          } else window.api.send(BIBLE, { name: scripture.name, id: scripture.id })
          delete bible.api
        }
      }
    })
    verses = null
    if (bible.version) {
      if (bible.api) fetchBible("books")
      else {
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
    } else {
      bible.book = books[bookId].name
      chapters = (books[bookId] as any).chapters
      chapterId = 0
    }
  }

  function getChapter() {
    if (bible.api) {
      chapters.forEach((c) => {
        if (c.id === chapterId) bible.chapter = c.number
      })
      fetchBible("verses")
    } else {
      bible.chapter = chapters[chapterId].number
      verses = { content: (chapters[chapterId] as any).verses.map((a: any) => [a.number, a.value]) } as any
    }
  }

  function getVerses() {
    // console.log(versesList)
    if (bible.api) {
      verses = null
      fetchBible("versesText")
    } else {
      bible.verses = verses?.content as any
    }
  }

  function selectVerse(e: any, i: number) {
    if (e.ctrlKey || e.metaKey) {
      if (activeVerses.includes(i)) {
        let newVerses: number[] = []
        activeVerses.forEach((av) => {
          if (av !== i) newVerses.push(av)
        })
        activeVerses = newVerses
      } else activeVerses = [...activeVerses, i]
    } else if (e.shiftKey && activeVerses.length) {
      let found = false
      let arr: any = verses!.content
      let sorted = activeVerses.sort((a, b) => a - b)[0]
      let first = i
      let last = sorted
      if (i > sorted) {
        first = last
        last = i
      }

      arr.forEach((_v: string[], i: number) => {
        if (i === first) found = true
        if (found && !activeVerses.includes(i)) activeVerses.push(i)
        if (i === last) found = false
      })
      activeVerses = activeVerses
    } else if (activeVerses.length === 1 && activeVerses[0] === i) activeVerses = []
    else activeVerses = [i]

    bible.activeVerses = activeVerses
  }

  $: template = $templates[$scriptureSettings.template]?.items || []
  $: itemStyle = template[0]?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
  function showVerse(index: number) {
    if ($outLocked) return

    let verse = verses?.content[index][1] || ""
    verse = verse.replace(/(<([^>]+)>)/gi, "")
    let text = []

    if ($scriptureSettings.verseNumbers) {
      text.push({ value: bible.verses[index][0] + " ", style: "font-size: 100px;color: gray;" + template[0]?.lines?.[0].text?.[0].style || "" })
    }

    text.push({ style: template[0]?.lines?.[0].text?.[0].style || "font-size: 80px;", value: verse })

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
    if ($scriptureSettings.showVerse) lines.push({ text: [{ value: bible.book + " " + bible.chapter + ":" + (index + 1), style: verseStyle }], align: "" })
    if (($scriptureSettings.showVersion && bible.version) || showVerse)
      tempItems.push({
        lines,
        style: template[1]?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
      })

    outSlide.set({ id: "temp", tempItems })
  }
</script>

<!-- TODO: search (https://scripture.api.bible/docs#searching) -->

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
            <span on:click={() => (bible.api ? (bookId = book.id) : (bookId = i))} class:active={bible.api ? bookId === book.id : bookId === i}>
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
          <span on:click={() => (bible.api ? (chapterId = chapter.id) : (chapterId = i))} class:active={bible.api ? chapterId === chapter.id : chapterId === i}>
            {chapter.number}
          </span>
        {/each}
      {:else}
        <Loader />
      {/if}
    </div>
    <div class="verses" class:center={!verses}>
      {#if verses}
        {#each verses.content as content, i}
          <p on:mousedown={(e) => selectVerse(e, i)} on:dblclick={() => showVerse(i)} class:active={activeVerses.includes(i)} title={$dictionary.tooltip.scripture}>
            <span class="v">{content[0]}</span>{@html content[1]}
          </p>
        {/each}
        {#if verses.copyright}
          <copy>
            {verses.copyright}
          </copy>
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
    border-right: 4px solid var(--primary-lighter);
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

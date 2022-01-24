<script lang="ts">
  import { onMount } from "svelte"
  import Loader from "../../main/Loader.svelte"
  import type { Bible, Book, Chapter, Verse, VerseText } from "../../../../types/Scripture"
  import type { StringObject } from "../../../../types/Main"
  import { versions } from "./versions"

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
        console.log({ ...data.data })
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
        console.log(e)
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
    fetchBible("books")
  })
  $: {
    if (active) {
      versions.forEach((v) => {
        if (v.id === active) bible.version = v.name
      })
      verses = null
      fetchBible("books")
    }
  }

  $: {
    if (books.length && bookId) {
      books.forEach((b) => {
        if (b.id === bookId) bible.book = b.name
      })
      fetchBible("chapters")
    }
  }
  $: {
    if (chapters.length && chapterId) {
      chapters.forEach((c) => {
        if (c.id === chapterId) bible.chapter = c.number
      })
      fetchBible("verses")
    }
  }
  $: {
    if (versesList.length) {
      verses = null
      fetchBible("versesText")
    }
  }

  function selectVerse(e: any, i: number) {
    if (e.ctrlKey) {
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
</script>

<!-- TODO: search (https://scripture.api.bible/docs#searching) -->

<div class="main">
  {#if error}
    {error}
  {:else}
    <div class:center={!books.length}>
      {#if books.length}
        {#key books}
          {#each books as book}
            <span on:click={() => (bookId = book.id)} class:active={bookId === book.id}>
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
        {#each chapters as chapter}
          <span on:click={() => (chapterId = chapter.id)} class:active={chapterId === chapter.id}>
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
          <p on:mousedown={(e) => selectVerse(e, i)} class:active={activeVerses.includes(i)}>
            <span class="v">{content[0]}</span>{@html content[1]}
          </p>
        {/each}
        <copy>
          {verses.copyright}
        </copy>
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
  .main span.active, .main :global(p).active {
    background-color: var(--focus);
    outline: none;
  }
  .main span:hover:not(.active), .main :global(p):hover:not(.active) {
    background-color: var(--hover);
  }
  .main span:focus,
  .main span:active:not(.active),.main :global(p):focus,
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

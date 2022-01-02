<script lang="ts">
  import { io } from "socket.io-client"
  import Button from "./components/Button.svelte"
  import type { TabsObj } from "../../types/Tabs"
  import Tabs from "./components/Tabs.svelte"
  import Projects from "./components/Projects.svelte"
  import Slide from "./components/slide/Slide.svelte"
  import { GetLayout, getSlide } from "./helpers/get"
  import Icon from "./components/Icon.svelte"
  import Center from "./components/Center.svelte"
  import ShowButton from "./components/ShowButton.svelte"
  import { dateToString } from "./helpers/time"
  import Slides from "./components/slide/Slides.svelte"
  import Clear from "./components/slide/Clear.svelte"

  const lang: any = {
    error: {
      wrongPass: "Wrong password!",
    },
  }

  let socket = io()
  let id: null | string = null

  socket.on("connect", () => {
    id = socket.id
    console.log(id)
    socket.emit("REMOTE", { id, channel: "PASSWORD" })
  })

  const send = (channel: string, data: any) => socket.emit("REMOTE", { id, channel, data })
  let connected: boolean = false

  let shows: any[] = []
  // let show: null | string = null
  let activeShowID: null | string = null
  let activeShow: any = null
  let outShow: any = null
  let outSlide: any = null
  let project: null | string = null
  let projects: any[] = []
  let folders: any = {}
  let openedFolders: any[] = []
  $: console.log(openedFolders)

  // $: {
  //   if (id && show) send("SHOW", show)
  // }

  // $: outShow = outSlide ? shows.find((s) => s.id === outSlide.id) : null
  $: activeProject = projects.find((p) => p.id === project) || null
  $: {
    console.log(activeShowID)
    if (id && activeShowID) send("SHOW", activeShowID)
  }
  $: if (activeShow) activeShowID = activeShow.id

  // password
  // https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
  // if (CryptoJS.AES.decrypt(data, id) === password) { // TODO: encryption
  let isPassword: boolean = false
  let password: string = ""
  const submit = () => {
    if (password.length) send("ACCESS", password)
  }

  // local storage
  let remember: boolean = false
  if (localStorage.password) {
    remember = true
    password = localStorage.password
    submit()
  }

  // error
  let errors: string[] = []
  const setError = (err: string) => {
    if (!errors.includes(err)) {
      errors = [...errors, err]
      setTimeout(() => (errors = errors.slice(1, errors.length)), 2000)
    }
  }

  socket.on("REMOTE", (msg) => {
    console.log(msg)
    switch (msg.channel) {
      case "PASSWORD":
        isPassword = msg.data
        break
      case "ERROR":
        setError(lang.error[msg.data])
        break
      case "SHOWS":
        if (remember && password.length) localStorage.password = password
        connected = true
        shows = msg.data
        break
      case "SHOW":
        if (!activeShow) activeTab = "show"
        // if (activeTab === "shows" || activeTab === "project" || activeTab === "projects") activeTab = "show"
        activeShow = msg.data
        console.log(activeTab)
        break
      case "OUT":
        outSlide = msg.data.slide
        if (outSlide === null) outShow = null
        else if (msg.data.show) {
          outShow = msg.data.show
          if (!activeShow) activeTab = "slide"
          if (!activeShow) activeShow = outShow
        }
        console.log(outShow)

        break
      case "FOLDERS":
        folders = msg.data.folders
        if (!openedFolders.length) openedFolders = msg.data.opened
        break
      case "PROJECTS":
        if (!projects) activeTab = "projects"
        projects = msg.data
        break
      case "PROJECT":
        if (!project) {
          project = msg.data
          if (!activeShow) activeTab = "project"
        }
        break

      default:
        break
    }
  })

  let activeTab: string = "shows"
  let tabs: TabsObj = {
    projects: { name: "Projects", icon: "home" },
    project: { name: "Project", icon: "project" },
    shows: { name: "Shows", icon: "shows" },
    show: { name: "Show", icon: "show" },
    slide: { name: "Slide", icon: "slide" },
    lyrics: { name: "Lyrics", icon: "text" },
  }
  let transition: any = { type: "fade", duration: 500 }

  $: layout = outShow ? GetLayout(outShow) : null
  $: totalSlides = layout ? layout.length : 0

  function next() {
    if (outSlide + 1 < totalSlides) send("OUT", outSlide + 1)
  }
  function previous() {
    if (outSlide > 0) send("OUT", outSlide - 1)
  }

  let category: string = "all"
  let searchValue: string = ""
  // sort shows in alphabeticly order
  let showsSorted: any
  $: {
    showsSorted = shows.filter((s) => s.private !== true).sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    // removeValues(sortObject(keysToID(s), "name"), "private", true)
  }
  let filteredShows: any[]
  $: {
    filteredStored = showsSorted.filter((s: any) => category === "all" || category === s.category || (category === "unlabeled" && s.category === null))
  }
  $: console.log(filteredStored)

  let filteredStored: any
  export let firstMatch: null | string = null
  $: {
    if (searchValue.length > 1) {
      filteredShows = []
      filteredStored.forEach((s: any) => {
        let match = search(s)
        if (match) filteredShows.push({ ...s, match })
      })
      // filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowId[]
      filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? -1 : a.match > b.match ? 1 : 0))
      firstMatch = filteredShows[0]?.id || null
    } else {
      filteredShows = filteredStored
      firstMatch = null
    }
  }

  $: sva = searchValue
    .toLowerCase()
    // .replace(/[^\w\s,]/g, "")
    .replace(/[.\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    .split(",")
  // .replace(/[^\w\s]/g, "")
  const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
  const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
  const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

  // TODO: search
  let totalMatch: number = 0
  $: totalMatch = searchValue ? 0 : 0
  function search(obj: any): number {
    let match: any[] = []

    sva.forEach((sv: any, i: number) => {
      if (sv.length > 1) {
        match[i] = 0
        if (searchEquals(obj.name, sv)) match[i] = 100
        else if (searchIncludes(obj.name, sv)) match[i] += 25
        // if (obj.category !== null && searchIncludes($categories[obj.category].name, sv)) match[i] += 10

        Object.values(obj.slides).forEach((slide: any) => {
          slide.items.forEach((item: any) => {
            let text = ""
            item.text?.forEach((box: any) => {
              text += box.value
            })
            if (text.length) {
              if (searchEquals(text, sv)) match[i] += 20
              else if (searchIncludes(text, sv)) {
                // TODO: more specific match
                // console.log(sv, filter(text))
                // match[i] += (10 * (sv.length / filter(text).length)).toFixed()
                match[i] += 10
              }
            }
          })
        })
      }
    })

    let sum = 0
    let hasZero = match.some((m) => {
      sum += m
      return m === 0
    })

    if (hasZero) sum = 0

    totalMatch += sum
    return Math.min(sum, 100)
  }

  // click on content
  function click(e: any) {
    if (e.clientX < window.innerWidth / 3) previous()
    else next()
  }

  let scrollElem: any
  let lyricsScroll: any
  // auto scroll
  $: {
    if (lyricsScroll && outSlide !== null && activeTab === "lyrics") {
      let index = outSlide === 0 ? outSlide : outSlide - 1
      let offset = lyricsScroll.children[index].offsetTop - lyricsScroll.offsetTop - 5
      lyricsScroll.scrollTo(0, offset)
    }
  }

  // TODO: outLocked
</script>

{#if errors.length}
  <div style="color: red;position: absolute;">
    {#each errors as error}
      {error}
    {/each}
  </div>
{/if}

{#if connected}
  <section class="justify">
    <div class="content">
      {#if activeTab === "projects"}
        {#if false}
          {#if projects.length}
            <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} />
          {:else}
            <Center faded>[[[No projects]]]</Center>
          {/if}
        {:else}
          <Center faded>[[[WIP]]]</Center>
        {/if}
      {:else if activeTab === "project"}
        {#if activeProject}
          {#if activeProject.shows.length}
            <h2>{activeProject.name}</h2>
            <div class="scroll">
              {#each activeProject.shows as show}
                <ShowButton
                  on:click={(e) => {
                    send("SHOW", e.detail)
                    activeTab = "show"
                  }}
                  {activeShow}
                  show={shows.find((s) => s.id === show.id)}
                  icon={shows.find((s) => s.id === show.id).private ? "private" : shows.find((s) => s.id === show.id).type ? shows.find((s) => s.id === show.id).type : "noIcon"}
                />
              {/each}
            </div>
          {:else}
            <Center faded>[[[No shows]]]</Center>
          {/if}
        {:else}
          <Center faded>[[[Select a project]]]</Center>
        {/if}
      {:else if activeTab === "shows"}
        {#if shows.length}
          <input type="text" class="input" placeholder="Search..." bind:value={searchValue} />
          <!-- {#each shows as showObj}
            <Button on:click={() => (show = showObj.id)}>{showObj.name}</Button>
          {/each} -->
          <div class="scroll">
            {#each filteredShows as show}
              {#if searchValue.length <= 1 || show.match}
                <ShowButton
                  on:click={(e) => {
                    send("SHOW", e.detail)
                    activeTab = "show"
                  }}
                  {activeShow}
                  show={shows.find((s) => s.id === show.id)}
                  data={dateToString(show.timestamps.created, true)}
                  match={show.match || null}
                />
              {/if}
            {/each}
          </div>
          {#if searchValue.length > 1 && totalMatch === 0}
            <Center faded>[[[No match]]]</Center>
          {/if}
        {:else}
          <Center faded>[[[No shows! Create one in the program]]]</Center>
        {/if}
      {:else if activeTab === "show"}
        {#if activeShow}
          <h2>{activeShow.name}</h2>
          <div bind:this={scrollElem} class="scroll" style="background-color: var(--primary-darker);scroll-behavior: smooth;">
            <Slides
              {scrollElem}
              {outShow}
              {activeShow}
              on:click={(e) => {
                send("OUT", { id: activeShow.id, index: e.detail })
                outShow = activeShow
              }}
              {outSlide}
            />
          </div>
        {:else}
          <Center faded>[[[No show selected]]]</Center>
        {/if}
      {:else if activeTab === "slide"}
        {#if outShow}
          <h2>{outShow.name}</h2>
          <div on:click={click} class="outSlides">
            <Slide {outShow} {outSlide} {transition} />
            {#if getSlide(outShow, outSlide + 1)}
              <Slide {outShow} outSlide={outSlide + 1} {transition} />
            {:else}
              <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">[[[End]]]</div>
            {/if}
          </div>
          <div class="buttons">
            <Clear {outSlide} on:click={(e) => send(e.detail.id, e.detail.value)} />
          </div>
          <div class="buttons" style="display: flex;width: 100%;">
            <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
            <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon id="previous" /></Button>
            <span style="flex: 3;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
            <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon id="next" /></Button>
            <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
          </div>
        {:else}
          <Center faded>[[[No output]]]</Center>
        {/if}
      {:else if activeTab === "lyrics"}
        {#if outShow}
          <h2>{outShow.name}</h2>
          <div on:click={click} bind:this={lyricsScroll} class="lyrics">
            {#each GetLayout(outShow) as layoutSlide, i}
              <span style="padding: 5px;{outSlide === i ? 'background-color: var(--secondary);color: var(--secondary-text);' : ''}">
                <span class="label" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                  <span style="left: 0;position: absolute;">{i + 1}</span>
                  <span>{outShow.slides[layoutSlide.id].label || ""}</span>
                </span>
                {#each outShow.slides[layoutSlide.id].items as item}
                  {#if item.text}
                    <div class="lyric">
                      {#each item.text as text}
                        <span>{text.value}</span>
                      {/each}
                    </div>
                  {/if}
                {/each}
              </span>
            {/each}
          </div>
          <div class="buttons" style="display: flex;width: 100%;">
            <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
            <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon id="previous" /></Button>
            <span style="flex: 3;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
            <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon id="next" /></Button>
            <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
          </div>
        {:else}
          <Center faded>[[[No output]]]</Center>
        {/if}
      {/if}
    </div>
    <Tabs {tabs} bind:active={activeTab} />
  </section>
{:else if isPassword}
  <div class="center">
    <div class="card">
      <h1>RemoteShow</h1>
      <input class="input" style="text-align: center;" type="password" placeholder="Password" bind:value={password} />
      <Button on:click={submit} style="color: var(--secondary);" bold dark center>Submit</Button>
      <span style="text-align: center;"><input type="checkbox" bind:checked={remember} /><span style="opacity: 0.6;padding-left: 10px;">Remember me</span></span>
    </div>
  </div>
{:else}
  Loading...
{/if}

<style>
  :root {
    --primary: #2d313b;
    --primary-lighter: #41444c;
    --primary-darker: #202129;
    --primary-darkest: #191923;
    --text: #f0f0ff;
    --textInvert: #131313;
    --secondary: #e6349c;
    --secondary-opacity: rgba(230, 52, 156, 0.5);
    --secondary-text: #f0f0ff;

    --hover: rgb(255 255 255 / 0.05);
    --focus: rgb(255 255 255 / 0.1);
    /* --active: rgb(230 52 156 / .8); */

    /* --navigation-width: 18vw; */
    --navigation-width: 300px;
  }

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    user-select: none;

    outline-offset: -4px;
    outline-color: var(--secondary);
  }

  :global(html) {
    height: 100%;
  }

  :global(body) {
    background-color: var(--primary);
    color: var(--text);
    /* transition: background-color 0.5s; */

    font-family: system-ui;
    font-size: 1.3em;

    height: 100%;
    /* width: 100vw;
    height: 100vh; */
  }

  .center {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    width: 100%;
  }

  h1 {
    color: var(--secondary);
    text-align: center;
    padding-bottom: 20px;
  }

  h2 {
    color: var(--secondary);
    text-align: center;
    font-size: 1.3em;
    padding: 0.2em 0.8em;
  }

  .input {
    background-color: rgb(0 0 0 / 0.2);
    color: var(--text);
    /* font-family: inherit; */
    padding: 10px 18px;
    border: none;
  }
  .input:active,
  .input:focus {
    outline: 2px solid var(--secondary);
    /* background-color: var(--secondary-opacity); */
  }
  .input::placeholder {
    color: inherit;
    opacity: 0.4;
  }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .scroll {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .justify {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .outSlides {
    height: 100%;
    flex: 1;
    display: flex;
    padding: 10px 0;
    gap: 10px;
    overflow: hidden;
  }
  .outSlides :global(.main) {
    width: 50%;
  }

  @media screen and (max-width: 550px) {
    .outSlides {
      flex-direction: column;
      padding: 0;
    }
    .outSlides :global(.main) {
      height: 50%;
      width: inherit;
    }
  }

  .lyrics {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 10px;
    /* gap: 10px; */
    scroll-behavior: smooth;
  }
  .lyric {
    font-size: 1.3em;
    text-align: center;
  }
</style>

<script lang="ts">
    import { io } from "socket.io-client"
    import Button from "./components/Button.svelte"
    import type { TabsObj } from "../../types/Tabs"
    import Tabs from "./components/Tabs.svelte"
    import Slide from "./components/slide/Slide.svelte"
    import { GetLayout, getNextSlide, nextSlide } from "./helpers/get"
    import Icon from "./components/Icon.svelte"
    import Center from "./components/Center.svelte"
    import ShowButton from "./components/ShowButton.svelte"
    import { dateToString } from "./helpers/time"
    import Slides from "./components/slide/Slides.svelte"
    import Clear from "./components/slide/Clear.svelte"
    import ProjectButton from "./components/ProjectButton.svelte"

    var dictionary: any = {
        empty: {
            project_select: "Select a project",
            show: "No show selected",
            shows: "No shows",
            slides: "No slides",
            search: "No match",
            backgrounds: "No backgrounds in show",
            groups: "No groups",
            events: "No events",
        },
        remote: {
            projects: "Projects",
            project: "Project",
            shows: "Shows",
            show: "Show",
            slide: "Slide",
            lyrics: "Lyrics",
            end: "End",
            no_output: "No output",
            remember: "Remember me",
            loading: "Loading...",
            submit: "Submit",
            password: "Password",
            wrong_password: "Wrong password",
        },
        clear: {
            all: "Clear all",
        },
    }

    let socket = io()
    let id: null | string = null
    let rememberPassword: boolean = false

    socket.on("connect", () => {
        id = socket.id
        console.log("ID:", id)
        if (localStorage.password) {
            rememberPassword = true
            password = localStorage.password
            submit()
        } else send("PASSWORD")
    })

    const send = (channel: string, data: any = null) => socket.emit("REMOTE", { id, channel, data })
    let connected: boolean = false

    let shows: any[] = []
    // let showsCache: any[] = []
    // let show: null | string = null
    let activeShowID: null | string = null
    let activeShow: any = null
    let outShow: any = null
    let outLayout: any = null
    let outSlide: any = null
    let project: null | string = null
    let projects: any[] = []
    let folders: any = {}
    let openedFolders: any[] = []
    // let media: any = {}
    $: console.log(openedFolders)

    // $: {
    //   if (id && show) send("SHOW", show)
    // }

    // $: outShow = outSlide ? showsCache.find((s) => s.id === outSlide.id) : null
    $: activeProject = projects.find((p) => p.id === project) || null
    $: {
        console.log(activeShowID)
        if (id && activeShowID) send("SHOW", activeShowID)
    }
    $: if (activeShow) activeShowID = activeShow.id

    $: console.trace(outShow)

    // password
    // https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
    // if (CryptoJS.AES.decrypt(data, id) === password) { // TODO: encryption
    let isPassword: boolean = false
    let password: string = ""
    const submit = () => {
        send("ACCESS", password)
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
                if (msg.data.dictionary) dictionary = msg.data.dictionary
                isPassword = msg.data.password
                break
            case "ERROR":
                if (msg.data === "wrongPass") {
                    setError(dictionary.remote.wrong_password)
                    localStorage.removeItem("password")
                    isPassword = true
                } else setError(msg.data)
                break
            case "LANGUAGE":
                Object.keys(dictionary).forEach((a) => {
                    Object.keys(dictionary).forEach((b) => {
                        if (msg.data.strings[a][b]) dictionary[a][b] = msg.data.strings[a][b]
                    })
                })
                break
            case "PROJECTS":
                if (connected) projects = Object.keys(msg.data).map((id) => ({ id, ...msg.data[id] }))
                break
            case "ACCESS":
                console.log("ACCESSED")
                if (rememberPassword && password.length) localStorage.password = password
                connected = true
                break
            case "SHOWS":
                shows = Object.keys(msg.data).map((id) => ({ id, ...msg.data[id] }))
                break
            // case "SHOWS_CACHE":
            //   showsCache = msg.data
            //   break
            case "SHOW":
                if (connected) {
                    if (!activeShow) activeTab = "show"
                    // if (activeTab === "shows" || activeTab === "project" || activeTab === "projects") activeTab = "show"
                    // shows[msg.data.id] = msg.data
                    // activeShow = msg.data.id
                    activeShow = msg.data
                    console.log(activeTab)
                }
                break
            case "OUT":
                if (connected) {
                    // clear
                    if (msg.data.slide === undefined) return
                    outSlide = msg.data.slide
                    if (msg.data.layout) outLayout = msg.data.layout
                    if (outSlide === null) outShow = null
                    else if (msg.data.show) {
                        outShow = msg.data.show
                        if (!activeShow) activeTab = "slide"
                        if (!activeShow) activeShow = outShow
                    } else if (outShow === null && activeShow) {
                        outShow = activeShow
                    }
                }

                break
            case "FOLDERS":
                if (connected) {
                    folders = msg.data.folders
                    if (!openedFolders.length) openedFolders = msg.data.opened
                    console.log(folders)
                }
                break
            case "PROJECTS":
                if (connected) {
                    if (!projects) activeTab = "projects"
                    projects = msg.data
                }
                break
            case "PROJECT":
                if (!project && msg.data && connected) {
                    project = msg.data
                    if (!activeShow) activeTab = "project"
                }
                break
            // case "MEDIA":
            //     media = { ...media, ...msg.data }
            //     break

            default:
                break
        }
    })

    // TODO: change layouts

    let activeTab: string = "shows"
    let tabs: TabsObj = {}
    $: tabs = {
        projects: { name: dictionary.remote.projects, icon: "folder" },
        project: { name: dictionary.remote.project, icon: "project" },
        shows: { name: dictionary.remote.shows, icon: "shows" },
        show: { name: dictionary.remote.show, icon: "show" },
        slide: { name: dictionary.remote.slide, icon: "slide" },
        lyrics: { name: dictionary.remote.lyrics, icon: "lyrics" },
    }
    let transition: any = { type: "fade", duration: 500 }

    $: layout = outShow ? GetLayout(outShow, outLayout) : null
    $: console.log(layout, outShow, outLayout)

    $: totalSlides = layout ? layout.length : 0

    // $: filteredSlides = layout?.map((a, i) => ({...a, index: i})).filter(a => a.disabled !== true)
    function next() {
        let index = nextSlide(layout, outSlide)
        if (index !== null) send("OUT", { id: outShow.id, index, layout: outShow.settings.activeLayout })
    }
    function previous() {
        let index = nextSlide(layout, outSlide, true)
        if (index !== null) send("OUT", { id: outShow.id, index, layout: outShow.settings.activeLayout })
    }

    let searchValue: string = ""
    // sort shows in alphabeticly order
    let showsSorted: any
    $: {
        showsSorted = shows.filter((s) => s.private !== true).sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        // removeValues(sortObject(keysToID(s), "name"), "private", true)
    }
    let filteredShows: any[]
    let filteredStored: any
    $: filteredStored = showsSorted
    // $: filteredStored = showsSorted.filter((s: any) => category === "all" || category === s.category || (category === "unlabeled" && s.category === null))
    // $: console.log(filteredStored)

    export let firstMatch: null | string = null
    $: {
        if (searchValue.length > 1) setTimeout(findMatches, 10)
        else {
            filteredShows = filteredStored
            firstMatch = null
        }
    }

    function findMatches() {
        filteredShows = []
        filteredStored.forEach((s: any) => {
            let match = search(s)
            console.log(s, match)
            if (match) filteredShows.push({ ...s, match })
        })
        // filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowId[]
        filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? -1 : a.match > b.match ? 1 : 0))
        console.log(filteredShows)
        firstMatch = filteredShows[0]?.id || null
    }

    $: sva = searchValue
        .toLowerCase()
        .replace(/[.\/#!?$%\^&\*;:{}=\-_`~(),]/g, "")
        .split(" ")
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
    const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

    let totalMatch: number = 0
    $: totalMatch = searchValue ? 0 : 0
    function search(obj: any): number {
        let match: any[] = []

        console.log(sva)

        sva.forEach((sv: any, i: number) => {
            if (sv.length > 1) {
                match[i] = 0

                if (searchEquals(obj.name.toLowerCase(), sv)) match[i] = 100
                else if (searchIncludes(obj.name.toLowerCase(), sv)) match[i] += 25
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
            let offset = lyricsScroll.children[outSlide]?.offsetTop - lyricsScroll.offsetTop - 5
            lyricsScroll.scrollTo(0, offset)
        }
    }

    // TODO: outLocked
</script>

{#if errors.length}
    <div class="error">
        {#each errors as error}
            <span>{error}</span>
        {/each}
    </div>
{/if}

{#if connected}
    <section class="justify">
        <div class="content">
            {#if activeTab === "projects"}
                <h2>{dictionary.remote.projects}</h2>
                {#if projects.length}
                    <!-- <Projects {folders} {projects} activeProject={project} bind:activeShow {openedFolders} /> -->
                    {#each projects as project}
                        <ProjectButton
                            active={activeProject?.id === project.id}
                            name={project.name}
                            on:click={() => {
                                activeProject = project
                                activeTab = "project"
                            }}
                        />
                    {/each}
                {:else}
                    <Center faded>{dictionary.empty.project_select}</Center>
                {/if}
            {:else if activeTab === "project"}
                {#if activeProject}
                    {#if activeProject.shows.length}
                        <h2>{activeProject.name}</h2>
                        <div class="scroll">
                            {#each activeProject.shows as show}
                                {#if show.type === "section"}
                                    <div class="section">{show.name}</div>
                                {:else if show.type && show.type !== "show"}
                                    <div class="media" style="opacity: 0.5;padding: 5px 22px;text-transform: capitalize;font-size: 0.8em;">{show.type || show.name || show.id}</div>
                                {:else if shows.find((s) => s.id === show.id)}
                                    <ShowButton
                                        on:click={(e) => {
                                            send("SHOW", e.detail)
                                            activeTab = "show"
                                        }}
                                        {activeShow}
                                        show={shows.find((s) => s.id === show.id)}
                                        icon={shows.find((s) => s.id === show.id).private ? "private" : shows.find((s) => s.id === show.id).type ? shows.find((s) => s.id === show.id).type : "noIcon"}
                                    />
                                {/if}
                            {/each}
                        </div>
                    {:else}
                        <Center faded>{dictionary.empty.shows}</Center>
                    {/if}
                {:else}
                    <Center faded>{dictionary.empty.project_select}</Center>
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
                        <Center faded>{dictionary.empty.search}</Center>
                    {/if}
                {:else}
                    <Center faded>{dictionary.empty.shows}</Center>
                {/if}
            {:else if activeTab === "show"}
                {#if activeShow}
                    <h2>{activeShow.name}</h2>
                    <div bind:this={scrollElem} class="scroll" style="background-color: var(--primary-darker);scroll-behavior: smooth;">
                        <Slides
                            {dictionary}
                            {scrollElem}
                            {outShow}
                            {activeShow}
                            on:click={(e) => {
                                // TODO: fix...
                                send("OUT", { id: activeShow.id, index: e.detail, layout: activeShow.settings.activeLayout })
                                outShow = activeShow
                            }}
                            {outSlide}
                        />
                    </div>
                    {#if activeShow.id === outShow?.id}
                        <div class="buttons">
                            <Clear {dictionary} {outSlide} on:click={(e) => send(e.detail.id, e.detail.value)} />
                        </div>
                        <div class="buttons" style="display: flex;width: 100%;">
                            <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                            <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                            <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
                            <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                            <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
                        </div>
                    {/if}
                    <!-- TODO: change layout -->
                {:else}
                    <Center faded>{dictionary.empty.show}</Center>
                {/if}
            {:else if activeTab === "slide"}
                {#if outShow}
                    <h2>{outShow.name}</h2>
                    <div on:click={click} class="outSlides">
                        <Slide {outShow} {outSlide} {outLayout} {transition} />
                        {#if nextSlide(layout, outSlide) && getNextSlide(outShow, outSlide, outLayout)}
                            <Slide {outShow} outSlide={nextSlide(layout, outSlide)} {outLayout} {transition} />
                        {:else}
                            <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">{dictionary.remote.end}</div>
                        {/if}
                    </div>
                    <div class="buttons">
                        <Clear
                            {dictionary}
                            {outSlide}
                            on:click={(e) => {
                                send(e.detail.id, e.detail.value)
                                activeTab = "show"
                            }}
                        />
                    </div>
                    <div class="buttons" style="display: flex;width: 100%;">
                        <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                        <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
                        <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                        <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
                    </div>
                {:else}
                    <Center faded>{dictionary.remote.no_output}</Center>
                {/if}
            {:else if activeTab === "lyrics"}
                {#if outShow}
                    <h2>{outShow.name}</h2>
                    <div on:click={click} bind:this={lyricsScroll} class="lyrics">
                        {#each GetLayout(outShow, outLayout) as layoutSlide, i}
                            {#if !layoutSlide.disabled}
                                <span style="padding: 5px;{outSlide === i ? 'background-color: rgba(0 0 0 / 0.6);color: #FFFFFF;' : ''}">
                                    <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                                        <span style="left: 0;position: absolute;">{i + 1}</span>
                                        <span>{outShow.slides[layoutSlide.id].group === null ? "" : outShow.slides[layoutSlide.id].group || "—"}</span>
                                    </span>
                                    {#each outShow.slides[layoutSlide.id].items as item}
                                        {#if item.lines}
                                            <div class="lyric">
                                                {#each item.lines as line}
                                                    <div class="break">
                                                        {#each line.text || [] as text}
                                                            <span>{@html text.value}</span>
                                                        {/each}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <span style="opacity: 0.5;">—</span>
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        {/each}
                    </div>
                    <div class="buttons">
                        <Clear
                            {dictionary}
                            {outSlide}
                            on:click={(e) => {
                                send(e.detail.id, e.detail.value)
                                activeTab = "show"
                            }}
                        />
                    </div>
                    <div class="buttons" style="display: flex;width: 100%;">
                        <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                        <Button style="flex: 1;" on:click={previous} disabled={outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
                        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{outSlide + 1}/{totalSlides}</span>
                        <Button style="flex: 1;" on:click={next} disabled={outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                        <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
                    </div>
                {:else}
                    <Center faded>{dictionary.remote.no_output}</Center>
                {/if}
            {/if}
        </div>
        <Tabs
            {tabs}
            bind:active={activeTab}
            disabled={{
                projects: projects.length,
                project: activeProject,
                shows: shows.length,
                show: activeShow,
                slide: outShow,
                lyrics: outShow,
            }}
        />
    </section>
{:else if isPassword}
    <div class="center">
        <div class="card">
            <h1>RemoteShow</h1>
            <input
                class="input"
                style="text-align: center;"
                type="password"
                placeholder={dictionary.remote.password}
                on:keydown={(e) => {
                    if (e.key === "Enter") submit()
                }}
                bind:value={password}
            />
            <Button on:click={submit} style="color: var(--secondary);" bold dark center>{dictionary.remote.submit}</Button>
            <span style="text-align: center;"><input type="checkbox" bind:checked={rememberPassword} /><span style="opacity: 0.6;padding-left: 10px;">{dictionary.remote.remember}</span></span>
        </div>
    </div>
{:else}
    <Center>
        {dictionary.remote.loading}
    </Center>
{/if}

<style>
    /* @font-face {
    font-family: "CMGSans";
    src: url("./fonts/CMGSans-Regular.ttf");
  }
  @font-face {
    font-family: "CMGSans";
    src: url("./fonts/CMGSans-Bold.ttf");
    font-weight: bold;
  }
  @font-face {
    font-family: "CMGSans";
    src: url("./fonts/CMGSans-Italic.ttf");
    font-style: italic;
  }
  @font-face {
    font-family: "CMGSans";
    src: url("./fonts/CMGSans-BoldItalic.ttf");
    font-weight: bold;
    font-style: italic;
  } */

    :root {
        --primary: #2d313b;
        --primary-lighter: #41444c;
        --primary-darker: #202129;
        --primary-darkest: #191923;
        --text: #f0f0ff;
        --textInvert: #131313;
        --secondary: #f0008c;
        --secondary-opacity: rgba(240, 0, 140, 0.5);
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

        font-family: sans-serif;
        font-size: 1.5em;

        height: 100%;
        /* width: 100vw;
    height: 100vh; */
    }

    .error {
        color: red;
        position: absolute;
        margin: 10px;
        padding: 10px;
        width: calc(100% - 20px);
        text-align: center;
        background-color: var(--primary-darker);
        display: flex;
        flex-direction: column;
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
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        /* font-family: inherit; */
        padding: 10px 18px;
        border: none;
        font-size: inherit;
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
        gap: 10px;
        overflow: hidden;
    }
    .outSlides :global(.main) {
        width: 50%;
    }

    /* project */
    .section {
        text-align: center;
        font-size: 0.9em;
        background-color: var(--primary-darker);
        padding: 2px;
    }

    @media screen and (max-width: 550px) {
        .outSlides {
            flex-direction: column;
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
        font-size: 1.1em;
        text-align: center;
    }
</style>

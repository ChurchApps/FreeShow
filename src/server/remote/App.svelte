<script lang="ts">
  import { io } from "socket.io-client"
  import Button from "./components/Button.svelte"
  import type { TabsObj } from "../../types/Tabs"
  import Tabs from "./components/Tabs.svelte"
  import Projects from "./components/Projects.svelte"
  import Slide from "./components/slide/Slide.svelte"
  import { GetLayout } from "./components/slide/get"
  import Icon from "./components/Icon.svelte"

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
  let show: null | string = null
  let currentShow: any = null
  let outShow: any = null
  let outSlide: any = null
  let project: null | string = null
  let projects: any[] = []
  let folders: any = {}
  $: {
    if (id && show) send("SHOW", show)
  }

  // $: outShow = outSlide ? shows.find((s) => s.id === outSlide.id) : null

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
        currentShow = msg.data
        break
      case "OUT":
        outSlide = msg.data.slide
        if (outSlide === null) outShow = null
        else if (msg.data.show) outShow = msg.data.show
        console.log(outShow)

        break
      case "PROJECTS":
        projects = msg.data
        break
      case "PROJECT":
        if (!project) project = msg.data
        break
      case "FOLDERS":
        folders = msg.data
        break

      default:
        break
    }
  })

  let activeTab: string = "shows"
  // $: {
  //   if (activeTab === "slide") transition.duration = 500
  //   else transition.duration = 0
  // }
  let tabs: TabsObj = {
    projects: { name: "Projects", icon: "home" },
    project: { name: "Project", icon: "project" },
    shows: { name: "Shows", icon: "shows" },
    show: { name: "Show", icon: "show" },
    slide: { name: "Slide", icon: "slide" },
  }
  let transition: any = { type: "fade", duration: 500 }

  $: layout = outShow ? GetLayout(outShow) : null
  $: totalSlides = layout ? layout.length : 0
  function click(e: any) {
    if (activeTab === "slide" && !e.target.closest(".tabs") && !e.target.closest("button")) next()
  }

  function next() {
    if (outSlide + 1 < totalSlides) send("OUT", outSlide + 1)
  }
  function previous() {
    if (outSlide > 0) send("OUT", outSlide - 1)
  }
</script>

<svelte:window on:click={click} />

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
        <!-- {folders[Object.keys(folders)[0]].name} -->
        <Projects {shows} {folders} {projects} activeProject={project} activeShow={show} />
      {:else if activeTab === "project"}
        {projects[0].name}
        <!--  -->
      {:else if activeTab === "shows"}
        {#if shows.length}
          {#each shows as showObj}
            <Button on:click={() => (show = showObj.id)}>{showObj.name}</Button>
          {/each}
        {:else}
          [[[No shows! Create one in the program!]]]
        {/if}
      {:else if activeTab === "show"}
        {#if currentShow}
          {currentShow.name}
        {/if}
      {:else if activeTab === "slide"}
        {#if outShow}
          <div style="display: flex;justify-content: space-between;padding: 5px 10px;font-size: .5em;">
            <span style="color: var(--secondary)">{outShow.name}</span>
            <span style="opacity: 0.8;">{outSlide + 1}/{totalSlides}</span>
          </div>
          <div style="height: 100%;">
            <Slide {outShow} {outSlide} {transition} />
          </div>
          <div style="display: flex;">
            <Button><Icon id="previousFull" /></Button>
            <Button on:click={previous} disabled={outSlide <= 0}><Icon id="previous" /></Button>
            <Button on:click={next} disabled={outSlide + 1 >= totalSlides}><Icon id="next" /></Button>
            <Button><Icon id="nextFull" /></Button>
          </div>
        {:else}
          [[[No show]]]
        {/if}
      {/if}
    </div>
    <Tabs {tabs} bind:active={activeTab} />
  </section>
{:else if isPassword}
  <div class="center">
    <div class="card">
      <input type="password" bind:value={password} />
      <span>
        <input type="checkbox" bind:checked={remember} />
        Remember me
      </span>
      <button on:click={submit}>Submit</button>
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

  :global(body) {
    background-color: var(--primary);
    color: var(--text);
    /* transition: background-color 0.5s; */

    font-family: system-ui;
    font-size: 3em;

    width: 100vw;
    height: 100vh;
  }

  .center {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-darker);
    /*  */
  }

  .card {
    background-color: var(--primary);
    box-shadow: 2px 2px 4px rgb(0 0 0 / 0.3);
    border: 2px solid var(--primary-lighter);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .content {
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
</style>

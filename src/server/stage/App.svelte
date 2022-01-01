<script lang="ts">
  import { io } from "socket.io-client"
  import Button from "./components/Button.svelte"
  import Slide from "./components/Slide.svelte"

  const lang: any = {
    error: {
      wrongPass: "Wrong password!",
      missingID: "Something went wrong, try again!",
      noShow: "Could not find active show!",
    },
  }

  let socket = io()

  socket.on("connect", () => {
    id = socket.id
    console.log(id)
    socket.emit("STAGE", { id, channel: "SHOWS" })
  })

  let id: null | string = null
  let shows: any = null
  let showRef: any = null
  let show: any = null
  let slides: any[] = []

  let input: any = null
  let password: string = ""
  const submit = () => (showRef = { id: input.id, password })

  // local storage
  let remember: boolean = false
  if (localStorage.show) {
    let password = undefined
    if (localStorage.password) {
      remember = true
      password = localStorage.password
    }
    showRef = { id: localStorage.show, password }
  }

  // error
  let errors: string[] = []
  const setError = (err: string) => {
    if (!errors.includes(err)) {
      errors = [...errors, err]
      setTimeout(() => (errors = errors.slice(1, errors.length)), 2000)
    }
  }

  socket.on("STAGE", (msg) => {
    console.log(msg)
    switch (msg.channel) {
      case "ERROR":
        setError(lang.error[msg.data])
        input = null
        showRef = null
        delete localStorage.password
        delete localStorage.show
        break
      case "SHOWS":
        input = null
        if (msg.data.length === 1) {
          if (msg.data[0].password) {
            input = msg.data[0]
            shows = msg.data
            showRef = null
          } else showRef = { id: msg.data[0].id }
        } else {
          shows = msg.data
          if (showRef) {
            let index = shows.findIndex((s: any) => s.id === showRef.id)
            if (index < 0 || shows[index].enabled === false) showRef = null
          }
        }
        break
      case "SHOW":
        console.log(msg.data)

        if (msg.data === null) showRef = null
        else if (msg.data.enabled === false) {
          if (showRef.id === msg.data.id) showRef = null
          shows = shows.filter((s: any) => s.id === msg.data.id)
        } else {
          show = msg.data
          if (remember || !password.length) localStorage.show = showRef.id
          if (remember && password.length) localStorage.password = password
        }

        // localStorage.show = showRef
        break
      case "SLIDES":
        slides = msg.data
        break

      default:
        break
    }
  })

  $: {
    if (id && showRef !== null) socket.emit("STAGE", { id, channel: "SHOW", data: showRef })
  }

  let clicked: boolean = false
  const click = (e: any) => {
    if (show && !e.target.closest(".clicked")) clicked = !clicked
  }
  let timeout: any = null
  $: {
    if (clicked) {
      if (timeout !== null) clearTimeout(timeout)
      timeout = setTimeout(() => {
        clicked = false
        timeout = null
      }, 3000)
    }
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

{#if showRef === null && shows !== null}
  <div class="center">
    <div class="card">
      {#if input !== null}
        <h3>{input.name}</h3>
        <input
          on:keydown={(e) => {
            if (e.key === "Enter") submit()
          }}
          bind:value={password}
          type="password"
        />
        <span>
          <input type="checkbox" bind:checked={remember} />
          Remember me
        </span>
        <button on:click={submit}>Submit</button>
      {:else if shows.length}
        {#each shows as show}
          <Button
            on:click={() => {
              show.password ? (input = show) : (showRef = { id: show.id })
            }}
          >
            {show.name}
            {#if show.password}
              "locked"
            {/if}
          </Button>
        {/each}
      {:else}
        No shows
      {/if}
    </div>
  </div>
{:else if show}
  <!-- on click -->
  <!-- <div class="main">
    {show.name}
    home
  </div> -->
  <Slide {show} {slides} />
  {#if clicked}
    <div class="clicked">
      <h5>{show.name}</h5>
      <Button
        on:click={() => {
          delete localStorage.password
          delete localStorage.show
          input = null
          showRef = null
        }}
      >
        Home
      </Button>
    </div>
  {/if}
{:else}
  <div class="center">
    <h3>Loading...</h3>
  </div>
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

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background-color: var(--primary-darker);
    color: var(--text);
    font-family: system-ui;
    /* font-family: sans-serif; */
    font-size: 3em;

    width: 100vw;
    height: 100vh;
  }

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

  .center {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-darker);
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

  .clicked {
    position: absolute;
    top: 10px;
    left: 10px;
    background-color: var(--primary);
  }
</style>

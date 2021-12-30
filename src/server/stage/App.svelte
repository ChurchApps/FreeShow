<script lang="ts">
  import { io } from "socket.io-client"
  import Button from "./components/Button.svelte"
  import Slide from "./components/Slide.svelte"

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

  socket.on("STAGE", (msg) => {
    console.log(msg)
    if (msg.channel === "SHOWS") {
      input = null
      if (msg.data.length === 1) {
        if (msg.data[0].password?.length) {
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
    } else if (msg.channel === "SHOW") {
      if (msg.data === null) showRef = null
      else if (msg.data.enabled === false) {
        if (showRef.id === msg.data.id) showRef = null
        shows = shows.filter((s: any) => s.id === msg.data.id)
      } else show = msg.data

      // localStorage.show = showRef
    } else if (msg.channel === "SLIDES") {
      slides = msg.data
    } else if (msg.channel === "ERROR") {
      console.error(msg.data)
      showRef = null
    }
  })

  $: {
    if (showRef !== null) socket.emit("STAGE", { id, channel: "SHOW", data: showRef })
  }

  let input: any = null
  let password: string = ""
</script>

{#if showRef === null && shows !== null}
  <div class="center">
    <div class="card">
      {#if input !== null}
        <h3>{input.name}</h3>
        <input bind:value={password} type="password" />
        <button on:click={() => (showRef = { id: input.id, password })}>Submit</button>
      {:else if shows.length}
        {#each shows as show}
          <Button
            on:click={() => {
              show.password?.length ? (input = show) : (showRef = { id: show.id })
            }}
          >
            {show.name}
            {#if show.password.length}
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
    background-color: black;
    color: white;
    font-family: sans-serif;
    /* font-size: 25.5vw; */
    font-size: 3em;
    /* font-size: 20vh; */

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
</style>

<script lang="ts">
  import { io } from "socket.io-client"

  let socket = io()

  socket.on("connect", () => {
    console.log(socket.id)
    socket.emit("data", "test")
  })

  let activeView
  let views = []
  let formatting: boolean = false
  let boxes = []

  socket.on("STAGE", (data) => {
    console.log(data)
    let keys = Object.keys(data)
    if (!keys.length) {
      // no data
    } else if (keys.length === 1) {
      activeView = keys[0]
    } else {
      views = data
    }
    // boxes = slide.boxes
    // formatting = slide.formatting
    // if (slide !== null) {
    //   // TODO: turn formatting on/off
    //   let formatting = false
    //   slide.forEach((textbox) => {
    //     let box = document.createElement("div")
    //     box.classList.add("textbox")
    //     if (formatting) {
    //       textbox.style = "position: absolute;" + textbox.style
    //       box.setAttribute("style", textbox.style || "")
    //     }
    //     textbox.content.forEach((text) => {
    //       let p = document.createElement("p")
    //       p.setAttribute("style", text.style || "") // if (formatting)
    //       p.innerHTML = text.text
    //       box.appendChild(p)
    //     })
    //     document.querySelector(".main").appendChild(box)
    //   })
    // }
  })
</script>

<main>
  {#if Object.keys(views).length}
    {#each Object.entries(views) as view}
      <div class="button" id={view[0]}>
        {view[1].name}
      </div>
    {/each}
  {:else}
    <div class="main">Stage!!!</div>
  {/if}
</main>

<style>
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
    font-size: 4vw;
    /* font-size: 20vh; */
  }

  .main {
    /* display: flex;
  justify-content: center; */
    text-align: center;
  }

  :global(.textbox) {
    border: 1px dashed var(--secondary-opacity); /* DEBUG */
    /* position: absolute; */
    display: block;
  }

  :global(p) {
    display: inline;
    color: white;
  }
</style>

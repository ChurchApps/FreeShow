<script lang="ts">
  // DOES NOT WORK ON HTTP
  // https://stackoverflow.com/questions/60957829/navigator-mediadevices-is-undefined
  // https://stackoverflow.com/questions/16835421/how-to-allow-chrome-to-access-my-camera-on-localhost

  let canvas: any;
  let video: any;
  let context: any;

  // $: {
  //   if (canvas) {
  //     context = canvas.getContext("2d")

  //     canvas.width = 900
  //     canvas.height = 700

  //     context.width = canvas.width
  //     context.height = canvas.height
  //   }
  // }

  // let socket = io();
  import { io } from "socket.io-client";
  let socket = io();

  function viewVideo(video: any, context: any) {
    context.drawImage(video, 0, 0, context.width, context.height);
    // const base64 = this.result.replace(/.*base64,/, '');
    socket.emit("CAM", {
      channel: "STREAM",
      data: canvas.toDataURL("image/webp"),
    });
    // const base64 = canvas.toString("base64")
    // socket.emit("stream", base64)
  }

  const constraints: any = {
    width: { min: 1024, ideal: 1280, max: 1920 },
    height: { min: 576, ideal: 720, max: 1080 },
    facingMode: "environment",
  };

  let errors: any[] = [];

  // ;(function () {
  //   // let navigator: any
  //   // navigator = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msgGetUserMedia

  //   // if (navigator.getUserMedia) {
  //   navigator.mediaDevices
  //     .getUserMedia({ video: constraints, audio: false })
  //     .then((stream) => {
  //       // streams.push(mediaStream)
  //       video.srcObject = stream
  //       video.play()

  //       // width: { min: 1024, ideal: 1280, max: 1920 },
  //       // height: { min: 576, ideal: 720, max: 1080 },
  //     })
  //     .catch((err) => {
  //       errors.push(err.name + ": " + err.message)
  //       console.log(err.name + ": " + err.message)
  //     })
  //   // }

  //   setInterval(function () {
  //     viewVideo(video, context)
  //   }, 5)
  // })()

  //
  main();
  async function main() {
    // Set up front-facing camera
    await setupCamera();
    video.play();

    // Set up canvas for livestreaming
    // canvas = document.getElementById('facecanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context = canvas.getContext("2d");
    context.width = canvas.width;
    context.height = canvas.height;

    console.log("Camera setup done");

    setInterval(function () {
      viewVideo(video, context);
    }, 5);
  }

  async function setupCamera() {
    // Find the video element on our HTML page
    // video = document.getElementById('video');

    // Request the front-facing camera of the device
    console.log(constraints);

    console.log(navigator, navigator.mediaDevices);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        height: { ideal: 1920 },
        width: { ideal: 1920 },
      },
    });
    video.srcObject = stream;

    // Handle the video stream once it loads.
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        resolve(video);
      };
    });
  }
</script>

{#if errors.length}
  <div class="errors" style="position: absolute;">
    {#each errors as error}
      {error}
    {/each}
  </div>
{/if}
<div class="main">
  <video bind:this={video} class="video">
    <track kind="captions" />
  </video>
</div>
<canvas bind:this={canvas} style="display: none;" />

<!-- <svelte:window on:click={click} /> -->

<!-- {#if errors.length}
  <div class="error">
    {#each errors as error}
      <span>{error}</span>
    {/each}
  </div>
{/if} -->

<!-- web -->
<style>
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
    font-size: 1.5em;

    height: 100%;
    /* width: 100vw;
  height: 100vh; */
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

  .main {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
  }
  video {
    translate: scaleX(-1);
    height: 100%;
    width: 100%;
  }

  /* .error {
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

  .input {
    background-color: rgb(0 0 0 / 0.2);
    color: var(--text);
    padding: 10px 18px;
    border: none;
    font-size: inherit;
  }
  .input:active,
  .input:focus {
    outline: 2px solid var(--secondary);
  }
  .input::placeholder {
    color: inherit;
    opacity: 0.4;
  }

  .clicked {
    position: absolute;
    bottom: 0;
    left: 0;
    width: calc(100% - 20px);
    margin: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background-color: var(--primary);
  } */
</style>

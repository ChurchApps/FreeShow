<script lang="ts">
  export let id: string

  let videoElem: any

  let constraints: any = {
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: id,
        maxWidth: 1920,
        maxHeight: 1080,
        // maxAspectRatio: 16/9,
        maxFrameRate: 60,
      },
    },
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      videoElem.srcObject = stream
      videoElem.onloadedmetadata = () => videoElem?.play()
    })
    .catch((err) => {
      console.log(err.name + ": " + err.message)
    })
</script>

<video bind:this={videoElem} class={$$props.class} style={$$props.style}>
  <track kind="captions" />
</video>

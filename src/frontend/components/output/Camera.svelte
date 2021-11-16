<script lang="ts">
  export let id: string
  let videoElem: any

  navigator.mediaDevices
    .getUserMedia({
      video: {
        deviceId: id,
      },
    })
    .then((stream) => {
      videoElem.srcObject = stream
      videoElem.play()
    })
</script>

<video class={$$props.class} bind:this={videoElem}>
  <track kind="captions" />
</video>

<style>
  video {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }
</style>

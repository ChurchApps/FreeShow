<script lang="ts">
  export let video: any
  let l = 0
  let r = 0

  $: {
    if (video !== null) {
      // if ($output.audio.length) {
      //   draw()
      // }

      // setInterval(() => {
      //   if (Math.floor(Math.random() * 10) === 0) {
      //     l = Math.floor(Math.random() * 101) // 0 - 100
      //     r = Math.floor(Math.random() * 101) // 0 - 100
      //   } else {
      //     l = Math.floor(Math.random() * 25) + 60 // 60-85
      //     r = Math.floor(Math.random() * 25) + 60 // 60-85
      //   }
      // }, 100)

      // Pan to L / R
      // https://stackoverflow.com/questions/5123844/change-left-right-balance-on-playing-audio-in-javascript

      // https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
      let ac = new AudioContext()
      let source = ac.createMediaElementSource(video)
      let analyser = ac.createAnalyser() //we create an analyser
      analyser.smoothingTimeConstant = 0.9
      analyser.fftSize = 512 //the total samples are half the fft size.

      source.connect(analyser)
      analyser.connect(ac.destination)
      // window.ctx = document.getElementById("c").getContext("2d")

      //       analyser.fftSize = 2048;
      // var bufferLength = analyser.frequencyBinCount;
      // var dataArray = new Uint8Array(bufferLength);

      console.log(analyser)

      // let buffer = ac.createBuffer(2, 2, 3000)
      // console.log(buffer)

      // let bufferSource: any = ac.createBufferSource()
      // let someStereoBuffer: ArrayBuffer = null

      console.log(analyser.channelCount)
      // var source = ac.createBufferSource()

      // var bufferSource = ac.createBuffer(2, 5000, ac.sampleRate);
      // var bufferSource = ac.createBufferSource()
      // const buffer = new ArrayBuffer(8)

      // ac.decodeAudioData(buffer, function (data) {
      // var bufferSurce = ac.createBufferSource()
      // bufferSurce.buffer = data
      // var splitter = ac.createChannelSplitter(2)
      // // bufferSource.connect(splitter)
      // var merger = ac.createChannelMerger(2)

      // console.log(splitter)

      // Reduce the volume of the left channel only
      // var gainNode = ac.createGain()
      // gainNode.gain.setValueAtTime(0.5, ac.currentTime)
      // splitter.connect(gainNode, 0)

      // // Connect the splitter back to the second input of the merger: we
      // // effectively swap the channels, here, reversing the stereo image.
      // gainNode.connect(merger, 0, 1)
      // splitter.connect(merger, 1, 0)

      // var dest = ac.createMediaStreamDestination()

      // // Because we have used a ChannelMergerNode, we now have a stereo
      // // MediaStream we can use to pipe the Web Audio graph to WebRTC,
      // // MediaRecorder, etc.
      // merger.connect(dest)
      // // })

      // var splitter = context.createChannelSplitter(2)
      // console.log(splitter)
      // var merger = context.createChannelMerger(2)
      // var dest = context.createMediaStreamDestination()
      // merger.connect(dest)

      setInterval(() => {
        var array = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(array)
        // console.log(array)

        // ctx.clearRect(0, 0, 512, 512)

        var average = 0
        var max = 0
        for (let i = 0; i < array.length; i++) {
          let a = Math.abs(array[i] - 128)
          average += a
          max = Math.max(max, a)
        }

        average /= array.length

        l = Math.min(100, (average / 128) * 100 * 2)
        r = Math.min(100, (average / 128) * 100 * 2)

        // console.log((average / 128) * 100)

        //ctx.fillStyle = 'blue';
        //ctx.fillRect(0, 512-average, 512, 512);
        // ctx.beginPath()
        // ctx.arc(128, 128, average, 0, Math.PI * 2, true)
        // ctx.arc(128 + 256, 128, max, 0, Math.PI * 2, true)
        // ctx.closePath()
        // ctx.fill()

        // requestAnimationFrame(draw)
      }, 50)
    }
  }
</script>

<div class="main">
  <span class="left">
    <!-- <p>L</p> -->
    <div style="height: {100 - l}%" />
  </span>
  <span class="right">
    <!-- <p>R</p> -->
    <div style="height: {100 - r}%" />
  </span>
</div>

<style>
  .main {
    width: 15px;
    display: flex;
    border-left: 5px solid var(--primary-lighter);
  }

  span {
    background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%);
    filter: hue-rotate(250deg);
    width: 50%;
  }

  span div {
    transition: height 0.1s ease 0s;
    background-color: var(--primary);
    width: 100%;
  }
</style>

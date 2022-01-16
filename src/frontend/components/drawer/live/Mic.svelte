<script lang="ts">
  export let mic: any
  export let streams: any[]

  // https://dobrian.github.io/cmp/topics/sample-recording-and-playback-with-web-audio-api/1.loading-and-playing-sound-files.html

  // https://developers.google.com/web/fundamentals/media/recording-audio
  // TODO: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
  //   class MyAudioProcessor extends AudioWorklet {
  //   constructor() {
  //     super();
  //   }

  //   process(inputList, outputList, parameters) {
  //     /* using the inputs (or not, as needed), write the output
  //        into each of the outputs */

  //     return true;
  //   }
  // };

  // registerProcessor("processor", MyAudioProcessor);

  let soundLevel: number = 0

  const handleSuccess = function (stream: any) {
    streams.push(stream)
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    // const processor = new AudioWorkletNode(context, "processor")
    // const processor = context.createScriptProcessor(1024, 1, 1)

    // source.connect(processor)
    // processor.connect(context.destination)

    // processor.onaudioprocess = function (e) {
    //   // Do something with the data, e.g. convert it to WAV
    //   console.log(e.inputBuffer)
    // }

    var analyser = context.createAnalyser()
    analyser.smoothingTimeConstant = 0.2
    analyser.fftSize = 1024

    var node = context.createScriptProcessor(2048, 1, 1)

    var values = 0
    var average
    node.onaudioprocess = function () {
      // bitcount is fftsize / 2
      var array = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(array)

      var length = array.length
      for (var i = 0; i < length; i++) {
        values += array[i]
      }

      average = values / length
      // console.log(average)
      soundLevel = Math.min(100, average)

      average = values = 0
    }

    // var input = context.createMediaStreamSource(stream)

    source.connect(analyser)
    analyser.connect(node)
    node.connect(context.destination)

    if (mic.id === "default") {
      source.connect(context.destination)
      // source.play()
    }

    //input.connect(context.destination); // hello feedback
  }

  navigator.mediaDevices
    .getUserMedia({
      audio: {
        deviceId: mic.id,
      },
    })
    .then(handleSuccess)
</script>

<div class="main">
  <span>
    {mic.name}
  </span>

  <span class="meter">
    <!-- <p>L</p> -->
    <div style="width: {100 - soundLevel}%" />
  </span>
</div>

<style>
  .main {
    display: flex;
    justify-content: space-between;
  }
  .meter {
    background-image: linear-gradient(to right, rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%);
    /* filter: hue-rotate(250deg); */
    height: 5px;
    width: 50%;
  }

  .meter div {
    transition: width 0.1s ease 0s;
    background-color: var(--primary);
    height: 100%;
  }
</style>

// https://stackoverflow.com/questions/58826117/split-stereo-audio-file-into-audionodes-for-each-channel
// https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/getChannelData
// web audio api get left right
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createChannelSplitter

export function audioAnalyser(analyser: any) {
    // Pan to L / R
    // https://stackoverflow.com/questions/5123844/change-left-right-balance-on-playing-audio-in-javascript

    // let buffer = ac.createBuffer(2, 512, ac.sampleRate)
    // let one = buffer.getChannelData(0)
    // let two = buffer.getChannelData(1)

    // console.log(source)

    // let someStereoBuffer: ArrayBuffer = new ArrayBuffer(512)
    // ac.decodeAudioData(
    //   someStereoBuffer,
    //   (data) => {
    //     console.log("DECODED")

    //     let source = ac.createBufferSource()
    //     source.buffer = data
    //     let splitter = ac.createChannelSplitter(2)
    //     source.connect(splitter)
    //     console.log(splitter)
    //     let merger = ac.createChannelMerger(2)

    //     // Reduce the volume of the left channel only
    //     let gainNode = ac.createGain()
    //     gainNode.gain.setValueAtTime(0.5, ac.currentTime)
    //     splitter.connect(gainNode, 0)

    //     // Connect the splitter back to the second input of the merger: we
    //     // effectively swap the channels, here, reversing the stereo image.
    //     gainNode.connect(merger, 0, 1)
    //     splitter.connect(merger, 1, 0)

    //     let dest = ac.createMediaStreamDestination()

    //     // Because we have used a ChannelMergerNode, we now have a stereo
    //     // MediaStream we can use to pipe the Web Audio graph to WebRTC,
    //     // MediaRecorder, etc.
    //     merger.connect(dest)
    //   },
    //   (err) => console.log(err)
    // )

    // window.ctx = document.getElementById("c").getContext("2d")

    //       analyser.fftSize = 2048;
    // var bufferLength = analyser.frequencyBinCount;
    // var dataArray = new Uint8Array(bufferLength);

    // console.log(analyser)

    // let buffer = ac.createBuffer(2, 2, 3000)
    // console.log(buffer)

    // let bufferSource: any = ac.createBufferSource()
    // let someStereoBuffer: ArrayBuffer = null

    // console.log(analyser.channelCount)
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

    return channels(analyser)
}

function channels(analyser: any) {
    // let audioChannels: { left: number; right: number } = { left: 0, right: 0 }
    let channel = 0

    // TODO: no interval?
    var array = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(array)
    // console.log(array)

    // ctx.clearRect(0, 0, 512, 512)

    var average = 0
    var max = 0
    for (let i = 0; i < array.length; i++) {
        const a = Math.abs(array[i] - 128)
        average += a
        max = Math.max(max, a)
    }

    average /= array.length

    // const GAIN = 2
    // audioChannels.left = Math.min(100, (average / 128) * 100 * GAIN)
    // audioChannels.right = Math.min(100, (average / 128) * 100 * GAIN)
    // channel = Math.min(100, (average / 128) * 100 * GAIN)
    channel = (average / 256) * 100
    // not sure about this
    if (channel < 25) channel *= 3
    else if (channel < 50) channel *= 2
    else if (channel < 75) channel *= 1.2

    // decibels

    analyser.getByteFrequencyData(array)
    analyser.maxDecibels = -10
    // analyser.maxDecibels = 0
    const value = array[0]
    const percent = value / 255
    const dB = analyser.minDecibels + (analyser.maxDecibels - analyser.minDecibels) * percent

    return {
        volume: channel,
        dB: { value: dB, min: analyser.minDecibels, max: analyser.maxDecibels },
    }
}

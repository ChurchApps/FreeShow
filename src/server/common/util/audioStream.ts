export let audioContext: AudioContext | null = null
const bufferQueue: { channels: Float32Array[]; sampleRate: number }[] = []
let isPlaying = false

let gainNode: GainNode | null = null
function createGain() {
    gainNode = audioContext!.createGain()
    gainNode.connect(audioContext!.destination)
}

export const mutePlayback = () => {
    if (!audioContext) return
    if (!gainNode) createGain()

    gainNode!.gain.value = 0
}

export const unmutePlayback = () => {
    if (!audioContext) return
    if (!gainNode) createGain()

    gainNode!.gain.value = 1
}

// PCM/interleaved/signed-int16/little-endian
export async function processBuffer(pcmBuffer: ArrayBuffer, { sampleRate, channelCount }: any) {
    if (!audioContext) audioContext = new AudioContext({ sampleRate })

    const pcmInt16 = new Int16Array(pcmBuffer)
    const pcmFloat32 = new Float32Array(pcmInt16.length)

    // convert Int16 (-32768 to 32767) → Float32 (-1.0 to 1.0)
    for (let i = 0; i < pcmInt16.length; i++) {
        pcmFloat32[i] = pcmInt16[i] / 32768.0
    }

    const channels = new Array(channelCount).fill(null).map(() => new Float32Array(pcmFloat32.length / channelCount))

    // split the interleaved PCM data into separate channels
    for (let i = 0; i < pcmFloat32.length; i++) {
        const channelIndex = i % channelCount // determine which channel this sample belongs to
        channels[channelIndex][Math.floor(i / channelCount)] = pcmFloat32[i]
    }

    // calculate duration of this buffer in seconds
    // const numberOfSamples = pcmFloat32.length
    // const bufferDuration = numberOfSamples / sampleRate
    // shouldBeTime += bufferDuration

    // add the PCM data to the buffer queue
    bufferQueue.push({ channels, sampleRate })

    // if we are not already playing, start playback
    if (!isPlaying) playNextBuffer()
}

let nextStartTime: number | null = null // track the start time for the next buffer
const playNextBuffer = () => {
    if (bufferQueue.length === 0 || !audioContext) {
        // no more data to play, exit
        isPlaying = false
        return
    }

    const { channels, sampleRate } = bufferQueue.shift()!

    // const offset = Math.max(0, shouldBeTime - audioContext!.currentTime)
    // console.log("OFFSET", bufferQueue.length, offset)
    console.log(bufferQueue.length)

    const audioBuffer = audioContext.createBuffer(channels.length, channels[0].length, sampleRate)
    for (let i = 0; i < channels.length; i++) {
        audioBuffer.copyToChannel(channels[i], i)
    }

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)

    // calculate the start time for this buffer
    const now = audioContext.currentTime
    // calculate the start time based on the total played duration
    // const startTime = nextStartTime || Math.max(now, bufferQueueOffset)
    const startTime = nextStartTime || now

    // add custom delay so audio gets time to load
    // const customTime = bufferQueue.length ? 0 : 0.8

    // set the next start time for the following buffer to be the current buffer's end time
    nextStartTime = startTime + audioBuffer.duration

    // synchronize playback timing with input data
    // bufferQueueOffset = nextStartTime

    source.start(startTime)

    source.onended = next
    isPlaying = true

    // dynamically pre-buffer the next chunk before it finishes playing
    const preBufferDelay = Math.max(0, nextStartTime - audioContext.currentTime - 0.2)
    if (bufferQueue.length > 0) setTimeout(next, preBufferDelay * 1000)

    let nextCalled = false
    function next() {
        if (nextCalled) return
        nextCalled = true

        playNextBuffer()
    }
}

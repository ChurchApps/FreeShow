import { get } from "svelte/store"
import { audioChannels, playingAudio } from "../../stores"
import { audioAnalyser } from "../output/audioAnalyser"

export async function playAudio({ path, name = "" }: any, pauseIfPlaying: boolean = true) {
  let existing: any = get(playingAudio)[path]
  if (existing) {
    if (!pauseIfPlaying) return

    playingAudio.update((a) => {
      let isPaused: boolean = a[path].paused
      a[path].paused = !isPaused
      if (isPaused) {
        a[path].audio.play()
        analyseAudio()
      } else a[path].audio.pause()
      return a
    })
    return
  }

  let audio = new Audio(path)
  let analyser: any = await getAnalyser(audio)
  playingAudio.update((a) => {
    a[path] = {
      name: name.indexOf(".") ? name.slice(0, name.lastIndexOf(".")) : name,
      paused: false,
      analyser,
      audio,
    }
    return a
  })

  audio.play()
  analyseAudio()
}

// const audioUpdateInterval: number = 100 // ms
const audioUpdateInterval: number = 50 // ms
let interval: any = null
function analyseAudio() {
  if (interval) return

  let allAudio: any[] = Object.values(get(playingAudio)).filter((a) => a.paused === false)
  let updateAudio: number = 0
  interval = setInterval(() => {
    // get new audio
    updateAudio++
    if (updateAudio > 10) {
      updateAudio = 0
      allAudio = Object.entries(get(playingAudio))
        .map(([id, a]: any) => ({ id, ...a }))
        .filter((audio) => {
          // check if finished
          if (!audio.paused && audio.audio.currentTime >= audio.audio.duration) {
            playingAudio.update((a: any) => {
              // a[audio.id].paused = true
              delete a[audio.id]
              return a
            })
            return false
          }

          return audio.paused === false
        })
    }

    if (!allAudio.length) {
      audioChannels.set({ left: 0, right: 0 })
      clearInterval(interval)
      interval = null
      return
    }

    // merge audio
    let allLefts: number[] = []
    let allRights: number[] = []
    allAudio.forEach((a: any) => {
      let aa = audioAnalyser(a.analyser)
      if (aa.left > 0 || aa.right > 0) {
        allLefts.push(aa.left)
        allRights.push(aa.right)
      }
    })
    let merged = { left: getHighestNumber(allLefts), right: getHighestNumber(allRights) }
    audioChannels.set(merged)
  }, audioUpdateInterval)
}

// function getAverageNumber(numbers: number[]): number {
//   let total: number = numbers.reduce((count: number, num: number): number => count + num)
//   return total / numbers.length
// }

function getHighestNumber(numbers: number[]): number {
  return Math.max(...numbers)
}

export function clearAudio() {
  Object.values(get(playingAudio)).forEach((a: any) => {
    a.audio.pause()
  })
  playingAudio.set({})
}

// https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
async function getAnalyser(audio: any) {
  let analyser: any = null

  let ac = new AudioContext()
  let source = ac.createMediaElementSource(audio)

  analyser = ac.createAnalyser() //we create an analyser
  analyser.smoothingTimeConstant = 0.9
  analyser.fftSize = 512 //the total samples are half the fft size.

  source.connect(analyser)
  analyser.connect(ac.destination)

  return analyser
}

export async function getAudioDuration(path: string) {
  return new Promise((resolve) => {
    let audio: any = new Audio(path)
    audio.addEventListener("canplaythrough", (_: any) => {
      resolve(audio.duration)
    })
  })
}

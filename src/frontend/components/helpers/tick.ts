import { get } from "svelte/store"
import { outputs, slideTimers } from "../../stores"
import { nextSlide } from "./showActions"

// let timers: any = {}
// let activeTimers: string[] = []

export function newSlideTimer(id: string, duration: number) {
  if (duration <= 0) return
  // timerMax = duration

  // if (timers[id]) return timers[id]
  // if (timers[id]) timers[id].stop()

  // timer = { time: 0, paused: true }
  if (get(slideTimers)[id]) {
    get(slideTimers)[id]?.timer?.clear()
    // delete timers[id]
  }

  slideTimers.update((a) => {
    a[id] = { time: 0, paused: true, sliderTimer: null, autoPlay: true, max: duration, timer: new Timer(timerEnded, duration * 1000, id) }
    return a
  })

  setTimeout(() => {
    get(slideTimers)[id]?.timer?.resume()
  }, 10)

  function timerEnded(id: string) {
    // if (timer.paused) {
    //   timer = { time: 0, paused: true }
    //   return
    // }

    // console.log(currentOutput.out?.slide?.index)
    // outTransition.set(null)

    if (!get(slideTimers)[id]) return

    outputs.update((a) => {
      if (a[id].out) a[id].out!.transition = null
      return a
    })

    slideTimers.update((a) => {
      delete a[id]
      return a
    })

    nextSlide(null, false, false, true, true, id)
    // timer = { time: 0, paused: false }
  }

  // return get(timers)[id]
}

// let timer = { time: 0, paused: true }
// let timerMax: number = 0
// let timeObj: any = null
// let sliderTimer: any = null
// let autoPlay: boolean = true
const Timer: any = function (this: any, callback: any, delay: number, id: any) {
  let timeout: any
  let start: number
  let remaining: number = delay
  let options: any = {}

  // let options: any = get(timers)[id]
  // options.time = options.max - remaining / 1000

  this.clear = () => {
    clearTimeout(timeout)
    clearTimeout(options.sliderTimer)
    timeout = null
    options.sliderTimer = null
    slideTimers.update((a) => {
      delete a[id]
      return a
    })
  }

  this.pause = () => {
    options = get(slideTimers)[id]
    clearTimeout(timeout)
    clearTimeout(options.sliderTimer)
    timeout = null
    options.sliderTimer = null
    options.autoPlay = false
    remaining -= Date.now() - start
    options.time = options.max - remaining / 1000
    options.paused = true
    update()
  }

  this.resume = () => {
    if (timeout) return
    options = get(slideTimers)[id]
    start = Date.now()
    remaining = (options.max - options.time) * 1000
    options.autoPlay = true
    timeout = setTimeout(() => {
      clearTimeout(timeout)
      timeout = null
      callback(id)
    }, remaining)
    options.paused = false
    sliderTime(id)
    console.log(get(slideTimers)[id])
    update()
  }

  function update() {
    slideTimers.update((a) => {
      a[id] = { ...a, ...options }
      return a
    })
  }

  // if (options.autoPlay) this.resume()
}

function sliderTime(id: any) {
  let options = get(slideTimers)[id]
  if (!options) return

  if (!options.sliderTimer && options.timer && !options.paused && options.autoPlay) {
    options.sliderTimer = setTimeout(() => {
      options = get(slideTimers)[id]
      if (options && options.sliderTimer && options.timer && !options.paused) {
        slideTimers.update((a) => {
          if (options.time < options.max) a[id].time += 0.5
          a[id].time = Math.min(a[id].time, options.max)
          // TODO: weird timing...
          console.log(a[id].time)
          a[id].sliderTimer = null
          return a
        })
        setTimeout(() => {
          sliderTime(id)
        }, 10)
      }
    }, 490)
  }
}

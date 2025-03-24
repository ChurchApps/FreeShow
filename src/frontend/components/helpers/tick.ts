import { get } from "svelte/store"
import { outputs, slideTimers } from "../../stores"
import { clone } from "./array"
import { nextSlide } from "./showActions"

// let timers: any = {}
// let activeTimers: string[] = []

export function newSlideTimer(id: string, duration: number) {
    if (duration <= 0) return
    // timerMax = duration

    console.log("CREATE SLIDE TIMER", duration)
    console.log("CURRENT TIMERS", get(slideTimers))

    // if (timers[id]) return timers[id]
    // if (timers[id]) timers[id].stop()

    // timer = { time: 0, paused: true }
    if (get(slideTimers)[id]) {
        get(slideTimers)[id]?.timer?.clear()
        // delete timers[id]
    }

    // let currentOutput = getActiveOutputs(get(outputs), false, true, true)[0]
    // let outputStyle =get(styles)[currentOutput.style] || {}
    // let lines = outputStyle.lines || 0
    // let currentLine = get(outputs)[currentOutput]?.out?.slide?.line || 0
    // if (lines) duration /= lines
    // , currentLine, lines

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

        // get and reset active element
        let activeElem = document.activeElement
        if (activeElem) {
            setTimeout(() => {
                ;(activeElem as HTMLElement).focus()
            }, 10)
        }

        if (!get(slideTimers)[id]) return

        outputs.update((a) => {
            if (a[id].out) a[id].out!.transition = null
            return a
        })

        slideTimers.update((a) => {
            delete a[id]
            return a
        })

        console.log("DONE", clone(get(slideTimers)), id)

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
const Timer: any = function (this: any, callback: (id: string) => void, delay: number, id: string) {
    let timeout: NodeJS.Timeout | null
    let start: number
    let remaining: number = delay
    let options: any = {}

    // let options: any = get(timers)[id]
    // options.time = options.max - remaining / 1000

    this.clear = () => {
        if (timeout) clearTimeout(timeout)
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
        if (timeout) clearTimeout(timeout)
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
        options.remaining = remaining
        options.autoPlay = true
        timeout = setTimeout(() => {
            if (timeout) clearTimeout(timeout)
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
            a[id] = { ...a, ...options, start }
            return a
        })
    }

    // if (options.autoPlay) this.resume()
}

function sliderTime(id: any) {
    let options = get(slideTimers)[id]
    if (!options) return
    if (options.sliderTimer || !options.timer || options.paused || !options.autoPlay) return

    options.sliderTimer = setTimeout(() => {
        options = clone(get(slideTimers)[id])
        if (!options || !options.sliderTimer || !options.timer || options.paused) return

        slideTimers.update((a) => {
            if (!options.remaining || !options.start) return a

            let remaining = options.remaining - (Date.now() - options.start)
            a[id].time = options.max - remaining / 1000
            a[id].time = Math.min(a[id].time, options.max)

            a[id].sliderTimer = null
            return a
        })

        setTimeout(() => {
            sliderTime(id)
        }, 10)
    }, 50)
}

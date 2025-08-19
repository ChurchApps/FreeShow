import { get } from "svelte/store"
import { outputs, slideTimers } from "../../stores"
import { clone } from "./array"
import { nextSlide } from "./showActions"
import { playFolder } from "../../utils/shortcuts"

export function newSlideTimer(timerId: string, duration: number, folderPath = "") {
    if (duration <= 0) return

    if (get(slideTimers)[timerId]) {
        get(slideTimers)[timerId]?.timer?.clear()
    }

    slideTimers.update((a) => {
        a[timerId] = { time: 0, paused: true, sliderTimer: null, autoPlay: true, max: duration, timer: new Timer(timerEnded, duration * 1000, timerId), data: folderPath }
        return a
    })

    setTimeout(() => {
        get(slideTimers)[timerId]?.timer?.resume()
    }, 10)

    function timerEnded(id: string) {
        if (!get(slideTimers)[id]) return

        const data = get(slideTimers)[id].data || ""

        outputs.update((a) => {
            if (a[id].out) a[id].out!.transition = null
            return a
        })

        slideTimers.update((a) => {
            delete a[id]
            return a
        })

        if (data) {
            playFolder(data)
            return
        }

        nextSlide(null, false, false, true, true, id)
    }
}

const Timer: any = function (this: any, callback: (id: string) => void, delay: number, timerId: string) {
    let timeout: NodeJS.Timeout | null
    let start: number
    let remaining: number = delay
    let options: any = {}

    this.clear = () => {
        if (timeout) clearTimeout(timeout)
        clearTimeout(options.sliderTimer)
        timeout = null
        options.sliderTimer = null
        slideTimers.update((a) => {
            delete a[timerId]
            return a
        })
    }

    this.pause = () => {
        options = get(slideTimers)[timerId]
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
        options = get(slideTimers)[timerId]
        start = Date.now()
        remaining = (options.max - options.time) * 1000
        options.remaining = remaining
        options.autoPlay = true
        timeout = setTimeout(() => {
            if (timeout) clearTimeout(timeout)
            timeout = null
            callback(timerId)
        }, remaining)
        options.paused = false
        sliderTime(timerId)
        update()
    }

    function update() {
        slideTimers.update((a) => {
            a[timerId] = { ...a, ...options, start }
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

            const remaining = options.remaining - (Date.now() - options.start)
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

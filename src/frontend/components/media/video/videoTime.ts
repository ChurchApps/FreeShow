type TimeCallback = (time: number) => void

export class TimeInterpolator {
    private baseValue = 0
    private baseTime = performance.now()
    private playing = false
    private _speed = 1

    constructor(private readonly callback?: TimeCallback, speed = 1) {
        this._speed = speed > 0 ? speed : 1
    }

    setSpeed(speed: number): void {
        const current = this.value
        this.baseValue = current
        this.baseTime = performance.now()
        this._speed = speed > 0 ? speed : 1
    }

    get speed(): number {
        return this._speed
    }

    update(value: number): void {
        this.baseValue = value
        this.baseTime = performance.now()
    }

    play(): void {
        if (this.playing) return
        this.baseTime = performance.now()
        this.playing = true

        const tick = (now: number) => {
            if (!this.playing) return

            const value = this.baseValue + ((now - this.baseTime) / 1000) * this._speed
            this.callback?.(value)

            requestAnimationFrame(tick)
        }

        requestAnimationFrame(tick)
    }

    pause(): void {
        if (!this.playing) return

        // Freeze the current interpolated value
        this.baseValue = this.value
        this.playing = false
    }

    get value(): number {
        if (!this.playing) {
            return this.baseValue
        }

        return this.baseValue + ((performance.now() - this.baseTime) / 1000) * this._speed
    }
}

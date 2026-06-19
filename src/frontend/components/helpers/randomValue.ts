import { get } from "svelte/store"
import { randomNumberVariable, variables } from "../../stores"
import { newToast, wait } from "../../utils/common"

function updateVariable(id: string, key: string, value: any) {
    variables.update((a) => {
        a[id][key] = value
        return a
    })
}

export function setRandomValue(id: string) {
    if (get(randomNumberVariable)[id]) return

    const variable = get(variables)[id]
    if (!variable.sets) variable.sets = [{ name: "", minValue: 1, maxValue: 1000 }]

    // map sets to ranges with counts
    const ranges = variable.sets.map((set, i) => {
        const min = Number(set.minValue ?? 1)
        const max = Number(set.maxValue ?? 1000)
        const name = set.name || `#${i + 1}`

        const start = Math.min(min, max)
        const end = Math.max(min, max)
        const count = end - start + 1

        return { name, start, count }
    })

    const total = ranges.reduce((sum, r) => sum + r.count, 0)

    if (variable.eachNumberOnce && (variable.setLog?.length || 0) >= total) {
        newToast("toast.reached_end")
        return
    }

    let randomValue: { name: string; number: number } | null = null
    let loopStop = 0
    do {
        loopStop++

        // get random number evenly from total number of values
        let randomIndex = Math.floor(Math.random() * total)

        // find which range the index falls into
        randomValue = null
        for (const range of ranges) {
            if (randomIndex < range.count) {
                randomValue = { name: range.name, number: range.start + randomIndex }
                break
            }
            randomIndex -= range.count
        }
    } while (variable.eachNumberOnce && randomValue && variable.setLog?.find((a) => a.name === randomValue!.name && Number(a.number) === randomValue!.number) && loopStop < 50000)

    if (!randomValue) return

    updateVariable(id, "setName", "")

    if (variable.animate) {
        const rawDur = variable.animationDuration ?? 3
        const duration = rawDur > 100 ? rawDur : rawDur * 1000
        animateValue(id, getSetChars(variable.sets), randomValue, variable.animateTowardsResult ?? false, duration)
    } else {
        setRandom(id, randomValue)
    }
}

let lastNums: number[] = []
async function animateValue(id: string, chars: number, finalValue: { name: string; number: number }, animateTowardsResult: boolean, duration: number, currentStep = 0) {
    if (currentStep === 0) {
        randomNumberVariable.update((a) => {
            a[id] = true
            return a
        })
    }

    if (animateTowardsResult) {
        const startVal = Number(get(variables)[id]?.number) || 0
        const totalSteps = Math.abs(finalValue.number - startVal)

        if (totalSteps > 0) {
            const startTime = Date.now()
            let lastVal = startVal

            while (true) {
                const elapsed = Date.now() - startTime
                if (elapsed >= duration) break

                const progress = elapsed / duration
                const currentVal = Math.round(startVal + (finalValue.number - startVal) * progress)

                if (currentVal !== lastVal) {
                    updateVariable(id, "number", currentVal)
                    lastVal = currentVal
                }
                await wait(16)
            }
        }
    } else {
        const speed = 60
        const stepsPerDigit = Math.max(1, Math.round(duration / (chars * speed)))
        const start = finalValue.number.toString().padStart(chars, "0").slice(0, currentStep)

        for (let i = 0; i < stepsPerDigit; i++) {
            let randomNumber = start
            ;[...Array(chars - currentStep)].forEach((_, step) => {
                // never display the same int twice in a row
                let num = -1
                do {
                    num = Math.floor(Math.random() * 10)
                } while (lastNums[step] === num)

                lastNums[step] = num
                randomNumber += num
            })

            updateVariable(id, "number", Number(randomNumber))
            await wait(speed)
        }

        if (currentStep < chars - 1) {
            animateValue(id, chars, finalValue, animateTowardsResult, duration, currentStep + 1)
            return
        }
    }

    lastNums = []
    setRandom(id, finalValue)

    randomNumberVariable.update((a) => {
        delete a[id]
        return a
    })
}

function setRandom(id: string, finalValue: { name: string; number: number }) {
    variables.update((a) => {
        a[id].number = finalValue.number
        a[id].setName = finalValue.name

        // numbers log
        const MAX_LOG_SIZE = 100
        const setLog = (a[id].setLog || []).slice(0, MAX_LOG_SIZE)
        setLog.unshift({ name: finalValue.name, number: finalValue.number.toString().padStart(getSetChars(a[id].sets), "0") })
        a[id].setLog = setLog

        return a
    })
}

export function getSetChars(sets: { name: string; minValue?: number; maxValue?: number }[] | undefined) {
    let chars = 1
    if (!sets) return 4

    sets.forEach((a) => {
        const minChars = (a.minValue ?? 1).toString().length
        const maxChars = (a.maxValue ?? 1000).toString().length
        if (minChars > chars) chars = minChars
        if (maxChars > chars) chars = maxChars
    })

    return chars
}

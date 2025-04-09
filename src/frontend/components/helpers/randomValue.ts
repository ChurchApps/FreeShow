import { get } from "svelte/store"
import { randomNumberVariable, variables } from "../../stores"
import { wait } from "../../utils/common"

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

    // const allSets: { name: string; number: number }[] = []
    // variable.sets.forEach((set, i) => {
    //     const min = Number(set.minValue ?? 1)
    //     const max = Number(set.maxValue ?? 1000)
    //     const name = set.name || `#${i + 1}`

    //     const minNumber = Math.min(min, max)
    //     ;[...Array(Math.abs(max - min + 1))].forEach((_, i) => {
    //         const number = i + minNumber
    //         allSets.push({ name, number })
    //     })
    // })
    // const randomValue = allSets[Math.floor(Math.random() * allSets.length)]

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

    // get random number evenly from total number of values
    const total = ranges.reduce((sum, r) => sum + r.count, 0)
    let randomIndex = Math.floor(Math.random() * total)

    // find which range the index falls into
    let randomValue: { name: string; number: number } | null = null
    for (const range of ranges) {
        if (randomIndex < range.count) {
            randomValue = { name: range.name, number: range.start + randomIndex }
            break
        }
        randomIndex -= range.count
    }

    if (!randomValue) return

    updateVariable(id, "setName", "")

    if (variable.animate) animateValue(id, getSetChars(variable.sets), randomValue)
    else setRandom(id, randomValue)
}

const steps = 15
let lastNums: number[] = []
async function animateValue(id: string, chars: number, finalValue: { name: string; number: number }, currentStep: number = 0) {
    if (currentStep === 0) {
        randomNumberVariable.update((a) => {
            a[id] = true
            return a
        })
    }

    const start = finalValue.number.toString().padStart(chars, "0").slice(0, currentStep)

    for (let i = 0; i < steps; i++) {
        let randomNumber = start
        ;[...Array(chars - currentStep)].forEach((_, i) => {
            // never display the same int twice in a row
            let num = -1
            do {
                num = Math.floor(Math.random() * 10) // 0-9
            } while (lastNums[i] === num)

            lastNums[i] = num
            randomNumber += num
        })

        updateVariable(id, "number", Number(randomNumber))

        await wait(60)
    }

    if (currentStep < chars - 1) {
        animateValue(id, chars, finalValue, currentStep + 1)
        return
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
        setLog.unshift(finalValue)
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

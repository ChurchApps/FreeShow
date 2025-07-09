import type { AnimationAction } from "../../../types/Output"
import type { AnimationData } from "../../../types/Show"
import { activeAnimate } from "../../stores"
import { wait } from "../../utils/common"
import { clone } from "../helpers/array"

export async function updateAnimation(animationData: AnimationData, currentIndex: number, outSlide: any) {
    if (!animationData.animation) return {}

    // give time for initial element & prevent infinite loops
    if (currentIndex === 0) await wait(50)

    const currentAnimation = clone(animationData.animation.actions[currentIndex])

    // visual outline in popup
    if (!currentAnimation || !outSlide) {
        activeAnimate.set({ slide: -1, index: -1 })
        return {}
    }
    activeAnimate.set({ slide: outSlide.index, index: currentIndex })

    // trigger animation action
    await animations[currentAnimation.type](currentAnimation, animationData)

    // get next animation action
    let newIndex = currentIndex + 1
    if (!animationData.animation.actions[newIndex] && animationData.animation.repeat) newIndex = 0
    animationData.newIndex = newIndex

    return animationData
}

const animations = {
    wait: async ({ duration }: AnimationAction) => await wait(duration * 1000),
    set: ({ id, key, value, extension }: AnimationAction, animationData: AnimationData) => {
        const action: AnimationAction = { type: "change", id, key, value, extension, duration: 0 }
        animations.change(action, animationData)
    },
    change: async ({ id, key, value: actionValue, extension, duration }: AnimationAction, animationData: AnimationData) => {
        let value: string = (actionValue || 0).toString()
        if (extension) value += extension

        // values
        let initialValue = ""
        if (id === "background") {
            if (key === "filter") {
                // filter
            } else {
                // zoom
                key = "transform"
                initialValue = "transform-origin: center;transform: scale(1);"
                const randomScale = 1 + (Math.random() * 0.5) // This gives 1.0 to 1.5
                //const randomTranslateX = randomNumBetween(-8, 8) / 2
                //const randomTranslateY = randomNumBetween(-8, 8) / 2
                value = `scale(${randomScale})`
            }
        }

        if (!id) id = "text"

        let variable = ""
        if (key === "font-size") variable = "--"

        if (key === "rotate") {
            key = "transform"
            value = `rotate(${value});`
        }

        // previous transitions
        if (!animationData.transitions) animationData.transitions = {}
        animationData.transitions[id] = removePreviousKeys(animationData.transitions[id], key)
        animationData.transitions[id].push(`${key} ${duration}s`)

        // get style value
        const style = `${variable}${key}: ${value};`
        if (!animationData.styles) animationData.styles = {}
        animationData.styles[id] = removePreviousKeys(animationData.styles[id], key)

        // set easing
        const easing = animationData.animation?.easing || "" // ease
        // if (animationData.animation.easing) easing = `transition-timing-function: ${animationData.animation.easing};`

        // set transitions first so it can animate
        if (!animationData.style) animationData.style = {}
        const currentStyle = `${id === "text" ? "--" : ""}transition: ${animationData.transitions[id].join(", ")} ${easing};`
        animationData.style[id] = animationData.styles[id].join("") + initialValue + currentStyle

        await wait(40)

        if (!animationData.styles[id]) return

        animationData.styles[id].push(style)
        animationData.style[id] = animationData.styles[id].join("") + currentStyle
    }
}

function removePreviousKeys(array: string[] | undefined, key: string | undefined) {
    if (!array || !key) return []
    return array.filter((a) => !a.includes(key))
}

/*
function randomNumBetween(min = 0, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}*/

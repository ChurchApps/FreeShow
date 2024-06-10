import { activeAnimate } from "../../stores"
import { wait } from "../../utils/common"
import { clone } from "../helpers/array"

export async function updateAnimation(animationData: any, currentIndex: number, outSlide: any) {
    // give time for initial element & prevent infinite loops
    if (currentIndex === 0) await wait(50)

    let currentAnimation: any = clone(animationData.animation.actions[currentIndex])

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
    wait: async ({ duration }) => await wait(duration * 1000),
    set: ({ id, key, value, extension }, animationData) => {
        animations.change({ id, key, value, extension, duration: 0 }, animationData)
    },
    change: async ({ id, key, value, extension, duration }, animationData) => {
        value = value || 0
        if (extension) value += extension

        // values
        let initialValue = ""
        if (id === "background") {
            if (key === "filter") {
                // filter
            } else {
                key = "transform"
                initialValue = "transform: scale(1.3);"
                let randomNumber = Math.max(1, Math.random() * 1.3 + 0.6)
                let randomTranslate1 = randomNumBetween(0, 50)
                let randomTranslate2 = randomNumBetween(0, 50)
                value = `scale(${randomNumber}) translate(${randomTranslate1}px, ${randomTranslate2}px);`
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
        let style = `${variable}${key}: ${value};`
        if (!animationData.styles) animationData.styles = {}
        animationData.styles[id] = removePreviousKeys(animationData.styles[id], key)

        // set easing
        let easing = ""
        if (animationData.animation.easing) easing = `transition-timing-function: ${animationData.animation.easing};`

        // set transitions first so it can animate
        if (!animationData.style) animationData.style = {}
        let currentStyle = `${id === "text" ? "--" : ""}transition: ${animationData.transitions[id].join(", ")};${easing}`
        animationData.style[id] = animationData.styles[id].join("") + initialValue + currentStyle

        await wait(40)

        if (!animationData.styles[id]) return

        animationData.styles[id].push(style)
        animationData.style[id] = animationData.styles[id].join("") + currentStyle
    },
}

function removePreviousKeys(array: string[] | undefined, key: string) {
    if (!array) return []
    return array.filter((a) => !a.includes(key))
}

function randomNumBetween(min = 0, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

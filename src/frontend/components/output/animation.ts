import type { AnimationAction } from "../../../types/Output"
import type { AnimationData } from "../../../types/Show"
import { activeAnimate } from "../../stores"
import { wait } from "../../utils/common"
import { clone } from "../helpers/array"
import { getExtension, getMediaType } from "../helpers/media"

export async function updateAnimation(animationData: AnimationData, currentIndex: number, outSlide: any, background: any) {
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
    await animations[currentAnimation.type](currentAnimation, animationData, { background })

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
    change: async ({ id, key, value: actionValue, extension, duration }: AnimationAction, animationData: AnimationData, { background }: any = {}) => {
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
                const backgroundType = background.type || getMediaType(getExtension(background.id))
                const isVideo = backgroundType === "video"
                initialValue = isVideo ? "transform-origin: center;transform: scale(1);" : "transform: scale(1.3);"
                const randomScale = 1.1 + Math.random() * 0.4 // 1.1 to 1.5

                // Calculate safe translation bounds to keep image on screen
                // For scale S, safe range is from (50/S)% to (100-50/S)%
                const minPercent = 50 / randomScale
                const maxPercent = 100 - minPercent

                let randomX = minPercent + Math.random() * (maxPercent - minPercent)
                let randomY = minPercent + Math.random() * (maxPercent - minPercent)

                // center video
                if (isVideo) {
                    randomX = 0
                    randomY = 0
                }

                value = `translate(-${randomX}%, -${randomY}%) scale(${randomScale})`
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

// function randomNumBetween(min = 0, max) {
//     return Math.floor(Math.random() * (max - min + 1) + min)
// }

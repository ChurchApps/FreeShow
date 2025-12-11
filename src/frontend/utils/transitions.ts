import { blur, crossfade, fade, fly, scale } from "svelte/transition"
import type { TransitionType } from "./../../types/Show"
// import { quintInOut } from "svelte/easing"
import { backInOut, bounceInOut, circInOut, cubicInOut, elasticInOut, linear, sineInOut } from "svelte/easing"
import type { API_transition } from "../components/actions/api"
import { transitionData } from "../stores"

// https://stackoverflow.com/questions/70531875/svelte-crossfade-transition-between-pages
// export const crossfade = cfade({})
// export const [send, receive] = crossfade

export const transitionTypes: { id: TransitionType; name: string }[] = [
    { id: "none", name: "transition.none" },
    { id: "fade", name: "transition.fade" },
    // { id: "crossfade", name: "transition.crossfade" },
    { id: "blur", name: "transition.blur" },
    { id: "spin", name: "transition.spin" },
    { id: "scale", name: "transition.scale" },
    { id: "slide", name: "transition.slide" }
]

export const transitions: { [key in TransitionType]: any } = {
    none: (node, data) => fade(node, { ...data, duration: 0 }),
    blur,
    fade,
    crossfade,
    fly,
    scale,
    // slide,
    slide: (_node, customData: any) => {
        return {
            css: (t: number) => {
                const direction = customData.direction || "left_right"

                // go a bit faster, because transition will finish a bit before slide is done! (only in output...)
                // let pos = Math.min(1, (1 - t) * 1.1) * 100
                const pos = (1 - t) * 100

                if (direction === "left_right") return `transform: translate(-${pos}%);`
                if (direction === "right_left") return `transform: translate(${pos}%);`
                if (direction === "bottom_top") return `transform: translateY(${pos}%);`
                if (direction === "top_bottom") return `transform: translateY(-${pos}%);`

                return ""
            }
        }
    },
    spin: (node: any) => {
        const o = +getComputedStyle(node).opacity
        return {
            // easing: elasticInOut,
            // css: (t: any) => `transform: translateX(${t}%);`,
            // scale(${t})
            css: (t: any) => `opacity: ${t * o}; transform: rotate(${t * 360}deg);`
        }
    }
}

export const easings: any[] = [
    { value: "linear", label: "easings.linear", function: linear },
    { value: "back", label: "easings.back", function: backInOut },
    { value: "sine", label: "easings.sine", function: sineInOut },
    { value: "circ", label: "easings.circ", function: circInOut },
    { value: "cubic", label: "easings.cubic", function: cubicInOut },
    { value: "elastic", label: "easings.elastic", function: elasticInOut },
    { value: "bounce", label: "easings.bounce", function: bounceInOut }
    // { value: "expo", label: "easings.expo", function: expoInOut },
    // { value: "quad", label: "easings.quad", function: quadInOut },
    // { value: "quart", label: "easings.quart", function: quartInOut },
    // { value: "quint", label: "easings.quint", function: quintInOut },
]

// : Transition
export function custom(node: any, { type = "fade", duration = 500, easing = "sine", delay = 0, custom: customData = {} }: any) {
    const customTransition = { ...transitions[type as TransitionType](node, customData), duration: type === "none" ? 0 : duration, easing: easings.find((a) => a.value === easing)?.function || linear, delay }
    // if (type === "crossfade") customTransition.key = "a"
    return customTransition
}

export function updateTransition(data: API_transition) {
    transitionData.update((a) => {
        a[data.id || "text"] = {
            type: data.type || "fade",
            duration: data.duration ?? 500,
            easing: data.easing || "sine"
        }

        return a
    })
}

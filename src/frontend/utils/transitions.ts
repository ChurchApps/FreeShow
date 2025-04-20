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
    { id: "none", name: "$:transition.none:$" },
    { id: "fade", name: "$:transition.fade:$" },
    // { id: "crossfade", name: "$:transition.crossfade:$" },
    { id: "blur", name: "$:transition.blur:$" },
    { id: "spin", name: "$:transition.spin:$" },
    { id: "scale", name: "$:transition.scale:$" },
    { id: "slide", name: "$:transition.slide:$" },
]

export const transitions: { [key in TransitionType]: any } = {
    none: () => { },
    blur,
    fade,
    crossfade,
    fly,
    scale,
    // slide,
    slide: (_node: any, custom: any) => {
        return {
            css: (t: number) => {
                let direction = custom.direction || "left_right"

                // go a bit faster, because transition will finish a bit before slide is done! (only in output...)
                // let pos = Math.min(1, (1 - t) * 1.1) * 100
                let pos = (1 - t) * 100

                if (direction === "left_right") return `transform: translate(-${pos}%);`
                if (direction === "right_left") return `transform: translate(${pos}%);`
                if (direction === "bottom_top") return `transform: translateY(${pos}%);`
                if (direction === "top_bottom") return `transform: translateY(-${pos}%);`

                return ""
            },
        }
    },
    spin: (node: any) => {
        const o = +getComputedStyle(node).opacity
        return {
            // easing: elasticInOut,
            // css: (t: any) => `transform: translateX(${t}%);`,
            // scale(${t})
            css: (t: any) => `opacity: ${t * o}; transform: rotate(${t * 360}deg);`,
        }
    },
}

export const easings: any[] = [
    { id: "linear", name: "$:easings.linear:$", data: linear },
    { id: "back", name: "$:easings.back:$", data: backInOut },
    { id: "sine", name: "$:easings.sine:$", data: sineInOut },
    { id: "circ", name: "$:easings.circ:$", data: circInOut },
    { id: "cubic", name: "$:easings.cubic:$", data: cubicInOut },
    { id: "elastic", name: "$:easings.elastic:$", data: elasticInOut },
    { id: "bounce", name: "$:easings.bounce:$", data: bounceInOut },
    // { id: "expo", name: "$:easings.expo:$", data: expoInOut },
    // { id: "quad", name: "$:easings.quad:$", data: quadInOut },
    // { id: "quart", name: "$:easings.quart:$", data: quartInOut },
    // { id: "quint", name: "$:easings.quint:$", data: quintInOut },
]

// : Transition
export function custom(node: any, { type = "fade", duration = 500, easing = "sine", delay = 0, custom = {} }: any) {
    let customTransition = { ...transitions[type as TransitionType](node, custom), duration: type === "none" ? 0 : duration, easing: easings.find((a) => a.id === easing)?.data || linear, delay }
    // if (type === "crossfade") customTransition.key = "a"
    return customTransition
}

export function updateTransition(data: API_transition) {
    transitionData.update((a) => {
        a[data.id || "text"] = {
            type: data.type || "fade",
            duration: data.duration ?? 500,
            easing: data.easing || "sine",
        }

        return a
    })
}

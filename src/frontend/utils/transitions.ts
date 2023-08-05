import { blur, fade, crossfade, fly, scale, slide } from "svelte/transition"
import type { TransitionType } from "./../../types/Show"
// import { quintInOut } from "svelte/easing"
import { backInOut, bounceInOut, circInOut, cubicInOut, elasticInOut, linear, sineInOut } from "svelte/easing"

// https://stackoverflow.com/questions/70531875/svelte-crossfade-transition-between-pages
// export const crossfade = cfade({})
// export const [send, receive] = crossfade

export const transitions: { [key in TransitionType]: any } = {
    none: () => {},
    blur,
    fade,
    crossfade,
    fly,
    scale,
    slide,
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

export function custom(node: any, { type = "fade", duration = 500, easing = "sine" }: any) {
    let customTransition = { ...transitions[type as TransitionType](node), duration: type === "none" ? 0 : duration, easing: easings.find((a) => a.id === easing).data || linear }
    // if (type === "crossfade") customTransition.key = "a"
    return customTransition
}

import type { TransitionType } from "./../../types/Show"
import { blur, fade, scale, slide, fly } from "svelte/transition"
// import { quintInOut } from "svelte/easing"
import { elasticInOut } from "svelte/easing"

export const transitions: { [key in TransitionType]: any } = {
  none: () => {},
  blur,
  fade,
  fly,
  scale,
  slide,
  spin: (node: any) => {
    const o = +getComputedStyle(node).opacity
    return {
      easing: elasticInOut,
      // css: (t: any) => `transform: translateX(${t}%);`,
      // scale(${t})
      css: (t: any) => `opacity: ${t * o}; transform: rotate(${t * 360}deg);`,
    }
  },
}

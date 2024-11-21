/** Selects the text inside a text node when the node is focused */
export function selectTextOnFocus(node: any) {
    const handleFocus = () => {
        node && typeof node.select === "function" && node.select()
    }

    node.addEventListener("focus", handleFocus)

    return {
        destroy() {
            node.removeEventListener("focus", handleFocus)
        },
    }
}

/** Blurs the node when Escape is pressed */
export function blurOnEscape(node: any) {
    const handleKey = (event: any) => {
        if (event.key === "Escape" && node && typeof node.blur === "function") node.blur()
    }

    node.addEventListener("keydown", handleKey)

    return {
        destroy() {
            node.removeEventListener("keydown", handleKey)
        },
    }
}

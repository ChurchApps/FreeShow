export function triggerClickOnEnterSpace(event: KeyboardEvent) {
    if (event.target?.classList.contains("edit") || (event.target as any)?.nodeName === "INPUT" || (event.target as any)?.nodeName === "TEXTAREA") return

    if (event.key === "Enter" || event.key === " ") {
        if (event.key === " " && event.target?.closest(".slide")) return

        event.preventDefault()
        event.stopPropagation()
            ; (event.currentTarget as HTMLElement).click()
    }
}

export function createKeydownHandler(callback: (event: KeyboardEvent) => void) {
    return (event: KeyboardEvent) => {
        if (event.target?.classList.contains("edit") || (event.target as any)?.nodeName === "INPUT" || (event.target as any)?.nodeName === "TEXTAREA") return

        if (event.key === "Enter" || event.key === " ") {
            if (event.key === " " && event.target?.closest(".slide")) return

            event.preventDefault()
            event.stopPropagation()
            callback(event)
        }
    }
}

export function clickable(node: HTMLElement) {
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            event.stopPropagation()
            node.click()
        }
    }

    node.addEventListener("keydown", handleKeydown)

    return {
        destroy() {
            node.removeEventListener("keydown", handleKeydown)
        }
    }
}

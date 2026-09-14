export function startResizing(cursor: string) {
    if (typeof document === "undefined" || !document.body) return
    document.body.style.setProperty("--resizing-cursor", cursor)
    document.body.setAttribute("data-resizing", "true")
}

export function stopResizing() {
    if (typeof document === "undefined" || !document.body) return
    document.body.removeAttribute("data-resizing")
    document.body.style.removeProperty("--resizing-cursor")
}

if (typeof window !== "undefined") {
    window.addEventListener("blur", () => {
        stopResizing()
    })
}

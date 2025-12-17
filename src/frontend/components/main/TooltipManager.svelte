<script lang="ts">
    import { onMount } from "svelte"
    import Tooltip from "./Tooltip.svelte"
    import { os } from "../../stores"

    let visible = false
    let tooltipX = 0
    let tooltipY = 0
    let tooltipStyle = ""
    let parsed: { text: string; isShortcut: boolean }[] = []

    let timeout: ReturnType<typeof setTimeout> | null = null
    let autoHideTimeout: ReturnType<typeof setTimeout> | null = null

    const tooltipDelay = 700
    const autoHideDelay = 8000

    function extractShortcuts(input: string) {
        if (typeof input !== "string") return []
        const match = input.match(/^(.+?)\s*(?:\[(.*?)\])?$/)
        if (!match) return [{ text: input, isShortcut: false }]

        const result = [{ text: match[1], isShortcut: false }]
        if (match[2]) {
            const ctrl = $os.platform === "darwin" ? "Cmd" : "Ctrl"
            const shortcut = match[2].replace("Ctrl", ctrl).replaceAll("+", " + ")
            result.push({ text: `\n${shortcut}`, isShortcut: true })
        }
        return result
    }

    function showTooltip(target: HTMLElement, e: MouseEvent) {
        const title = target.getAttribute("data-title")
        if (!title) return

        const MAX_WIDTH = 250
        const TOOLTIP_HEIGHT = 80 // 40 // approximate height
        const OFFSET = 12

        let x = e.clientX
        let y = e.clientY

        // Determine if flipping is needed
        const flipX = x + MAX_WIDTH > window.innerWidth
        const flipY = y + TOOLTIP_HEIGHT > window.innerHeight

        // Clamp X
        if (flipX) {
            // When flipped, x is the right edge of the tooltip,
            // so minimum x is tooltip width + margin from left viewport edge
            x = Math.max(x, MAX_WIDTH)
            x = Math.min(x, window.innerWidth)

            // add offset to not show behind mouse
            x -= OFFSET * 0.7
        } else {
            // Normal: x is left edge of tooltip
            x = Math.min(Math.max(x, 0), window.innerWidth - MAX_WIDTH)

            // add offset to not show behind mouse
            x += OFFSET
        }

        // Clamp Y
        if (flipY) {
            // When flipped vertically, y is bottom edge of tooltip,
            // so minimum y is tooltip height + margin
            y = Math.max(y, TOOLTIP_HEIGHT)
            y = Math.min(y, window.innerHeight)
        } else {
            // Normal: y is top edge of tooltip
            y = Math.min(Math.max(y, 0), window.innerHeight - TOOLTIP_HEIGHT)
        }

        tooltipX = x
        tooltipY = y

        if (!visible && !timeout) {
            timeout = setTimeout(() => {
                parsed = extractShortcuts(title)

                tooltipStyle = ""

                if (flipX) {
                    tooltipStyle += `transform: translate(-100%, ${flipY ? "-100%" : "0"});`
                    tooltipStyle += title.length > 35 ? `width: ${MAX_WIDTH}px;` : "white-space: nowrap;"
                } else if (flipY) {
                    tooltipStyle += "transform: translateY(-100%);"
                } else {
                    tooltipStyle += "transform: none;"
                }

                visible = true
                timeout = null

                autoHideTimeout = setTimeout(() => {
                    if (!timeout) visible = false
                    autoHideTimeout = null
                }, autoHideDelay)
            }, tooltipDelay)
        }
    }

    function hideTooltip() {
        visible = false
        if (timeout) clearTimeout(timeout)
        timeout = null
        if (autoHideTimeout) clearTimeout(autoHideTimeout)
        autoHideTimeout = null
    }

    let currentTarget: HTMLElement | null = null
    function handleMouseMove(e: MouseEvent) {
        let target = e.target?.closest("[data-title]") as HTMLElement
        // check parent for content if empty
        if (!target?.getAttribute("data-title")?.length) target = target?.parentElement?.closest("[data-title]") as HTMLElement

        if (!target) {
            hideTooltip()
            currentTarget = null
            return
        }

        if (currentTarget !== target) {
            if (timeout) clearTimeout(timeout)
            timeout = null
            currentTarget = target
        }

        showTooltip(target, e)
    }

    function handleMouseOut(e: MouseEvent) {
        if (!currentTarget) return

        // If the new hovered element is still inside the same tooltip target, do nothing
        const related = e.relatedTarget as Node | null
        if (related && currentTarget.contains(related)) return

        // Truly exited
        hideTooltip()
        currentTarget = null
    }

    onMount(() => {
        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mousedown", hideTooltip)
        window.addEventListener("mouseout", handleMouseOut)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mousedown", hideTooltip)
            window.removeEventListener("mouseout", handleMouseOut)
        }
    })
</script>

<Tooltip {parsed} x={tooltipX} y={tooltipY} {visible} style={tooltipStyle} />

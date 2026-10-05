import { send } from "../../../utils/request"
import { OUTPUT } from "../../../../types/Channels"
import { websiteAction } from "../../../stores"

type AttachedSlot = {
    webview: any
    src: string
    currentParent: HTMLElement | null
    lastUsed: number
    actionUnsubscribe?: () => void
}

const MAX_CACHED_WEBVIEWS = 3
const webviewPool = new Map<string, AttachedSlot>()

let hiddenContainer: HTMLElement | null = null
function getHiddenContainer(): HTMLElement {
    if (!hiddenContainer) {
        hiddenContainer = document.createElement("div")
        hiddenContainer.id = "hidden-website-pool"
        hiddenContainer.style.cssText = "position:fixed;top:-99999px;left:-99999px;width:100px;height:100px;visibility:hidden;pointer-events:none;z-index:-9999;"
        document.body.appendChild(hiddenContainer)
    }
    return hiddenContainer
}

export function cleanupOldWebviews() {
    const unattached = [...webviewPool.values()].filter((slot) => !slot.currentParent || slot.currentParent === hiddenContainer)
    if (unattached.length > MAX_CACHED_WEBVIEWS) {
        unattached.sort((a, b) => a.lastUsed - b.lastUsed)
        for (const slot of unattached.slice(0, unattached.length - MAX_CACHED_WEBVIEWS)) {
            slot.actionUnsubscribe?.()
            slot.webview.remove?.()
            webviewPool.delete(slot.src)
        }
    }
}

export function attachPersistentWebview(
    targetNode: HTMLElement,
    options: {
        src: string
        zoom?: number
        isOutput?: boolean
        outputId?: string
        onReady?: (webview: any) => void
        onNavigate?: (url: string) => void
    }
) {
    let currentSrc = options.src
    if (!currentSrc) return

    let slot = webviewPool.get(currentSrc)

    if (!slot) {
        const webview = document.createElement("webview") as any
        webview.src = currentSrc
        webview.style.cssText = "width:100%;height:100%;display:block;"

        const actionUnsubscribe = websiteAction.subscribe((action) => {
            if (!action || (action.src && action.src !== currentSrc)) return

            try {
                if (action.type === "key") {
                    webview.sendInputEvent?.({ type: "keyDown", keyCode: action.keyCode })
                    webview.sendInputEvent?.({ type: "keyUp", keyCode: action.keyCode })
                } else if (action.type === "reload") {
                    webview.reload?.()
                }
            } catch (err) {
                console.debug("Website action failed:", err)
            }
        })

        slot = {
            webview,
            src: currentSrc,
            currentParent: null,
            lastUsed: Date.now(),
            actionUnsubscribe
        }

        webview.addEventListener("dom-ready", () => {
            applyWebviewStyle(webview, options.zoom, options.isOutput, currentSrc)
            options.onReady?.(webview)

            if (options.isOutput && options.outputId) {
                send(OUTPUT, ["FOCUS"], { id: options.outputId })
                setTimeout(() => {
                    try {
                        webview.focus?.()
                    } catch (err) {
                        console.debug("Webview focus failed:", err)
                    }
                })
            }
        })

        webview.addEventListener("did-navigate", () => {
            try {
                options.onNavigate?.(webview.getURL?.() || currentSrc)
            } catch (e) {
                console.debug(e)
            }
        })

        webviewPool.set(currentSrc, slot)
    }

    slot.lastUsed = Date.now()
    slot.currentParent = targetNode
    targetNode.appendChild(slot.webview)
    applyWebviewStyle(slot.webview, options.zoom, options.isOutput, currentSrc)
    options.onReady?.(slot.webview)

    return {
        update(newOptions: typeof options) {
            if (newOptions.src !== currentSrc) {
                detach()
                currentSrc = newOptions.src
                attachPersistentWebview(targetNode, newOptions)
            } else {
                applyWebviewStyle(slot!.webview, newOptions.zoom, newOptions.isOutput, currentSrc)
            }
        },
        destroy() {
            detach()
        }
    }

    function detach() {
        if (slot && slot.webview.parentNode === targetNode) {
            slot.currentParent = getHiddenContainer()
            getHiddenContainer().appendChild(slot.webview)
            if (options.isOutput) {
                try {
                    slot.webview.setAudioMuted?.(true)
                } catch (e) {
                    console.debug(e)
                }
            }
            cleanupOldWebviews()
        }
    }
}

function applyWebviewStyle(webview: any, zoom = 100, isOutput = false, src = "") {
    if (!webview) return
    try {
        webview.setAudioMuted?.(!isOutput)

        const factor = (parseFloat(zoom?.toString() || "100") || 100) / 100
        webview.setZoomFactor?.(factor)

        const iframe = webview.shadowRoot?.querySelector("iframe")
        if (iframe) {
            iframe.style.height = "100%"
            iframe.style.flex = "1 1 auto"
        }

        if (src.includes("embed")) return

        webview
            .executeJavaScript?.(
                `
            if (document.documentElement) {
                document.documentElement.style.zoom = '${factor}';
                document.documentElement.style.width = '100%';
                document.documentElement.style.height = '100%';
            }
            if (document.body) {
                document.body.style.transformOrigin = '0 0';
                document.body.style.width = '100%';
                document.body.style.height = '100%';
            }
        `
            )
            .catch((err: any) => console.debug("Webview executeJavaScript failed:", err))
    } catch (err) {
        console.debug("Failed applying webview style:", err)
    }
}

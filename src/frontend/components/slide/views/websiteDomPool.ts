import { send } from "../../../utils/request"
import { OUTPUT } from "../../../../types/Channels"
import { websiteAction } from "../../../stores"

export type PersistentWebviewOptions = {
    src: string
    zoom?: number
    isOutput?: boolean
    outputId?: string
    onReady?: (webview: any, controller: WebviewController) => void
    onNavigate?: (url: string) => void
}

type AttachedSlot = {
    webview: any
    src: string
    currentParent: HTMLElement | null
    lastUsed: number
    actionUnsubscribe?: () => void
    history: string[]
    historyIndex: number
    isNavigating?: boolean
    isDomReady?: boolean
    isMuted?: boolean
    options?: PersistentWebviewOptions
}

const MAX_CACHED_WEBVIEWS = 3
const webviewPool = new Set<AttachedSlot>()

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
            webviewPool.delete(slot)
        }
    }
}

export type WebviewController = {
    canGoBack: () => boolean
    canGoForward: () => boolean
    goBack: () => void
    goForward: () => void
    getCurrentUrl: () => string
}

export function attachPersistentWebview(
    targetNode: HTMLElement,
    options: PersistentWebviewOptions
) {
    let currentSrc = options.src
    if (!currentSrc) return

    // only reuse a webview not shown by another mount (moving it would blank the other one)
    let slot: AttachedSlot | undefined = [...webviewPool].find((s) => s.src === currentSrc && (!s.currentParent || s.currentParent === hiddenContainer))

    if (!slot) {
        const webview = document.createElement("webview") as any
        webview.src = currentSrc
        webview.style.cssText = "width:100%;height:100%;display:block;"

        slot = {
            webview,
            src: currentSrc,
            currentParent: null,
            lastUsed: Date.now(),
            history: [currentSrc],
            historyIndex: 0
        }

        const actionUnsubscribe = websiteAction.subscribe((action) => {
            if (!action || (action.src && action.src !== currentSrc)) return

            try {
                if (action.type === "key") {
                    webview.sendInputEvent?.({ type: "keyDown", keyCode: action.keyCode })
                    webview.sendInputEvent?.({ type: "keyUp", keyCode: action.keyCode })
                } else if (action.type === "reload") {
                    // revert to initial URL when reloading
                    if (slot) {
                        slot.history = [currentSrc]
                        slot.historyIndex = 0
                    }
                    if (webview.loadURL) {
                        webview.loadURL(currentSrc).catch((err: any) => {
                            console.debug("Webview loadURL failed/aborted:", err)
                        })
                    } else {
                        webview.reload?.()
                    }
                } else if (action.type === "mute") {
                    if (slot) slot.isMuted = action.muted
                    webview.setAudioMuted?.(!options.isOutput || action.muted)
                }
            } catch (err) {
                console.debug("Website action failed:", err)
            }
        })
        slot.actionUnsubscribe = actionUnsubscribe

        webview.addEventListener("dom-ready", () => {
            slot!.isDomReady = true
            applyWebviewStyle(webview, options.zoom, options.isOutput, currentSrc, true, slot!.isMuted)
            slot!.options?.onReady?.(webview, controller)

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

        const handleNavigation = (newUrl: string) => {
            if (!newUrl || newUrl === "about:blank") return

            const current = slot!.history[slot!.historyIndex]
            const isMatch = (a?: string, b?: string) => a === b || a?.replace(/\/+$/, "") === b?.replace(/\/+$/, "")

            if (slot!.isNavigating) {
                if (isMatch(current, newUrl)) {
                    slot!.isNavigating = false
                }
            } else if (!isMatch(current, newUrl)) {
                slot!.history = slot!.history.slice(0, slot!.historyIndex + 1)
                slot!.history.push(newUrl)
                slot!.historyIndex = slot!.history.length - 1
            }

            try {
                slot!.options?.onNavigate?.(newUrl)
            } catch (e) {
                console.debug(e)
            }
        }

        webview.addEventListener("did-navigate", (e: any) => {
            handleNavigation(e?.url || webview.getURL?.() || currentSrc)
        })

        webview.addEventListener("did-navigate-in-page", (e: any) => {
            handleNavigation(e?.url || webview.getURL?.() || currentSrc)
        })

        webviewPool.add(slot)
    }

    slot.options = options

    function navigateHistory(delta: number) {
        const newIndex = slot!.historyIndex + delta
        if (newIndex < 0 || newIndex >= slot!.history.length) return

        slot!.historyIndex = newIndex
        slot!.isNavigating = true

        const nativeNav = delta < 0 ? slot!.webview?.goBack : slot!.webview?.goForward
        const canNative = delta < 0 ? slot!.webview?.canGoBack?.() : slot!.webview?.canGoForward?.()

        if (canNative && nativeNav) {
            try {
                nativeNav.call(slot!.webview)
                return
            } catch (e) {
                console.debug("Native navigation failed, falling back to loadURL:", e)
            }
        }

        const targetUrl = slot!.history[newIndex]
        slot!.webview?.loadURL?.(targetUrl).catch((err: any) => {
            console.debug("Webview loadURL failed:", err)
        })
    }

    const controller: WebviewController = {
        getCurrentUrl() {
            return slot!.history[slot!.historyIndex] || slot!.webview?.getURL?.() || currentSrc
        },
        canGoBack() {
            return slot!.historyIndex > 0
        },
        canGoForward() {
            return slot!.historyIndex < slot!.history.length - 1
        },
        goBack() {
            navigateHistory(-1)
        },
        goForward() {
            navigateHistory(1)
        }
    }

    slot.lastUsed = Date.now()
    slot.currentParent = targetNode
    targetNode.appendChild(slot.webview)
    if (slot.isDomReady) {
        applyWebviewStyle(slot.webview, options.zoom, options.isOutput, currentSrc, true, slot.isMuted)
    }
    // Always notify the mounting component of the webview and controller
    options.onReady?.(slot.webview, controller)

    let inner: { update: (o: typeof options) => void; destroy: () => void } | undefined | void

    return {
        update(newOptions: typeof options) {
            if (inner) return inner.update(newOptions)
            slot!.options = newOptions
            if (newOptions.src !== currentSrc) {
                detach()
                inner = attachPersistentWebview(targetNode, newOptions)
            } else {
                applyWebviewStyle(slot!.webview, newOptions.zoom, newOptions.isOutput, currentSrc, slot!.isDomReady, slot!.isMuted)
            }
        },
        destroy() {
            if (inner) inner.destroy()
            else detach()
        }
    }

    function detach() {
        if (slot && slot.webview.parentNode === targetNode) {
            if (slot.options === options) {
                slot.options = undefined
            }
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

function applyWebviewStyle(webview: any, zoom = 100, isOutput = false, src = "", isDomReady = false, isMuted = false) {
    if (!webview) return
    try {
        webview.setAudioMuted?.(!isOutput || isMuted)

        const factor = (parseFloat(zoom?.toString() || "100") || 100) / 100
        webview.setZoomFactor?.(factor)

        const iframe = webview.shadowRoot?.querySelector("iframe")
        if (iframe) {
            iframe.style.height = "100%"
            iframe.style.flex = "1 1 auto"
        }

        if (src.includes("embed") || !isDomReady) return

        try {
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
                ?.catch?.((err: any) => console.debug("Webview executeJavaScript failed:", err))
        } catch (e) {
            console.debug("Webview executeJavaScript error:", e)
        }
    } catch (err) {
        console.debug("Failed applying webview style:", err)
    }
}

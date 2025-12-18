import { os, version, deviceId, isDev, activePage, activeDrawerTab } from "../stores"
import { get } from "svelte/store"

declare global {
    interface Window {
        dataLayer: any[]
        gtag: (...args: any[]) => void
    }
}

const MEASUREMENT_ID = "G-CEE6P1QXG6"
let gtagInitialized = false

function initGtag() {
    if (gtagInitialized || get(isDev)) return

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
        window.dataLayer.push(arguments)
    }
    window.gtag("js", new Date())
    window.gtag("config", MEASUREMENT_ID, {
        client_id: get(deviceId),
        send_page_view: false
    })

    // Load gtag.js script
    const script = document.createElement("script")
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    document.head.appendChild(script)

    gtagInitialized = true
}

export function trackEvent(eventName: string, params?: any) {
    if (get(isDev)) return

    initGtag()
    window.gtag("event", eventName, params || {})
}

export function startTracking() {
    trackAppLaunch()

    // listeners
    activePage.subscribe(trackPageView)
    activeDrawerTab.subscribe(trackDrawerView)
}

function trackAppLaunch() {
    trackEvent("application_start", { app_version: get(version), platform: get(os).platform })
}

function trackPageView(title: string) {
    trackEvent("page_view", { page_location: "https://freeshow.app/_app/" + title, page_title: title, engagement_time_msec: 1 })
}

function trackDrawerView(title: string) {
    trackEvent("drawer_view", { drawer_location: "https://freeshow.app/_app/" + title, drawer_title: title, engagement_time_msec: 1 })
}

const previouslyTracked: { [key: string]: string } = {}
export function trackScriptureUsage(translationName: string, apiId: string | null, verseRef: string) {
    if (previouslyTracked[translationName] === verseRef) return
    previouslyTracked[translationName] = verseRef

    trackEvent("scripture_usage", { translation_name: translationName, api_id: apiId, verse_ref: verseRef })
}

import { os, version, deviceId, isDev, activePage, activeDrawerTab } from "../stores"
import { get } from "svelte/store"

const MEASUREMENT_ID = "G-CEE6P1QXG6"
const API_SECRET = atob("YlVwZE42bXpRVjYyWDc2d0Z3OGMwZw==")
const SESSION_ID = Date.now().toString()

function trackEvent(eventName: string, params?: Record<string, any>) {
    if (get(isDev)) return

    const clientId = get(deviceId)
    if (!clientId) return

    const eventParams = {
        session_id: SESSION_ID,
        app_version: get(version),
        engagement_time_msec: 1,
        ...params
    }

    const payload = {
        client_id: clientId,
        events: [{ name: eventName, params: eventParams }]
    }

    fetch(`https://www.google-analytics.com/mp/collect?api_secret=${API_SECRET}&measurement_id=${MEASUREMENT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
}

export function startTracking() {
    trackFirstOpenIfNeeded()
    trackEvent("session_start")
    trackAppLaunch()

    // listeners
    activePage.subscribe(trackPageView)
    activeDrawerTab.subscribe(trackDrawerView)
}

function trackFirstOpenIfNeeded() {
    const key = "freeshow_first_open_sent"
    if (!localStorage.getItem(key)) {
        trackEvent("first_open")
        localStorage.setItem(key, "1")
    }
}

function trackAppLaunch() {
    trackEvent("application_start", { platform: get(os).platform })
}

function trackPageView(title: string) {
    trackEvent("page_view", { page_location: "https://freeshow.app/_app/" + title, page_title: title })
}

function trackDrawerView(title: string) {
    trackEvent("drawer_view", { drawer_location: "https://freeshow.app/_app/" + title, drawer_title: title })
}

const previouslyTracked: { [key: string]: string } = {}
export function trackScriptureUsage(translationName: string, apiId: string | null, verseRef: string) {
    if (previouslyTracked[translationName] === verseRef) return
    previouslyTracked[translationName] = verseRef

    trackEvent("scripture_usage", { translation_name: translationName, api_id: apiId, verse_ref: verseRef })
}

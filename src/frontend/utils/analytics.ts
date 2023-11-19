import { os, version, deviceId } from "../stores"
import { get } from "svelte/store"

export async function trackEvent(eventName: string, params?:any) {
  const sec = atob("YlVwZE42bXpRVjYyWDc2d0Z3OGMwZw==");
  const measurementId = "G-CEE6P1QXG6";
  const url = `https://www.google-analytics.com/mp/collect?api_secret=${sec}&measurement_id=${measurementId}`;
  let clientId = get(deviceId)

  const payload = {
    client_id: clientId,
    events: [ { name: eventName, params: params || {}, } ],
  };

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function trackPageView(title:string) {
  //console.log("PAGE VIEW", title);
  trackEvent("page_view", { page_location: "https://freeshow.app/_app/" + title, page_title: title, engagement_time_msec: 1 });
}

export function trackAppLaunch()
{
  trackEvent("application_start", { app_version: get(version), platform: get(os).platform });
}

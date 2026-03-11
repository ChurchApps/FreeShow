export function hasRouteBibleReference(referenceLabel: string) {
    return typeof referenceLabel === "string" && referenceLabel.trim().length > 0
}

export function buildRouteBibleUrl(referenceLabel: string, translation = "") {
    const url = new URL("https://route.bible/")
    url.searchParams.set("q", referenceLabel.trim())
    url.searchParams.set("utm_source", "freeshow")
    url.searchParams.set("utm_medium", "link")

    if (translation.trim()) {
        url.searchParams.set("v", translation.trim())
    }

    return url.toString()
}

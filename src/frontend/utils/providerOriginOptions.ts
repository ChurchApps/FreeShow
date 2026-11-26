// how songs from a content provider are matched with local shows
export function getProviderOriginOptions(withPlaceholderMode: boolean) {
    return [
        { value: "", label: "Ask when existing show is found", data: "Ask to use online or local, if existing both places, first time" },
        { value: "local", label: "Prioritize local instance", data: "Use local if existing, download if not" },
        // currently for Planning Center only
        ...(withPlaceholderMode ? [{ value: "placeholder", label: "Always use local instance", data: "Creates placeholders for unmatched shows" }] : []),
        { value: "online", label: "Always use online instance", data: "Online instance will always be used" }
    ]
}

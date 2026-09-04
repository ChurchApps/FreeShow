export const scriptureState = {
    sessionActive: false,
    // the searched local translations in priority order - session bibles / quote verification / spoken cycling all read it
    searchBibleIds: [] as string[],
    lastQuoteMatchAnchor: null as { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null
}

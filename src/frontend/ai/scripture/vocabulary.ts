// SCRIPTURE ASR VOCABULARY
// mishearings of scripture-specific words - consumed by the reference regexes (detection)
// and the voice-command matchers

// whisper regularly mishears the word "verse" itself ("verse five" arrives as "best five" or
// "this five") - accepted wherever a verse word is expected, which is safe because every use
// site also requires the surrounding shape (book+chapter here, an imperative in commands)
export const VERSE_WORD_MISHEARINGS = ["best", "this", "vers", "versus", "worse"]
export const VERSE_WORD = "(?:verses?|" + VERSE_WORD_MISHEARINGS.join("|") + ")"

export const whisperModels = [
    { value: "tiny", label: "Tiny", data: `${formatFileSize(75)} | Fastest` },
    { value: "base", label: "Base", data: `${formatFileSize(142)} | Recommended` },
    { value: "small", label: "Small", data: `${formatFileSize(466)} | More accurate, best for Bible names` },
    { value: "medium", label: "Medium", data: `${formatFileSize(1500)} | Slow` },
    { value: "large-v3", label: "Large v3", data: `${formatFileSize(3100)} | Most accurate, slowest` }
]
function formatFileSize(sizeMb: number) {
    if (sizeMb < 1024) return `${sizeMb} MB`
    if (sizeMb < 1024 * 1024) return `${(sizeMb / 1024).toFixed(2)} GB`
    return `${(sizeMb / (1024 * 1024)).toFixed(2)} TB`
}

export const customLanguageModels = {
    en: ["tiny", "base", "small", "medium"]
}

// curated list of languages whisper transcribes well, alphabetical by English name
export const WHISPER_LANGUAGES = [
    { code: "am", name: "Amharic" },
    { code: "ar", name: "Arabic" },
    { code: "bg", name: "Bulgarian" },
    { code: "zh", name: "Chinese" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hu", name: "Hungarian" },
    { code: "is", name: "Icelandic" },
    { code: "id", name: "Indonesian" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ms", name: "Malay" },
    { code: "no", name: "Norwegian" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sr", name: "Serbian" },
    { code: "sk", name: "Slovak" },
    { code: "es", name: "Spanish" },
    { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" },
    { code: "tl", name: "Tagalog" },
    { code: "ta", name: "Tamil" },
    { code: "th", name: "Thai" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "vi", name: "Vietnamese" },
    { code: "yo", name: "Yoruba" },
    { code: "zu", name: "Zulu" }
]

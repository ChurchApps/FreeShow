import { writable, get } from "svelte/store"
import { getItemText } from "../helpers/textStyle"
import { getLayoutRef } from "../helpers/show"
import { output, showsCache } from "./stores"

export const ttsVoice = writable<SpeechSynthesisVoice | null>(null)

export function getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis?.getVoices() || []
}

export function getCurrentSlideText(): string {
    const currentSlide = get(output)?.out?.slide
    if (!currentSlide) return ""

    const slideIndex = currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index : null
    if (slideIndex === null) return ""

    const showRef = getLayoutRef(currentSlide.id, currentSlide.layout)
    const slideId = showRef[slideIndex]?.id
    if (!slideId) return ""

    const slide = get(showsCache)[currentSlide.id]?.slides?.[slideId]
    if (!slide) return ""

    const textItem = (slide.items || []).find((item: any) => (item.type || "text") === "text")
    return textItem ? getItemText(textItem) : ""
}

export function speakText(text: string) {
    if (!text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = get(ttsVoice)
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
}

export function stopSpeech() {
    window.speechSynthesis?.cancel()
}

const TEST_SENTENCES: Record<string, string> = {
    ar: "هذا اختبار للصوت المحدد.",
    cs: "Toto je test vybraného hlasu.",
    da: "Dette er en test af den valgte stemme.",
    de: "Dies ist ein Test der ausgewählten Stimme.",
    el: "Αυτή είναι μια δοκιμή της επιλεγμένης φωνής.",
    en: "This is a test of the selected voice.",
    es: "Esta es una prueba de la voz seleccionada.",
    fi: "Tämä on testi valitulle äänelle.",
    fr: "Ceci est un test de la voix sélectionnée.",
    he: "זהו בדיקה של הקול הנבחר.",
    hi: "यह चयनित आवाज़ का परीक्षण है।",
    hu: "Ez a kiválasztott hang tesztje.",
    id: "Ini adalah tes suara yang dipilih.",
    it: "Questo è un test della voce selezionata.",
    ja: "これは選択した音声のテストです。",
    ko: "이것은 선택한 음성의 테스트입니다.",
    nl: "Dit is een test van de geselecteerde stem.",
    no: "Dette er en test av den valgte stemmen.",
    nb: "Dette er en test av den valgte stemmen.",
    pl: "To jest test wybranego głosu.",
    pt: "Este é um teste da voz selecionada.",
    ro: "Acesta este un test al vocii selectate.",
    ru: "Это тест выбранного голоса.",
    sk: "Toto je test vybraného hlasu.",
    sv: "Det här är ett test av den valda rösten.",
    th: "นี่คือการทดสอบเสียงที่เลือก",
    tr: "Bu seçilen sesin bir testidir.",
    uk: "Це тест вибраного голосу.",
    vi: "Đây là bài kiểm tra giọng nói đã chọn.",
    zh: "这是所选语音的测试。"
}

export function getTestSentence(lang: string): string {
    const base = lang.split("-")[0]
    return TEST_SENTENCES[base] || TEST_SENTENCES.en
}

export function previewVoice(voice: SpeechSynthesisVoice) {
    const text = getTestSentence(voice.lang)
    stopSpeech()
    if (!window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    window.speechSynthesis.speak(utterance)
}

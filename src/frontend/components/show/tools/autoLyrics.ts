import { get, type Unsubscriber } from "svelte/store"
import type { AutoLyrics, LearnedSection, RecordedSample } from "../../../../types/Show"
import { activeAutoLyrics, outputs } from "../../../stores"
import { getSlideText } from "../../edit/scripts/textStyle"
import { getActiveOutputs, setOutput } from "../../helpers/output"
import { getLayoutRef } from "../../helpers/show"
import { _show } from "../../helpers/shows"
import { updateOut } from "../../helpers/showActions"

// =============== TYPES ===============

interface AudioAutoLyricsConfig {
    silenceThreshold?: number // RMS below this is considered silence
    fftSize?: number // FFT size for frequency analysis (power of 2)
    featureBufferSize?: number // Number of raw audio frames to average for a stable feature
    matchWindowDurationMs?: number // Duration (ms) to look back for consistent matches
    minSlideTimeMs?: number // Minimum duration (ms) to stay on current slide
    debugLog?: (message: string, ...args: any[]) => void // Custom debug logger
}

// =============== CORE CLASS ===============
export class AudioAutoLyrics {
    // Configuration
    private config: Required<AudioAutoLyricsConfig>

    // Audio Processing
    private audioContext: AudioContext | null = null
    private analyser: AnalyserNode | null = null
    private microphoneStream: MediaStream | null = null
    private rawFeatureInputBuffer: AutoLyrics[] = [] // Buffer for incoming features before averaging
    private animationFrameId: number | null = null

    // State
    private isRecordingActive: boolean = false
    private outputListenerUnsubscribe: Unsubscriber | null = null
    private currentRecordingPartName: string | null = null
    private learnedSections: LearnedSection[] = []

    private isMatchingActive: boolean = false
    private recentMatches: { part: string; timestamp: number }[] = []
    private lastReportedMatch: string | null = null

    // Callbacks
    public onMatchUpdate: (partName: string | null) => void = () => {}
    public onError: (error: Error) => void = (err) => console.error("[AudioAutoLyrics ERROR]", err)

    constructor(customConfig: AudioAutoLyricsConfig = {}) {
        const defaultConfig: Required<AudioAutoLyricsConfig> = {
            silenceThreshold: 0.01,
            fftSize: 2048,
            featureBufferSize: 15, // Average over ~0.25s if ~60 captures/sec
            matchWindowDurationMs: 3000,
            minSlideTimeMs: 1000,
            debugLog: (message, ...args) => console.debug(`[AAL DEBUG] ${message}`, ...args),
        }
        this.config = { ...defaultConfig, ...customConfig }
        this.config.debugLog("Initialized with config:", this.config)
    }

    private async initAudio(): Promise<void> {
        if (this.audioContext && this.microphoneStream) {
            this.config.debugLog("Audio already initialized.")
            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume()
                this.config.debugLog("AudioContext resumed.")
            }
            return
        }
        try {
            this.audioContext = new AudioContext()
            this.analyser = this.audioContext.createAnalyser()
            this.analyser.fftSize = this.config.fftSize

            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const microphoneNode = this.audioContext.createMediaStreamSource(this.microphoneStream)
            microphoneNode.connect(this.analyser)
            this.config.debugLog("Microphone access granted and audio pipeline set up.")
        } catch (err) {
            this.onError(err as Error)
            this.config.debugLog("Error initializing audio:", err)
            throw err
        }
    }

    private processAudioFrame(): void {
        if (!this.analyser || !this.audioContext || this.audioContext.state === "closed") {
            this.config.debugLog("Analyser not ready or context closed, stopping frame processing.")
            this.stopAudioProcessingLoop() // Ensure loop stops
            return
        }

        const timeDomainData = new Float32Array(this.analyser.fftSize)
        this.analyser.getFloatTimeDomainData(timeDomainData)

        const rms = Math.sqrt(timeDomainData.reduce((sum, val) => sum + val * val, 0) / timeDomainData.length)

        if (rms < this.config.silenceThreshold) {
            if (this.rawFeatureInputBuffer.length > 0) {
                this.config.debugLog("Silence detected, clearing feature input buffer of size:", this.rawFeatureInputBuffer.length)
                this.rawFeatureInputBuffer = []
            }
            this.animationFrameId = requestAnimationFrame(() => this.processAudioFrame())
            return
        }

        const frequencyData = new Float32Array(this.analyser.frequencyBinCount)
        this.analyser.getFloatFrequencyData(frequencyData) // Returns dBFS

        let avgFreq = 0
        let validFreqBins = 0
        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] !== -Infinity) {
                // Only consider bins with actual energy
                avgFreq += frequencyData[i]
                validFreqBins++
            }
        }
        avgFreq = validFreqBins > 0 ? avgFreq / validFreqBins : -100 // Average dBFS or a low default

        const currentFeature: AutoLyrics = { rms, avgFreq }
        this.rawFeatureInputBuffer.push(currentFeature)

        if (this.rawFeatureInputBuffer.length >= this.config.featureBufferSize) {
            const bufferToAverage = [...this.rawFeatureInputBuffer]
            this.rawFeatureInputBuffer = [] // Clear buffer for next set

            const numFeatures = bufferToAverage.length
            const averagedRms = bufferToAverage.reduce((sum, f) => sum + f.rms, 0) / numFeatures
            const averagedFreq = bufferToAverage.reduce((sum, f) => sum + f.avgFreq, 0) / numFeatures

            const averagedFeature: RecordedSample = {
                rms: averagedRms,
                avgFreq: averagedFreq,
                timestamp: Date.now(),
            }
            this.config.debugLog("Averaged feature:", `RMS: ${averagedFeature.rms.toFixed(4)}, AvgFreq: ${averagedFeature.avgFreq.toFixed(2)}`)

            if (this.isRecordingActive && this.currentRecordingPartName) {
                this.addSampleToLearnedSection(this.currentRecordingPartName, averagedFeature)
            }

            if (this.isMatchingActive) {
                this.matchFeatureAgainstLearnedSections(averagedFeature)
            }
        }

        if (this.isRecordingActive || this.isMatchingActive) {
            this.animationFrameId = requestAnimationFrame(() => this.processAudioFrame())
        } else {
            this.config.debugLog("No active recording or matching. Stopping frame requests.")
            this.stopAudioProcessingLoop()
        }
    }

    private addSampleToLearnedSection(partName: string, sample: RecordedSample): void {
        let section = this.learnedSections.find((s) => s.part === partName)
        if (!section) {
            section = { part: partName, samples: [] }
            this.learnedSections.push(section)
            this.config.debugLog(`New section created for learning: "${partName}"`)
        }
        section.samples.push(sample)
        this.config.debugLog(`Sample added to "${partName}". Total samples for part: ${section.samples.length}`)
    }

    public async startRecording(showId: string): Promise<void> {
        let layoutRef = getLayoutRef(showId)
        let firstOutputId = getActiveOutputs()[0]
        if (!this.outputListenerUnsubscribe)
            this.outputListenerUnsubscribe = outputs.subscribe((a) => {
                let outSlide = a[firstOutputId]?.out?.slide
                if (outSlide?.index === undefined) return
                // clear output to stop recording
                // if (started && currentSequence.length && !outSlide) return stopRecording()
                // if (!outSlide || outSlide.layout !== activeLayout || outSlide.index === undefined) return

                let layoutSlide = layoutRef[outSlide.index]
                // let slideRef = { id: layoutSlide?.id, index: outSlide.index }
                // if (JSON.stringify(currentSequence[currentSequence.length - 1]?.slideRef || {}) === JSON.stringify(slideRef)) return

                let slide = _show(showId).get("slides")[layoutSlide?.id]
                // lyricsPart = slide.group // GET GROUP WITH CORRECT NUMBER...
                // const lyricsParts = ["Verse 1", "Chorus", "Verse 2", "Outro"]; // example
                this.currentRecordingPartName = outSlide?.index + "_" + getSlideText(slide || null)
                if (this.currentRecordingPartName) this.config.debugLog(`Part name: ${this.currentRecordingPartName}`)
            })

        await this.initAudio()

        this.isRecordingActive = true
        this.rawFeatureInputBuffer = [] // Clear buffer for new recording
        this.config.debugLog(`Started recording`)

        if (!this.animationFrameId && (this.isRecordingActive || this.isMatchingActive)) {
            this.config.debugLog("Kicking off audio processing loop for recording.")
            this.processAudioFrame()
        }
    }

    public stopRecording() {
        if (!this.isRecordingActive) {
            this.config.debugLog("No active recording to stop.")
            return
        }
        const recordedPartName = this.currentRecordingPartName
        const samplesCollected = this.learnedSections.find((s) => s.part === recordedPartName)?.samples.length || 0
        this.config.debugLog(`Stopped recording for part: "${recordedPartName}". Samples collected: ${samplesCollected}`)

        if (this.outputListenerUnsubscribe) {
            this.outputListenerUnsubscribe()
            this.outputListenerUnsubscribe = null
        }

        this.isRecordingActive = false
        this.currentRecordingPartName = null

        if (!this.isMatchingActive && this.animationFrameId) {
            this.config.debugLog("Recording stopped and not matching, stopping audio loop.")
            this.stopAudioProcessingLoop()
        }

        const data = this.getLearnedData()
        // this.clearLearnedData()
        return data
    }

    private matchFeatureAgainstLearnedSections(liveFeature: RecordedSample): void {
        if (this.learnedSections.length === 0) {
            this.config.debugLog("Match attempt: No learned sections to match against.")
            return
        }

        let closestMatchSectionName: string | null = null
        let smallestDiff = Infinity

        this.learnedSections.forEach((section) => {
            section.samples.forEach((recordedSample) => {
                // Simple L1 distance. Consider normalization or weighting if needed.
                // RMS typically 0-1, AvgFreq (dB) can be e.g. -100 to 0.
                // Scaling RMS difference can give it more weight if its range is smaller.
                const diffRms = Math.abs(recordedSample.rms - liveFeature.rms) * 100 // Scale RMS diff
                const diffFreq = Math.abs(recordedSample.avgFreq - liveFeature.avgFreq)
                const diff = diffRms + diffFreq

                if (diff < smallestDiff) {
                    smallestDiff = diff
                    closestMatchSectionName = section.part
                }
            })
        })

        this.config.debugLog(`Match check: Live Feat(RMS:${liveFeature.rms.toFixed(3)}, Freq:${liveFeature.avgFreq.toFixed(2)}). Closest stored sample from: ${closestMatchSectionName || "None"}, Diff: ${smallestDiff.toFixed(3)}`)

        // update output
        let matchedIndex = this.slidesText.findIndex((a, i) => i + "_" + a === closestMatchSectionName)
        if (matchedIndex < 0) matchedIndex = this.slidesText.findIndex((a) => a === closestMatchSectionName?.split("_")[1])
        if (matchedIndex > -1) {
            setOutput("slide", { id: get(activeAutoLyrics).ref.showId, layout: get(activeAutoLyrics).ref.layoutId, index: matchedIndex, line: 0 })
            updateOut(get(activeAutoLyrics).ref.showId, matchedIndex, getLayoutRef(get(activeAutoLyrics).ref.showId))
        }

        if (closestMatchSectionName) {
            const now = Date.now()
            this.recentMatches.push({ part: closestMatchSectionName, timestamp: now })
            this.recentMatches = this.recentMatches.filter((m) => now - m.timestamp <= this.config.matchWindowDurationMs)

            const stablePart = this.getStableMatch()
            if (stablePart && stablePart !== this.lastReportedMatch) {
                this.lastReportedMatch = stablePart
                this.config.debugLog(`Switching to stable match: ${stablePart}`)
                this.onMatchUpdate(stablePart)

                // Output index handling
                let matchedIndex = this.slidesText.findIndex((a, i) => i + "_" + a === stablePart)
                if (matchedIndex < 0) matchedIndex = this.slidesText.findIndex((a) => a === stablePart.split("_")[1])
                if (matchedIndex > -1) {
                    setOutput("slide", {
                        id: get(activeAutoLyrics).ref.showId,
                        layout: get(activeAutoLyrics).ref.layoutId,
                        index: matchedIndex,
                        line: 0,
                    })
                    updateOut(get(activeAutoLyrics).ref.showId, matchedIndex, getLayoutRef(get(activeAutoLyrics).ref.showId))
                }
            }
        } else if (this.lastReportedMatch !== null) {
            // No closest match found at all in this frame
            this.lastReportedMatch = null
            this.onMatchUpdate(null)
            this.config.debugLog("No closest match found for current feature, resetting reported match.")
        }
    }

    // New method: compute confidence score based on historical frequency
    lastMatchTime = 0
    private getStableMatch(): string | null {
        const now = Date.now()
        const window = this.config.matchWindowDurationMs
        const recent = this.recentMatches.filter((m) => now - m.timestamp <= window)

        // Don't switch slide too fast
        if (this.lastReportedMatch && now - this.lastMatchTime < this.config.minSlideTimeMs) {
            return this.lastReportedMatch
        }
        this.lastMatchTime = now
        if (recent.length === 0) return null

        const partCounts: { [key: string]: number } = {}
        recent.forEach(({ part }) => {
            partCounts[part] = (partCounts[part] || 0) + 1
        })

        // Convert part name "index_text" to index
        const parseIndex = (p: string) => parseInt(p.split("_")[0]) || 0

        const currentIndex = this.lastReportedMatch ? parseIndex(this.lastReportedMatch) : -1

        const sorted = Object.entries(partCounts)
            .map(([part, count]) => {
                const index = parseIndex(part)
                // const distance = Math.abs(index - currentIndex)
                let weight = count

                // penalize matches with same text but non-adjacent index
                if (index !== currentIndex && this.slidesText[index] === this.slidesText[currentIndex]) {
                    weight *= 0.5
                }

                if (index === currentIndex)
                    weight *= 2 // prefer current
                else if (index === currentIndex + 1)
                    weight *= 1.5 // prefer next
                else if (index < currentIndex) weight *= 0.5 // penalize backwards
                return { part, score: weight }
            })
            .sort((a, b) => b.score - a.score)

        const top = sorted[0]
        if (!top) return null

        // Require score to be significantly higher to switch
        if (this.lastReportedMatch && top.part !== this.lastReportedMatch) {
            const currentScore = sorted.find((s) => s.part === this.lastReportedMatch)?.score || 0
            if (top.score < currentScore * 1.3) {
                return this.lastReportedMatch // stick with current
            }
        }

        return top.part
    }

    slidesText: string[] = []
    public async startMatching(ref: { showId: string; layoutId: string }): Promise<void> {
        if (this.learnedSections.length === 0) {
            const err = new Error("Cannot start matching without any learned sections.")
            this.onError(err)
            this.config.debugLog("Attempted to start matching with no learned data.")
            throw err
        }
        await this.initAudio()

        activeAutoLyrics.set({ ref })

        const layoutRef = getLayoutRef(ref.showId)
        const slides = _show(ref.showId).get("slides")
        this.slidesText = layoutRef.map((a) => getSlideText(slides[a.id]))

        this.isMatchingActive = true
        this.recentMatches = []
        this.lastReportedMatch = null
        this.rawFeatureInputBuffer = [] // Clear buffer for new matching session
        this.config.debugLog("Started matching.")

        if (!this.animationFrameId && (this.isRecordingActive || this.isMatchingActive)) {
            this.config.debugLog("Kicking off audio processing loop for matching.")
            this.processAudioFrame()
        }
    }

    public stopMatching(): void {
        if (!this.isMatchingActive) {
            this.config.debugLog("No active matching to stop.")
            return
        }

        activeAutoLyrics.set(null)

        this.config.debugLog("Stopped matching.")
        this.isMatchingActive = false
        this.recentMatches = []

        if (!this.isRecordingActive && this.animationFrameId) {
            this.config.debugLog("Matching stopped and not recording, stopping audio loop.")
            this.stopAudioProcessingLoop()
        }
    }

    private stopAudioProcessingLoop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
            this.config.debugLog("Audio processing loop stopped.")
        }
    }

    public stopAllActivityAndReleaseAudio(): void {
        this.config.debugLog("Stopping all activity and releasing audio resources.")
        this.isRecordingActive = false
        this.isMatchingActive = false
        this.currentRecordingPartName = null

        this.stopAudioProcessingLoop()

        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach((track) => track.stop())
            this.microphoneStream = null
            this.config.debugLog("Microphone stream stopped and released.")
        }
        if (this.audioContext && this.audioContext.state !== "closed") {
            this.audioContext.close().then(() => {
                this.config.debugLog("AudioContext closed.")
            })
            this.audioContext = null
        }
        this.analyser = null
        this.rawFeatureInputBuffer = []
    }

    // --- Data Management ---
    public getLearnedData(): LearnedSection[] {
        // Return a deep copy to prevent external modification
        return JSON.parse(JSON.stringify(this.learnedSections))
    }

    public loadLearnedData(data: LearnedSection[]): void {
        try {
            // Basic validation: check if it's an array and parts have 'part' and 'samples'
            if (Array.isArray(data) && data.every((s) => typeof s.part === "string" && Array.isArray(s.samples))) {
                this.learnedSections = JSON.parse(JSON.stringify(data)) // Store a deep copy
                this.config.debugLog("Loaded learned sections. Number of sections:", this.learnedSections.length)
            } else {
                throw new Error("Invalid data format for learned sections.")
            }
        } catch (e) {
            this.onError(e as Error)
            this.config.debugLog("Error loading learned data:", e)
        }
    }

    public clearLearnedData(): void {
        this.learnedSections = []
        this.config.debugLog("All learned data cleared.")
    }

    public clearSpecificLearnedSection(partName: string): void {
        const initialLength = this.learnedSections.length
        this.learnedSections = this.learnedSections.filter((s) => s.part !== partName)
        if (this.learnedSections.length < initialLength) {
            this.config.debugLog(`Cleared learned data for section: "${partName}"`)
        } else {
            this.config.debugLog(`No learned data found for section: "${partName}" to clear.`)
        }
    }
}

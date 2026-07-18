// https://github.com/ChurchApps/FreeShow/pull/1551

// Standard chromatic scale with sharps
const SHARP_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
// Standard chromatic scale with flats
const FLAT_SCALE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// Map for enharmonic equivalents
const ENHARMONIC: Record<string, string> = {
    Db: "C#",
    Eb: "D#",
    Gb: "F#",
    Ab: "G#",
    Bb: "A#",
    "C#": "Db",
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb"
}

function normalizeRoot(root: string, preferSharps: boolean): string {
    // Always convert to sharp or flat
    if (preferSharps && FLAT_SCALE.includes(root)) return ENHARMONIC[root] || root
    if (!preferSharps && SHARP_SCALE.includes(root)) return ENHARMONIC[root] || root
    return root
}

function transposeChord(chord: string, step: number, preferSharps = true): string {
    // Accept both ASCII and Unicode flat/sharp symbols (b, #, ♭, ♯)
    const match = chord.match(/^([A-G][b#♭♯]?)(.*)$/)
    if (!match) return chord
    // eslint-disable-next-line prefer-const
    let [, root, rest] = match
    // Normalize any unicode flat/sharp to ASCII so our scales/enharmonic map match
    root = root.replace(/♭/g, "b").replace(/♯/g, "#")
    // Normalize to sharp or flat
    root = normalizeRoot(root, preferSharps)
    const scale = preferSharps ? SHARP_SCALE : FLAT_SCALE
    let i = scale.indexOf(root)
    // If not found, try enharmonic equivalent
    if (i === -1 && ENHARMONIC[root]) {
        root = ENHARMONIC[root]
        i = scale.indexOf(root)
    }
    if (i === -1) return chord
    const newIndex = (i + step + 12) % 12
    return scale[newIndex] + rest
}

function transposeFullChord(chord: string, step: number, preferSharps = true): string {
    // Handles slash chords and chords with bass notes
    // e.g., Bm7/E, C#/G#, etc.
    if (chord.includes("/")) {
        const [main, bass] = chord.split("/")
        return transposeChord(main, step, preferSharps) + "/" + transposeChord(bass, step, preferSharps)
    }
    return transposeChord(chord, step, preferSharps)
}

// transpose a single chord key (e.g. "Gmaj7", "Bm7/E"), handling slash/bass notes
export function transposeChordKey(key: string, step: number, preferSharps = step >= 0): string {
    return transposeFullChord(key, step, preferSharps)
}

// get the chromatic index (0-11, C=0) of a chord/key root, or -1 if not a note
export function keyToIndex(key: string): number {
    if (!key) return -1
    const match = key.match(/^([A-G])([b#♭♯]?)/)
    if (!match) return -1
    const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    let i = base[match[1]]
    if (i === undefined) return -1
    const accidental = match[2].replace("♭", "b").replace("♯", "#")
    if (accidental === "#") i += 1
    else if (accidental === "b") i -= 1
    return (i + 12) % 12
}

// semitone distance to get from one key to another (0-11)
export function getSemitonesBetweenKeys(from: string, to: string): number {
    const a = keyToIndex(from)
    const b = keyToIndex(to)
    if (a === -1 || b === -1) return 0
    return (b - a + 12) % 12
}

// diatonic triads for each major key (root indexes), used for key detection
const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11]

// detect the most likely key of a song from its chords (major keys only)
export function detectKey(chordKeys: string[]): string {
    const roots = chordKeys.map(keyToIndex).filter((i) => i >= 0)
    if (!roots.length) return ""

    let bestKey = 0
    let bestScore = -Infinity
    for (let tonic = 0; tonic < 12; tonic++) {
        const scale = MAJOR_SCALE_STEPS.map((s) => (tonic + s) % 12)
        let score = 0
        roots.forEach((root, i) => {
            if (scale.includes(root)) score += 1
            if (root === tonic) score += 2 // tonic
            if (root === (tonic + 7) % 12) score += 1 // dominant
            if (root === (tonic + 5) % 12) score += 1 // subdominant
            // first & last chord are strong tonic indicators
            if ((i === 0 || i === roots.length - 1) && root === tonic) score += 3
        })
        if (score > bestScore) {
            bestScore = score
            bestKey = tonic
        }
    }

    return SHARP_SCALE[bestKey]
}

export function transposeText(text: string, step: number): string {
    // Prefer sharps when transposing up, flats when down
    const preferSharps = step >= 0
    // Regex matches chords in brackets. It should capture a root note with optional
    // accidental, then any common chord descriptors (maj, min, m, aug, dim, sus,
    // add, numbers, parenthesis, extensions) and optional slash bass notes.
    // Examples matched: C, D7, Bm7, Gmaj7, Asus4, F#(add9), Bbmaj7/G
    // Allow ASCII and Unicode flats/sharps in the root and in slash bass notes
    // This regex is more specific to avoid matching section labels like [Chorus], [Verse], etc.
    const chordInBrackets = /\[([A-G][b#♭♯]?(?:maj|min|m|aug|dim|sus|add|\d|\(|\)|\/[A-G][b#♭♯]?)*)\]/g
    return text.replace(chordInBrackets, (match, p1) => {
        // Chord notation uses: note names (A-G), accidentals (b#♭♯), numbers, and specific extensions
        // If it's longer than 8 chars or contains letters other than standard chord notation, likely not a chord
        if (p1.length > 8 || /[a-z]{4,}/i.test(p1.replace(/^[A-G][b#♭♯]?(maj|min|aug|dim|sus|add)/i, ""))) {
            return match // Return unchanged if it looks like a section label
        }

        return "[" + transposeFullChord(p1, step, preferSharps) + "]"
    })
}

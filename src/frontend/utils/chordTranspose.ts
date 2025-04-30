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
    "A#": "Bb",
}

function normalizeRoot(root: string, preferSharps: boolean): string {
    // Always convert to sharp or flat
    if (preferSharps && FLAT_SCALE.includes(root)) return ENHARMONIC[root] || root
    if (!preferSharps && SHARP_SCALE.includes(root)) return ENHARMONIC[root] || root
    return root
}

function transposeChord(chord: string, step: number, preferSharps = true): string {
    const match = chord.match(/^([A-G][b#]?)(.*)$/)
    if (!match) return chord
    // eslint-disable-next-line prefer-const
    let [, root, rest] = match
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

export function transposeText(text: string, step: number): string {
    // Prefer sharps when transposing up, flats when down
    const preferSharps = step >= 0
    // Regex matches chords in brackets, with optional slash chords and modifiers
    return text.replace(/\[([A-G][b#]?m?(?:aug|dim|sus|add)?\d*(?:\/[A-G][b#]?)?)\]/g, (_unused, p1) => {
        return "[" + transposeFullChord(p1, step, preferSharps) + "]"
    })
}

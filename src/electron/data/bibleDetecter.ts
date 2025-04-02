type FileTypes = "freeshow" | "zefania" | "osis" | "opensong" | "beblia" | "softprojector" | "wordproject" | "biblequote" | "ibible" | "sqlite" | "mdb"

export function detectFileType(content: string): FileTypes | null {
    // JSON
    if (content.includes('"books":') && content.includes('"number":') && content.includes('"text":')) return "freeshow"

    // XML
    if (content.includes("XMLBIBLE") && content.includes("BIBLEBOOK")) return "zefania"
    if (content.includes("osisText") && content.includes("osisID")) return "osis"
    if (content.includes("bible") && content.includes("b n=") && content.includes("v n=")) return "opensong"
    if (content.includes("bible") && content.includes("verse number=")) return "beblia"
    // TXT (Custom)
    if (content.includes("spDataVersion:") && content.includes("C001V001")) return "softprojector"
    // HTM(L)
    if (content.includes('<li><a title="') && content.includes("Wordproject")) return "wordproject"
    if (content.includes("PathName") && content.includes("BibleName")) return "biblequote"
    if (content.includes("ibibles.net")) return "ibible"

    // SQLITE
    if (content.includes("SQLite")) return "sqlite"
    // Microsoft Access Database
    if (content.includes("Standard Jet DB")) return "mdb"

    return null
}

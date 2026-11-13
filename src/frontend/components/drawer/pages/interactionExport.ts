import { translateText } from "../../../utils/language"

export function exportInteractionCSV(entry: any, interactionName?: string) {
    if (!entry) return

    const escape = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`
    const rows: string[][] = [
        ["Interaction", interactionName || translateText("main.unnamed"), ""],
        ["Date", new Date(entry.time).toLocaleString(), ""],
        ["", "", ""]
    ]

    if (entry.leaderboard?.length) {
        rows.push(["Leaderboard", "", ""], ["Rank", "Player", "Score"])
        entry.leaderboard.forEach((p: any, i: number) => rows.push([String(i + 1), p.name || "", `${p.score ?? 0} pts`]))
        rows.push(["", "", ""])
    }

    rows.push(["Question", "Respondent", "Answer"])
    ;(entry.inputs || []).forEach((input: any) => {
        const questionText = input.question || translateText("main.unnamed")
        if (input.answers?.length) {
            input.answers.forEach((a: any) => rows.push([questionText, a.name || "", Array.isArray(a.value) ? a.value.join(", ") : String(a.value ?? "")]))
        } else {
            rows.push([questionText, "", ""])
        }
    })

    const csv = "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    a.download = `${(interactionName || "Interaction").replace(/[/\\?%*:|"<>]/g, "_")}_${new Date(entry.time).toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
}

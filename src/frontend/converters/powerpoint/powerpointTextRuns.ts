export type PowerPointTextRun = {
    value?: string
    style?: string
    customType?: string
    sourceDynamicKey?: string
}

function normalizeMetadata(run: PowerPointTextRun) {
    return `${run.customType || ""}|${run.sourceDynamicKey || ""}`
}

export function mergeAdjacentTextRuns<T extends PowerPointTextRun>(runs: T[]): T[] {
    if (!Array.isArray(runs) || runs.length < 2) return runs

    const merged: T[] = []

    for (const run of runs) {
        if (typeof run?.value !== "string") {
            merged.push(run)
            continue
        }

        const previous = merged.at(-1)
        const hasExplicitBreak = run.value.includes("<br>") || run.value.includes("\n")

        if (
            previous &&
            typeof previous.value === "string" &&
            !hasExplicitBreak &&
            !previous.value.includes("<br>") &&
            !previous.value.includes("\n") &&
            previous.style === run.style &&
            normalizeMetadata(previous) === normalizeMetadata(run)
        ) {
            previous.value += run.value
            continue
        }

        merged.push({ ...run })
    }

    return merged
}

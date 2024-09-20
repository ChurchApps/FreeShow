export async function getPages(pdfPath: string): Promise<number> {
    let response = await fetch(pdfPath)
    let data = await response.blob()

    const reader = new FileReader()

    return new Promise((resolve) => {
        reader.onload = (_) => {
            const dataURL = reader.result?.toString() || ""
            resolve(dataURL.match(/\/Type[\s]*\/Page[^s]/g)?.length || 0)
        }

        reader.readAsText(data)
    })
}

export async function getViewportSizes(pdfPath: string): Promise<{ width: number; height: number }[]> {
    let response = await fetch(pdfPath)
    let data = await response.blob()

    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.onload = (_) => {
            try {
                const dataURL = reader.result?.toString() || ""
                const pageMatches = dataURL.match(/\/Type\s*\/Page[^s]/g) || []
                const boxMatch = getBoxes(dataURL)

                let viewports: { width: number; height: number }[] = []
                for (let i = 0; i < boxMatch.length; i++) {
                    let dimensions = getMediaBoxDimensions(boxMatch[i])
                    if (dimensions) viewports.push(dimensions)
                }

                // pages might be wrongly double the actual mediabox size,
                // but in cases where pages is less than mediabox or not double, use that count
                if (pageMatches.length && pageMatches.length < viewports.length) viewports = viewports.slice(0, pageMatches.length)
                else if (viewports.length && pageMatches.length > viewports.length && pageMatches.length !== viewports.length * 2) {
                    ;[...Array(pageMatches.length - viewports.length)].forEach(() => {
                        viewports.push(viewports[0])
                    })
                }

                resolve(viewports)
            } catch (error) {
                reject(error)
            }
        }

        reader.readAsText(data)
    })
}

// /MediaBox\n[\n0\n0\n960\n540\n] OR /MediaBox[ 0 0 960 540]
function getBoxes(dataURL: string) {
    const boxTypes = ["MediaBox", "CropBox", "BleedBox", "TrimBox", "ArtBox"]

    for (const type of boxTypes) {
        const regex = new RegExp(`/${type}\\s*\\[([^\\]]+)\\]`, "g")
        let boxes: string[] = []
        let match
        while ((match = regex.exec(dataURL)) !== null) {
            boxes.push(match[0].replace(/\n/g, " "))
        }

        if (boxes.length) return boxes
    }

    return []
}

function getMediaBoxDimensions(mediaBox: string): { width: number; height: number } | null {
    if (!mediaBox) return null

    // extract the MediaBox dimensions (e.g. [0 0 595.28 841.89])
    const dimensions =
        mediaBox
            .match(/\[(.*?)\]/)?.[1]
            .trim()
            .split(" ")
            .map(Number) || []

    // invalid dimensions
    if (dimensions.length !== 4) return null

    // get the actual width and height
    const width = dimensions[2] - dimensions[0]
    const height = dimensions[3] - dimensions[1]
    return { width: Math.round(width), height: Math.round(height) }
}

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
                const mediaBoxMatches = dataURL.match(/\/MediaBox\s*\[(.*?)\]/g) || []

                let viewports: { width: number; height: number }[] = []
                for (let i = 0; i < pageMatches.length; i++) {
                    const match = mediaBoxMatches[i]
                    if (match) {
                        // Extract the MediaBox dimensions (e.g., [0 0 595.28 841.89])
                        const dimensions =
                            match
                                .match(/\[(.*?)\]/)?.[1]
                                .split(" ")
                                .map(Number) || []
                        if (dimensions.length === 4) {
                            // The viewport size is the width and height, so we calculate it
                            const width = dimensions[2] - dimensions[0]
                            const height = dimensions[3] - dimensions[1]
                            viewports.push({ width, height })
                        }
                    }
                }

                resolve(viewports)
            } catch (error) {
                reject(error)
            }
        }

        reader.readAsText(data)
    })
}

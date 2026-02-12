import { app as electronApp } from "electron"
import type { Request, Response } from "express"
import path from "path"
import { stores } from "../../../electron/data/store"
import { readFile } from "../../../electron/utils/files"
import type { Media as ItemMedia, Show, Slide, SlideData, TrimmedShow } from "../../../types/Show"
import { getMediaUrl } from "./MediaHelper"

// Desktop app constants
const DEFAULT_FONT_SIZE = 100

// Helper function to get layout slides in the correct order (matching desktop app behavior)
export function getLayoutSlides(showData: Show, layoutId?: string): SlideData[] {
    const layoutSlides: SlideData[] = []
    const activeLayoutId = layoutId || showData.settings?.activeLayout

    if (showData.layouts && activeLayoutId && showData.layouts[activeLayoutId]) {
        showData.layouts[activeLayoutId].slides?.forEach((ls) => {
            if (ls && showData.slides[ls.id]) {
                const slide: Slide = showData.slides[ls.id]
                const newLS = { ...ls }
                delete newLS.children
                layoutSlides.push({ ...newLS, color: slide.color })

                if (slide.children) {
                    slide.children.forEach((id: string) => {
                        if (ls.children?.[id]) {
                            const slideData: any = ls.children[id]
                            if (slideData) layoutSlides.push({ id, ...slideData, color: slide.color, parent: ls.id })
                        } else layoutSlides.push({ id, color: slide.color, parent: ls.id })
                    })
                }
            }
        })
    }
    return layoutSlides
}

// Helper function to parse CSS styles from a style string
function getStyles(styleString: string): { [key: string]: string } {
    const styles: { [key: string]: string } = {}
    if (!styleString?.length) return styles

    styleString.split(";").forEach((s) => {
        if (!s.length) return
        const key = s.slice(0, s.indexOf(":")).trim()
        const value = s.slice(s.indexOf(":") + 1).trim()
        if (key && value) {
            styles[key] = value
        }
    })

    return styles
}

// Helper function to apply custom styling to text segments (matching desktop app behavior)
function getCustomStyle(style: string): string {
    if (!style) return ""

    // For now, return the style as-is since we don't have output resolution context
    // In the desktop app, this function also handles percentage positioning and alpha values
    return style
}

// Helper function to scale positioning and sizing based on viewport (matching desktop app behavior)
function scaleStyleForViewport(style: string): string {
    if (!style) return ""

    const styles = getStyles(style)
    let scaledStyle = ""

    // Scale positioning and sizing from 1920x1080 base to viewport size
    // This matches the desktop app's percentageStylePos function
    Object.entries(styles).forEach(([key, value]) => {
        if (key === "left" || key === "width") {
            // Scale based on viewport width (1920px base)
            const numValue = parseFloat(value)
            if (!isNaN(numValue)) {
                scaledStyle += `${key}: ${(numValue / 1920) * 100}vw;`
            } else {
                scaledStyle += `${key}: ${value};`
            }
        } else if (key === "top" || key === "height") {
            // Scale based on viewport height (1080px base)
            const numValue = parseFloat(value)
            if (!isNaN(numValue)) {
                scaledStyle += `${key}: ${(numValue / 1080) * 100}vh;`
            } else {
                scaledStyle += `${key}: ${value};`
            }
        } else if (key === "font-size") {
            // Font size will be handled separately with proper scaling
            const numValue = parseFloat(value)
            if (!isNaN(numValue)) {
                // Scale font size based on viewport size (matching desktop app behavior)
                // Use the smaller dimension to maintain aspect ratio
                scaledStyle += `${key}: min(${(numValue / 1920) * 100}vw, ${(numValue / 1080) * 100}vh);`
            } else {
                scaledStyle += `${key}: ${value};`
            }
        } else {
            scaledStyle += `${key}: ${value};`
        }
    })

    return scaledStyle
}

export function generateSlideHtmlResponse(showData: Show, slideData: Slide, showId: string, slideId: string, layoutSlideData?: any): string {
    const showName = showData.name || showId
    let html = `<!DOCTYPE html><html><head><title>Show - ${showName} - Slide ${slideId}</title>`

    // Get all slide IDs in the correct layout order (matching desktop app behavior)
    const layoutSlides = getLayoutSlides(showData)
    const slideIds = layoutSlides.map((slide) => slide.id)
    const currentSlideIndex = slideIds.indexOf(slideId)

    // Get the nextTimer value from layout data (matching desktop app behavior)
    const nextTimer = layoutSlideData?.nextTimer || 0

    // Link to external CSS file
    const cssLink = `<link rel="stylesheet" href="/html/show.css">`

    // Add JavaScript for navigation and timer functionality
    const navigationScript = `
        <script src="/html/navigation.js"></script>
        <script>
            // Initialize navigation with slide data
            initializeNavigation({
                showId: '${showId}',
                slideIds: ${JSON.stringify(slideIds)},
                currentIndex: ${currentSlideIndex},
                nextTimer: ${nextTimer}
            });
        </script>
    `

    let bodyContent = ""

    let slideContainerStyle = "position: relative; width: 100%; height: 100%; z-index: 0;"

    // Handle background media from layout data
    let backgroundMediaHtml = ""
    if (layoutSlideData?.background && showData.media?.[layoutSlideData.background]) {
        const backgroundMedia = showData.media[layoutSlideData.background]
        const backgroundPath = backgroundMedia.path || backgroundMedia.id || ""

        if (backgroundPath) {
            const mediaUrl = getMediaUrl(backgroundPath)
            const isImage = backgroundPath.endsWith(".png") || backgroundPath.endsWith(".jpg") || backgroundPath.endsWith(".jpeg") || backgroundPath.endsWith(".gif") || backgroundPath.endsWith(".webp")
            const isVideo = backgroundPath.endsWith(".mp4") || backgroundPath.endsWith(".webm") || backgroundPath.endsWith(".ogv")

            if (isImage) {
                backgroundMediaHtml = `<div class="background-media"><img src="${mediaUrl}" alt="Background Image"></div>`
            } else if (isVideo) {
                const muted = backgroundMedia.muted !== false ? "muted" : ""
                const loop = backgroundMedia.loop !== false ? "loop" : ""
                backgroundMediaHtml = `<div class="background-media"><video src="${mediaUrl}" ${muted} ${loop} autoplay></video></div>`
            }
        }
    }

    // Handle slide background color
    if (slideData.settings?.color) {
        slideContainerStyle += `background-color: ${slideData.settings.color};`
    } else if (!backgroundMediaHtml) {
        slideContainerStyle += `background-color: #000000;` // Default black background only if no media
    }

    if (slideData.items) {
        for (const item of slideData.items) {
            let itemStyle = "position: absolute;"
            let itemStyles: { [key: string]: string } = {}

            // Apply the item's style property which contains positioning and other CSS
            if (item.style) {
                // Scale the positioning for viewport (matching desktop app behavior)
                itemStyle += scaleStyleForViewport(item.style)
                itemStyles = getStyles(item.style)
            }

            // Add default positioning if not specified in style (but scale it too)
            if (!itemStyles["left"] && !itemStyles["inset-inline-start"]) {
                itemStyle += "left: " + (50 / 1920) * 100 + "vw;"
            }
            if (!itemStyles["top"]) {
                itemStyle += "top: " + (50 / 1080) * 100 + "vh;"
            }
            if (!itemStyles["width"]) {
                itemStyle += "width: " + (400 / 1920) * 100 + "vw;"
            }
            if (!itemStyles["height"]) {
                itemStyle += "height: " + (150 / 1080) * 100 + "vh;"
            }

            if (item.lines) {
                // This is a text item - ensure it appears above background media
                if (!itemStyle.includes("z-index")) {
                    itemStyle += "z-index: 100;"
                }

                // Create the text item with proper structure matching desktop app
                bodyContent += `<div class="slide-item text-item" style="${itemStyle}">`

                // Add align div with proper alignment styles - matching desktop app behavior
                let alignStyle = "height: 100%; display: flex; text-align: center; align-items: center;"

                // Parse item.align to extract alignment properties
                if (item.align) {
                    const alignStyles = getStyles(item.align)

                    // Apply align-items (vertical alignment)
                    if (alignStyles["align-items"]) {
                        alignStyle = alignStyle.replace("align-items: center;", `align-items: ${alignStyles["align-items"]};`)
                    }

                    // Apply justify-content if specified (for container alignment)
                    if (alignStyles["justify-content"]) {
                        alignStyle += `justify-content: ${alignStyles["justify-content"]};`
                    }

                    // Apply text-align if specified at item level
                    if (alignStyles["text-align"]) {
                        alignStyle = alignStyle.replace("text-align: center;", `text-align: ${alignStyles["text-align"]};`)
                    }
                }

                bodyContent += `<div class="align" style="${alignStyle}">`

                // Add lines container
                let linesStyle = "width: 100%; display: flex; flex-direction: column; text-align: center; justify-content: center;"
                bodyContent += `<div class="lines" style="${linesStyle}">`

                // Process each line
                for (const line of item.lines) {
                    // Add line alignment if specified - this overrides item-level text alignment
                    let lineStyle = "width: 100%; font-size: 0; overflow-wrap: break-word;"
                    if (line.align) {
                        const lineAlignStyles = getStyles(line.align)
                        if (lineAlignStyles["text-align"]) {
                            lineStyle += `text-align: ${lineAlignStyles["text-align"]};`
                        }
                        // Apply any other line-specific styles
                        Object.entries(lineAlignStyles).forEach(([key, value]) => {
                            if (key !== "text-align") {
                                lineStyle += `${key}: ${value};`
                            }
                        })
                    }

                    bodyContent += `<div class="break" style="${lineStyle}">`

                    // Process each text segment in the line
                    for (const textSegment of line.text) {
                        // Start with default text styling using viewport-based sizing
                        let spanStyle = `font-size: min(${(DEFAULT_FONT_SIZE / 1920) * 100}vw, ${(DEFAULT_FONT_SIZE / 1080) * 100}vh); min-height: min(${(50 / 1920) * 100}vw, ${(50 / 1080) * 100}vh); color: white; font-family: 'CMGSans', sans-serif; line-height: 1.1; text-shadow: 2px 2px 10px #000000; -webkit-text-stroke-color: #000000; paint-order: stroke fill; font-weight: bold;`

                        // Apply individual text segment styles - this is where custom styling happens
                        if (textSegment.style) {
                            // Use the custom style function to process the style
                            const customStyle = getCustomStyle(textSegment.style)
                            spanStyle += customStyle

                            // Handle font size specifically with proper scaling
                            const segmentStyles = getStyles(textSegment.style)
                            if (segmentStyles["font-size"]) {
                                const fontSize = Number(segmentStyles["font-size"])
                                if (!isNaN(fontSize)) {
                                    // Override the default font-size with the custom one, properly scaled
                                    const scaledFontSize = `min(${(fontSize / 1920) * 100}vw, ${(fontSize / 1080) * 100}vh)`
                                    spanStyle = spanStyle.replace(/font-size: [^;]+;/, `font-size: ${scaledFontSize};`)
                                }
                            }
                        }

                        const textValue = textSegment.value?.replaceAll("\n", "<br>") || "<br>"
                        bodyContent += `<span style="${spanStyle}">${textValue}</span>`
                    }

                    bodyContent += `</div>` // Close break div
                }

                bodyContent += `</div>` // Close lines div
                bodyContent += `</div>` // Close align div
                bodyContent += `</div>` // Close text-item div
            } else if (item.type === "media" && (item.src || item.media)) {
                const mediaObject = item.media as ItemMedia | undefined
                const pathValue = item.src ?? mediaObject?.path ?? ""
                const fitMode = item.fit ?? "contain"

                if (pathValue) {
                    const mediaUrl = getMediaUrl(pathValue)
                    bodyContent += `<div class="slide-item media-item" style="${itemStyle}">`
                    const isImage = item.type === "media" && (pathValue.endsWith(".png") || pathValue.endsWith(".jpg") || pathValue.endsWith(".jpeg") || pathValue.endsWith(".gif") || pathValue.endsWith(".webp"))
                    const isVideo = item.type === "media" && (pathValue.endsWith(".mp4") || pathValue.endsWith(".webm") || pathValue.endsWith(".ogv"))

                    if (isImage) {
                        bodyContent += `<img src="${mediaUrl}" alt="Slide Image" style="width: 100%; height: 100%; object-fit: ${fitMode};">`
                    } else if (isVideo) {
                        bodyContent += `<video src="${mediaUrl}" controls style="width: 100%; height: 100%; object-fit: ${fitMode};"></video>`
                    }
                    bodyContent += `</div>`
                }
            }
        }
    }

    // Create slide container with dynamic background color if needed
    const slideContainerClass = slideContainerStyle ? `class="slide-container" style="${slideContainerStyle}"` : `class="slide-container"`

    html += `${cssLink}${navigationScript}</head><body><div ${slideContainerClass}>${backgroundMediaHtml}${bodyContent}</div></body></html>`
    return html
}

// New handleShowSlideHtmlRequest function
export async function handleShowSlideHtmlRequest(req: Request, res: Response): Promise<void> {
    const { showId, slideId } = req.params

    try {
        const trimmedShow = stores.SHOWS.get(showId) as TrimmedShow | undefined

        if (!trimmedShow) {
            res.status(404).send(`Show metadata not found for ID: ${showId}`)
            return
        }

        const showNameFromStore = trimmedShow.name
        if (!showNameFromStore || showNameFromStore.trim() === "") {
            res.status(404).send(`Show name is empty for ID: ${showId}`)
            return
        }

        const showFileName = showNameFromStore + ".show"

        let showsPath = stores.SETTINGS.get("showsPath") as string | undefined
        if (!showsPath) {
            showsPath = path.join(electronApp.getPath("userData"), "Shows")
        }
        const showFilePath = path.join(showsPath, showFileName)

        const fileContent = readFile(showFilePath)
        if (!fileContent) {
            res.status(404).send(`Show file ${showFileName} not found or is empty`)
            return
        }

        let showData: Show
        try {
            const parsedData = JSON.parse(fileContent)
            // Handle case where showData is an array [showId, showObject]
            if (Array.isArray(parsedData) && parsedData.length >= 2) {
                showData = parsedData[1] as Show
            } else {
                showData = parsedData as Show
            }
        } catch (parseError) {
            res.status(500).send("Error parsing show data")
            return
        }

        const slideData = showData.slides[slideId] as Slide | undefined

        if (!slideData) {
            res.status(404).send(`Slide not found in show for ID: ${slideId}`)
            return
        }

        // Get layout data to find background media
        const activeLayoutId = showData.settings?.activeLayout
        let layoutSlideData: any = undefined

        if (activeLayoutId && showData.layouts?.[activeLayoutId]) {
            const layout = showData.layouts[activeLayoutId]

            // Find the layout slide that corresponds to our slideId
            layoutSlideData = layout.slides?.find((layoutSlide: any) => layoutSlide.id === slideId)

            // If not found directly, check if this is a child slide
            if (!layoutSlideData) {
                // Look for parent slide that has this slideId as a child
                for (const parentLayoutSlide of layout.slides || []) {
                    if (showData.slides[parentLayoutSlide.id]?.children?.includes(slideId)) {
                        // This is a child slide - inherit layout data from parent
                        layoutSlideData = { ...parentLayoutSlide }

                        // Check if there's specific child data in the parent's children object
                        if (parentLayoutSlide.children?.[slideId]) {
                            // Merge parent layout data with child-specific data
                            layoutSlideData = { ...layoutSlideData, ...parentLayoutSlide.children[slideId] }
                        }

                        // If child doesn't have its own background, inherit from parent
                        if (!layoutSlideData.background && parentLayoutSlide.background) {
                            layoutSlideData.background = parentLayoutSlide.background
                        }

                        break
                    }
                }
            }

            // If layout slide exists but has no background, check if layout has a global background
            if (layoutSlideData && !layoutSlideData.background && (layout as any).background) {
                layoutSlideData.background = (layout as any).background
            }

            // If not found by ID, try to find by index or other methods
            if (!layoutSlideData && layout.slides) {
                // Try finding by index
                const slideKeys = Object.keys(showData.slides || {})
                const slideIndex = slideKeys.indexOf(slideId)
                if (slideIndex !== -1 && layout.slides[slideIndex]) {
                    layoutSlideData = layout.slides[slideIndex]
                }

                // If still not found, check if there's a default background for all slides
                if (!layoutSlideData && (layout as any).background) {
                    layoutSlideData = { background: (layout as any).background }
                }
            }

            // If we have a layout slide but no background, try to use the first available media as background
            if (layoutSlideData && !layoutSlideData.background && showData.media) {
                const mediaKeys = Object.keys(showData.media)
                if (mediaKeys.length > 0) {
                    layoutSlideData.background = mediaKeys[0]
                }
            }
        } else {
            // Check if there's a global background in show settings
            if ((showData.settings as any)?.background) {
                layoutSlideData = { background: (showData.settings as any).background }
            }

            // If no layout and no show background, try to use the first available media
            if (!layoutSlideData && showData.media) {
                const mediaKeys = Object.keys(showData.media)
                if (mediaKeys.length > 0) {
                    layoutSlideData = { background: mediaKeys[0] }
                }
            }
        }

        // Also check if the slide itself has a background property
        if (!layoutSlideData && (slideData as any)?.background) {
            layoutSlideData = { background: (slideData as any).background }
        }

        const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId, layoutSlideData)
        res.send(htmlResponse)
    } catch (error) {
        console.error("Error processing show/slide for HTML generation:", error)
        res.status(500).send("Error generating slide HTML")
    }
}

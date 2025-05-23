import type { Request, Response } from "express";
import path from "path";
import { app as electronApp } from "electron";
import { stores } from "../data/store";
import { readFile } from "./files";
import type { TrimmedShow, Show, Slide } from '../../types/Show';
import type { Media as ItemMedia } from '../../types/Show';
import crypto from "crypto";

// Media registry to track allowed media files
const mediaRegistry = new Map<string, string>(); // token -> filePath

// Helper function to register media file and get secure token
function registerMediaFile(filePath: string): string {
    if (!filePath) return "";

    // If it's already a URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
        return filePath;
    }

    // Check if this file is already registered
    for (const [token, registeredPath] of mediaRegistry.entries()) {
        if (registeredPath === filePath) {
            return `http://localhost:5511/media/${token}`;
        }
    }

    // Generate a secure token for this file
    const token = crypto.randomBytes(32).toString('hex');
    mediaRegistry.set(token, filePath);

    console.log("REGISTERED MEDIA FILE:", filePath, "->", token);

    return `http://localhost:5511/media/${token}`;
}

// Helper function to get file path from token (for the server)
export function getMediaFileFromToken(token: string): string | null {
    return mediaRegistry.get(token) || null;
}

// Helper function to convert local file path to HTTP URL
function getMediaUrl(filePath: string): string {
    return registerMediaFile(filePath);
}

export function generateSlideHtmlResponse(showData: Show, slideData: Slide, showId: string, slideId: string, layoutSlideData?: any): string {
    const showName = showData.name || showId;
    let html = `<!DOCTYPE html><html><head><title>Show - ${showName} - Slide ${slideId}</title>`;
    let styles = `
        body { 
            margin: 0; 
            padding: 0; 
            width: 100vw; 
            height: 100vh; 
            overflow: hidden; 
            font-family: sans-serif; 
        } 
        .slide-item { 
            box-sizing: border-box; 
            position: absolute;
        }
        .text-item {
            color: white;
            font-size: 100px;
            line-height: 1.1;
            text-shadow: 2px 2px 10px #000000;
            font-family: "CMGSans", sans-serif;
        }
        .media-item {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .background-media {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
        }
        .background-media img,
        .background-media video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
    `;
    let bodyContent = "";

    let slideContainerStyle = "position: relative; width: 100%; height: 100%;";

    // Handle background media from layout data
    let backgroundMediaHtml = "";
    if (layoutSlideData?.background && showData.media?.[layoutSlideData.background]) {
        const backgroundMedia = showData.media[layoutSlideData.background];
        const backgroundPath = backgroundMedia.path || backgroundMedia.id || "";

        if (backgroundPath) {
            console.log("BACKGROUND MEDIA FOUND:", backgroundMedia);
            const mediaUrl = getMediaUrl(backgroundPath);
            const isImage = backgroundPath.endsWith(".png") || backgroundPath.endsWith(".jpg") || backgroundPath.endsWith(".jpeg") || backgroundPath.endsWith(".gif") || backgroundPath.endsWith(".webp");
            const isVideo = backgroundPath.endsWith(".mp4") || backgroundPath.endsWith(".webm") || backgroundPath.endsWith(".ogv");

            if (isImage) {
                backgroundMediaHtml = `<div class="background-media"><img src="${mediaUrl}" alt="Background Image"></div>`;
            } else if (isVideo) {
                const muted = backgroundMedia.muted !== false ? "muted" : "";
                const loop = backgroundMedia.loop !== false ? "loop" : "";
                backgroundMediaHtml = `<div class="background-media"><video src="${mediaUrl}" ${muted} ${loop} autoplay></video></div>`;
            }
        }
    }

    // Handle slide background color
    if (slideData.settings?.color) {
        slideContainerStyle += `background-color: ${slideData.settings.color};`;
    } else if (!backgroundMediaHtml) {
        slideContainerStyle += `background-color: #000000;`; // Default black background only if no media
    }

    styles += ` .slide-container { ${slideContainerStyle} }`;

    if (slideData.items) {
        console.log("SLIDE ITEMS:", JSON.stringify(slideData.items, null, 2));
        for (const item of slideData.items) {
            console.log("PROCESSING ITEM:", JSON.stringify(item, null, 2));
            let itemStyle = "position: absolute;";

            // Apply the item's style property which contains positioning and other CSS
            if (item.style) {
                itemStyle += item.style;
            }

            // Add default positioning if not specified in style
            if (!item.style || (!item.style.includes('left:') && !item.style.includes('left '))) {
                itemStyle += "left: 50px;";
            }
            if (!item.style || (!item.style.includes('top:') && !item.style.includes('top '))) {
                itemStyle += "top: 50px;";
            }
            if (!item.style || (!item.style.includes('width:') && !item.style.includes('width '))) {
                itemStyle += "width: 400px;";
            }
            if (!item.style || (!item.style.includes('height:') && !item.style.includes('height '))) {
                itemStyle += "height: 150px;";
            }

            if (item.align) {
                itemStyle += `text-align: ${item.align};`;
            }

            if (item.type === "text" && item.lines) {
                bodyContent += `<div class="slide-item text-item" style="${itemStyle}">`;
                let currentText = "";
                for (const line of item.lines) {
                    for (const textSegment of line.text) {
                        currentText += textSegment.value;
                    }
                    currentText += "<br>";
                }
                if (currentText.endsWith("<br>")) {
                    currentText = currentText.substring(0, currentText.length - 4);
                }
                bodyContent += `<div>${currentText}</div></div>`;
            } else if (item.type === "media" && (item.src || item.media)) {
                const mediaObject = item.media as ItemMedia | undefined;
                const pathValue = item.src ?? mediaObject?.path ?? "";
                const fitMode = item.fit ?? 'contain';

                if (pathValue) {
                    const mediaUrl = getMediaUrl(pathValue);
                    bodyContent += `<div class="slide-item media-item" style="${itemStyle}">`;
                    const isImage = item.type === "media" && (pathValue.endsWith(".png") || pathValue.endsWith(".jpg") || pathValue.endsWith(".jpeg") || pathValue.endsWith(".gif") || pathValue.endsWith(".webp"));
                    const isVideo = item.type === "media" && (pathValue.endsWith(".mp4") || pathValue.endsWith(".webm") || pathValue.endsWith(".ogv"));

                    if (isImage) {
                        bodyContent += `<img src="${mediaUrl}" alt="Slide Image" style="width: 100%; height: 100%; object-fit: ${fitMode};">`;
                    } else if (isVideo) {
                        bodyContent += `<video src="${mediaUrl}" controls style="width: 100%; height: 100%; object-fit: ${fitMode};"></video>`;
                    }
                    bodyContent += `</div>`;
                }
            }
        }
    }

    html += `<style>${styles}</style></head><body><div class="slide-container">${backgroundMediaHtml}${bodyContent}</div></body></html>`;
    return html;
}

// New handleShowSlideHtmlRequest function
export async function handleShowSlideHtmlRequest(req: Request, res: Response): Promise<void> {
    const { showId, slideId } = req.params;

    try {
        const trimmedShow = stores.SHOWS.get(showId) as TrimmedShow | undefined;

        if (!trimmedShow) {
            res.status(404).send(`Show metadata not found for ID: ${showId}`);
            return;
        }

        const showNameFromStore = trimmedShow.name;
        if (!showNameFromStore || showNameFromStore.trim() === "") {
            console.error(`Show name for ID ${showId} is empty.`);
            res.status(404).send(`Show name is empty for ID: ${showId}`);
            return;
        }

        const showFileName = showNameFromStore + ".show";

        let showsPath = stores.SETTINGS.get("showsPath") as string | undefined;
        if (!showsPath) {
            showsPath = path.join(electronApp.getPath("userData"), "Shows");
        }
        const showFilePath = path.join(showsPath, showFileName);

        console.log("SHOW FILE PATH", showFilePath);
        const fileContent = readFile(showFilePath);
        if (!fileContent) {
            res.status(404).send(`Show file ${showFileName} not found or is empty`);
            return;
        }

        let showData: Show;
        try {
            const parsedData = JSON.parse(fileContent);
            // Handle case where showData is an array [showId, showObject]
            if (Array.isArray(parsedData) && parsedData.length >= 2) {
                showData = parsedData[1] as Show;
            } else {
                showData = parsedData as Show;
            }
        } catch (parseError) {
            console.error(`Error parsing show file ${showFilePath}:`, parseError);
            res.status(500).send("Error parsing show data");
            return;
        }

        console.log("SHOW DATA", showData);
        console.log("FILE CONTENT", fileContent);

        console.log("SLIDES ARE", showData.slides);

        const slideData = showData.slides[slideId] as Slide | undefined;

        if (!slideData) {
            console.error(`Slide data not found for slideId: ${slideId}. Available keys: ${Object.keys(showData.slides || {}).join(', ')}`);
            res.status(404).send(`Slide not found in show for ID: ${slideId}`);
            return;
        }

        // Get layout data to find background media
        const activeLayoutId = showData.settings?.activeLayout;
        let layoutSlideData: any = undefined;

        if (activeLayoutId && showData.layouts?.[activeLayoutId]) {
            const layout = showData.layouts[activeLayoutId];
            console.log("ACTIVE LAYOUT:", layout);

            // Find the layout slide that corresponds to our slideId
            layoutSlideData = layout.slides?.find((layoutSlide: any) => layoutSlide.id === slideId);
            console.log("LAYOUT SLIDE DATA:", layoutSlideData);
        }

        const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId, layoutSlideData);
        res.send(htmlResponse);
    } catch (error) {
        console.error("Error processing show/slide for HTML generation:", error);
        res.status(500).send("Error generating slide HTML");
    }
}

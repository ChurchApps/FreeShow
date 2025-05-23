import type { Request, Response } from "express";
import path from "path";
import { app as electronApp } from "electron";
import { stores } from "../data/store";
import { readFile } from "./files";
import type { TrimmedShow, Show, Slide } from '../../types/Show';
import type { Media as ItemMedia } from '../../types/Show';

export function generateSlideHtmlResponse(showData: Show, slideData: Slide, showId: string, slideId: string): string {
    const showName = showData.name || showId;
    let html = `<!DOCTYPE html><html><head><title>Show - ${showName} - Slide ${slideId}</title>`;
    let styles = `body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; font-family: sans-serif; } .slide-item { box-sizing: border-box; border: 1px solid #eee; /* Light border for visibility */ } `;
    let bodyContent = "";

    let slideContainerStyle = "position: relative; width: 100%; height: 100%;";

    if (slideData.settings?.color) {
        slideContainerStyle += `background-color: ${slideData.settings.color};`;
    } else {
        slideContainerStyle += `background-color: #000000;`; // Default black background
    }
    styles += ` .slide-container { ${slideContainerStyle} }`;

    if (slideData.items) {
        for (const item of slideData.items) {
            let itemStyle = "position: absolute;";

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
                    bodyContent += `<div class="slide-item media-item" style="${itemStyle}">`;
                    const isImage = item.type === "media" && (pathValue.endsWith(".png") || pathValue.endsWith(".jpg") || pathValue.endsWith(".jpeg") || pathValue.endsWith(".gif") || pathValue.endsWith(".webp"));
                    const isVideo = item.type === "media" && (pathValue.endsWith(".mp4") || pathValue.endsWith(".webm") || pathValue.endsWith(".ogv"));

                    if (isImage) {
                        bodyContent += `<img src="${pathValue}" alt="Slide Image" style="width: 100%; height: 100%; object-fit: ${fitMode};">`;
                    } else if (isVideo) {
                        bodyContent += `<video src="${pathValue}" controls style="width: 100%; height: 100%; object-fit: ${fitMode};"></video>`;
                    }
                    bodyContent += `</div>`;
                }
            }
        }
    }

    html += `<style>${styles}</style></head><body><div class="slide-container">${bodyContent}</div></body></html>`;
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

        const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId);
        res.send(htmlResponse);
    } catch (error) {
        console.error("Error processing show/slide for HTML generation:", error);
        res.status(500).send("Error generating slide HTML");
    }
}

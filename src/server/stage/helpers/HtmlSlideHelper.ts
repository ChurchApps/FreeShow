import type { Request, Response } from "express";
import path from "path";
import { app as electronApp } from "electron";
import { stores } from "../../../electron/data/store";
import { readFile } from "../../../electron/utils/files";
import type { TrimmedShow, Show, Slide } from '../../../types/Show';
import type { Media as ItemMedia } from '../../../types/Show';
import { getMediaUrl } from './MediaHelper';

export function generateSlideHtmlResponse(showData: Show, slideData: Slide, showId: string, slideId: string, layoutSlideData?: any): string {
    const showName = showData.name || showId;
    let html = `<!DOCTYPE html><html><head><title>Show - ${showName} - Slide ${slideId}</title>`;

    // Get all slide IDs for navigation
    const slideIds = Object.keys(showData.slides || {});
    const currentSlideIndex = slideIds.indexOf(slideId);

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
            z-index: 10;
        }
        .text-item {
            color: white;
            font-size: 100px;
            line-height: 1.1;
            text-shadow: 3px 3px 0px #000000, -1px -1px 0px #000000, 1px -1px 0px #000000, -1px 1px 0px #000000, 0px 0px 10px #000000;
            font-family: "CMGSans", sans-serif;
            z-index: 20;
            font-weight: bold;
        }
        .media-item {
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 15;
        }
        .background-media {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            background-color: #000000;
        }
        .background-media img,
        .background-media video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    `;

    // Add JavaScript for navigation
    const navigationScript = `
        <script>
            const showId = '${showId}';
            const slideIds = ${JSON.stringify(slideIds)};
            let currentIndex = ${currentSlideIndex};
            
            // Function to fetch slide content via AJAX
            async function loadSlideContent(slideId) {
                try {
                    const response = await fetch(\`/show/\${showId}/\${slideId}\`);
                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }
                    const html = await response.text();
                    
                    // Parse the HTML to extract just the slide content
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newSlideContainer = doc.querySelector('.slide-container');
                    
                    if (newSlideContainer) {
                        return newSlideContainer.innerHTML;
                    }
                    return null;
                } catch (error) {
                    return null;
                }
            }
            
            // Function to update slide content while preserving background video
            async function updateSlideContent(newSlideId, newIndex) {
                const slideContainer = document.querySelector('.slide-container');
                if (!slideContainer) return;
                
                // Get current background video element and its state
                const currentVideo = document.querySelector('.background-media video');
                let preserveVideo = false;
                let videoState = null;
                
                if (currentVideo) {
                    videoState = {
                        src: currentVideo.src,
                        currentTime: currentVideo.currentTime,
                        paused: currentVideo.paused,
                        muted: currentVideo.muted,
                        loop: currentVideo.loop,
                        volume: currentVideo.volume
                    };
                }
                
                // Load new slide content
                const newContent = await loadSlideContent(newSlideId);
                if (!newContent) {
                    return;
                }
                
                // Parse the new content to check if it has the same video
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newContent;
                const newVideoElement = tempDiv.querySelector('.background-media video');
                
                // Check if the new slide has the same video source
                if (currentVideo && newVideoElement && currentVideo.src === newVideoElement.src) {
                    preserveVideo = true;
                    
                    // Remove only the non-video content, keep the video playing
                    const currentBackgroundMedia = document.querySelector('.background-media');
                    const slideItems = document.querySelectorAll('.slide-item');
                    
                    // Remove old slide items
                    slideItems.forEach(item => item.remove());
                    
                    // Add new slide items from the new content
                    const newSlideItems = tempDiv.querySelectorAll('.slide-item');
                    newSlideItems.forEach(item => {
                        slideContainer.appendChild(item.cloneNode(true));
                    });
                    
                } else {
                    // Different video or no current video - replace all content
                    slideContainer.innerHTML = newContent;
                    
                    // Start the new video if it exists
                    const newVideo = document.querySelector('.background-media video');
                    if (newVideo) {
                        newVideo.play().catch(err => {});
                    }
                }
                
                // Update current index and navigation info
                currentIndex = newIndex;
                
                // Update browser URL without page reload
                const newUrl = \`/show/\${showId}/\${newSlideId}\`;
                window.history.pushState({slideId: newSlideId, index: newIndex}, '', newUrl);
            }
            
            function navigateToSlide(direction) {
                const newIndex = currentIndex + direction;
                if (newIndex >= 0 && newIndex < slideIds.length) {
                    const newSlideId = slideIds[newIndex];
                    updateSlideContent(newSlideId, newIndex);
                }
            }
            
            function jumpToSlide(index) {
                if (index >= 0 && index < slideIds.length) {
                    const newSlideId = slideIds[index];
                    updateSlideContent(newSlideId, index);
                }
            }
            
            document.addEventListener('keydown', function(event) {
                switch(event.key) {
                    case 'ArrowLeft':
                        event.preventDefault();
                        navigateToSlide(-1);
                        break;
                    case 'ArrowRight':
                        event.preventDefault();
                        navigateToSlide(1);
                        break;
                    case 'Home':
                        event.preventDefault();
                        jumpToSlide(0);
                        break;
                    case 'End':
                        event.preventDefault();
                        jumpToSlide(slideIds.length - 1);
                        break;
                }
            });
            
            // Handle browser back/forward buttons
            window.addEventListener('popstate', function(event) {
                if (event.state && event.state.slideId) {
                    const slideIndex = slideIds.indexOf(event.state.slideId);
                    if (slideIndex !== -1) {
                        updateSlideContent(event.state.slideId, slideIndex);
                    }
                }
            });
            
            // Initialize history state
            document.addEventListener('DOMContentLoaded', function() {
                // Set initial history state
                window.history.replaceState({slideId: '${slideId}', index: currentIndex}, '', window.location.href);
            });
        </script>
    `;

    let bodyContent = "";

    let slideContainerStyle = "position: relative; width: 100%; height: 100%; z-index: 0;";

    // Handle background media from layout data
    let backgroundMediaHtml = "";
    if (layoutSlideData?.background && showData.media?.[layoutSlideData.background]) {
        const backgroundMedia = showData.media[layoutSlideData.background];
        const backgroundPath = backgroundMedia.path || backgroundMedia.id || "";

        if (backgroundPath) {
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
        for (const item of slideData.items) {
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

            if (item.lines) {
                // This is a text item - ensure it appears above background media
                if (!itemStyle.includes('z-index')) {
                    itemStyle += "z-index: 100;";
                }
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

    html += `<style>${styles}</style>${navigationScript}</head><body><div class="slide-container">${backgroundMediaHtml}${bodyContent}</div></body></html>`;
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
            res.status(404).send(`Show name is empty for ID: ${showId}`);
            return;
        }

        const showFileName = showNameFromStore + ".show";

        let showsPath = stores.SETTINGS.get("showsPath") as string | undefined;
        if (!showsPath) {
            showsPath = path.join(electronApp.getPath("userData"), "Shows");
        }
        const showFilePath = path.join(showsPath, showFileName);

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
            res.status(500).send("Error parsing show data");
            return;
        }

        const slideData = showData.slides[slideId] as Slide | undefined;

        if (!slideData) {
            res.status(404).send(`Slide not found in show for ID: ${slideId}`);
            return;
        }

        // Get layout data to find background media
        const activeLayoutId = showData.settings?.activeLayout;
        let layoutSlideData: any = undefined;

        if (activeLayoutId && showData.layouts?.[activeLayoutId]) {
            const layout = showData.layouts[activeLayoutId];

            // Find the layout slide that corresponds to our slideId
            layoutSlideData = layout.slides?.find((layoutSlide: any) => layoutSlide.id === slideId);

            // If layout slide exists but has no background, check if layout has a global background
            if (layoutSlideData && !layoutSlideData.background && (layout as any).background) {
                layoutSlideData.background = (layout as any).background;
            }

            // If not found by ID, try to find by index or other methods
            if (!layoutSlideData && layout.slides) {
                // Try finding by index
                const slideKeys = Object.keys(showData.slides || {});
                const slideIndex = slideKeys.indexOf(slideId);
                if (slideIndex !== -1 && layout.slides[slideIndex]) {
                    layoutSlideData = layout.slides[slideIndex];
                }

                // If still not found, check if there's a default background for all slides
                if (!layoutSlideData && (layout as any).background) {
                    layoutSlideData = { background: (layout as any).background };
                }
            }

            // If we have a layout slide but no background, try to use the first available media as background
            if (layoutSlideData && !layoutSlideData.background && showData.media) {
                const mediaKeys = Object.keys(showData.media);
                if (mediaKeys.length > 0) {
                    layoutSlideData.background = mediaKeys[0];
                }
            }
        } else {
            // Check if there's a global background in show settings
            if ((showData.settings as any)?.background) {
                layoutSlideData = { background: (showData.settings as any).background };
            }

            // If no layout and no show background, try to use the first available media
            if (!layoutSlideData && showData.media) {
                const mediaKeys = Object.keys(showData.media);
                if (mediaKeys.length > 0) {
                    layoutSlideData = { background: mediaKeys[0] };
                }
            }
        }

        // Also check if the slide itself has a background property
        if (!layoutSlideData && (slideData as any)?.background) {
            layoutSlideData = { background: (slideData as any).background };
        }

        const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId, layoutSlideData);
        res.send(htmlResponse);
    } catch (error) {
        console.error("Error processing show/slide for HTML generation:", error);
        res.status(500).send("Error generating slide HTML");
    }
} 
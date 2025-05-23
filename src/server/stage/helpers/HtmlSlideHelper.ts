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
        .navigation-info {
            position: fixed;
            bottom: 20px;
            right: 20px;
            color: white;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1000;
            font-family: monospace;
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
                    console.error('Error loading slide content:', error);
                    return null;
                }
            }
            
            // Function to update slide content while preserving background video
            async function updateSlideContent(newSlideId, newIndex) {
                const slideContainer = document.querySelector('.slide-container');
                if (!slideContainer) return;
                
                // Get current background video element and its state
                const currentVideo = document.querySelector('.background-media video');
                let videoElement = null;
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
                    // Keep reference to the actual video element
                    videoElement = currentVideo.cloneNode(true);
                }
                
                // Load new slide content
                const newContent = await loadSlideContent(newSlideId);
                if (!newContent) {
                    console.error('Failed to load slide content');
                    return;
                }
                
                // Update the slide container with new content
                slideContainer.innerHTML = newContent;
                
                // Check if new slide has the same background video
                const newVideo = document.querySelector('.background-media video');
                if (newVideo && videoState && newVideo.src === videoState.src) {
                    // Same video - restore the playing video element
                    console.log('Same background video detected, preserving playback');
                    newVideo.currentTime = videoState.currentTime;
                    newVideo.muted = videoState.muted;
                    newVideo.loop = videoState.loop;
                    newVideo.volume = videoState.volume;
                    
                    if (!videoState.paused) {
                        newVideo.play().catch(err => console.error('Error resuming video:', err));
                    }
                } else if (newVideo) {
                    // Different video - let it start fresh
                    console.log('Different background video, starting fresh');
                    newVideo.play().catch(err => console.error('Error starting new video:', err));
                }
                
                // Update current index and navigation info
                currentIndex = newIndex;
                updateNavigationInfo();
                
                // Update browser URL without page reload
                const newUrl = \`/show/\${showId}/\${newSlideId}\`;
                window.history.pushState({slideId: newSlideId, index: newIndex}, '', newUrl);
                
                console.log(\`Loaded slide \${newIndex + 1} (\${newSlideId}) dynamically\`);
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
            
            // Update navigation info
            function updateNavigationInfo() {
                const info = document.querySelector('.navigation-info');
                if (info) {
                    info.innerHTML = \`Slide \${currentIndex + 1} of \${slideIds.length}<br>← → to navigate\`;
                }
            }
            
            // Initialize navigation info and set initial history state
            document.addEventListener('DOMContentLoaded', function() {
                updateNavigationInfo();
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

        console.log("SLIDE ID:", slideId);
        console.log("LAYOUT SLIDE DATA:", layoutSlideData);
        console.log("BACKGROUND MEDIA FOUND:", backgroundMedia);
        console.log("BACKGROUND PATH:", backgroundPath);

        if (backgroundPath) {
            const mediaUrl = getMediaUrl(backgroundPath);
            console.log("MEDIA URL:", mediaUrl);
            const isImage = backgroundPath.endsWith(".png") || backgroundPath.endsWith(".jpg") || backgroundPath.endsWith(".jpeg") || backgroundPath.endsWith(".gif") || backgroundPath.endsWith(".webp");
            const isVideo = backgroundPath.endsWith(".mp4") || backgroundPath.endsWith(".webm") || backgroundPath.endsWith(".ogv");

            if (isImage) {
                backgroundMediaHtml = `<div class="background-media"><img src="${mediaUrl}" alt="Background Image"></div>`;
                console.log("GENERATED BACKGROUND IMAGE HTML");
            } else if (isVideo) {
                const muted = backgroundMedia.muted !== false ? "muted" : "";
                const loop = backgroundMedia.loop !== false ? "loop" : "";
                backgroundMediaHtml = `<div class="background-media"><video src="${mediaUrl}" ${muted} ${loop} autoplay></video></div>`;
                console.log("GENERATED BACKGROUND VIDEO HTML:", backgroundMediaHtml);
            }
        }
    } else {
        console.log("NO BACKGROUND MEDIA - SLIDE ID:", slideId);
        console.log("LAYOUT SLIDE DATA:", layoutSlideData);
        console.log("SHOW MEDIA:", Object.keys(showData.media || {}));
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

    html += `<style>${styles}</style>${navigationScript}</head><body><div class="slide-container">${backgroundMediaHtml}${bodyContent}</div><div class="navigation-info"></div></body></html>`;
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
        console.log("CURRENT SLIDE DATA:", showData.slides[slideId] as Slide | undefined);
        console.log("SLIDE SETTINGS:", showData.slides[slideId]?.settings);
        console.log("SLIDE BACKGROUND:", (showData.slides[slideId] as any)?.background);

        const slideData = showData.slides[slideId] as Slide | undefined;

        if (!slideData) {
            console.error(`Slide data not found for slideId: ${slideId}. Available keys: ${Object.keys(showData.slides || {}).join(', ')}`);
            res.status(404).send(`Slide not found in show for ID: ${slideId}`);
            return;
        }

        // Get layout data to find background media
        const activeLayoutId = showData.settings?.activeLayout;
        let layoutSlideData: any = undefined;

        console.log("ACTIVE LAYOUT ID:", activeLayoutId);
        console.log("AVAILABLE LAYOUTS:", Object.keys(showData.layouts || {}));

        if (activeLayoutId && showData.layouts?.[activeLayoutId]) {
            const layout = showData.layouts[activeLayoutId];
            console.log("ACTIVE LAYOUT:", layout);
            console.log("LAYOUT SLIDES:", layout.slides);

            // Find the layout slide that corresponds to our slideId
            layoutSlideData = layout.slides?.find((layoutSlide: any) => layoutSlide.id === slideId);
            console.log("LAYOUT SLIDE DATA FOR", slideId, ":", layoutSlideData);

            // If layout slide exists but has no background, check if layout has a global background
            if (layoutSlideData && !layoutSlideData.background && (layout as any).background) {
                layoutSlideData.background = (layout as any).background;
                console.log("Applied layout global background to slide:", layoutSlideData);
            }

            // If not found by ID, try to find by index or other methods
            if (!layoutSlideData && layout.slides) {
                console.log("Layout slide not found by ID, trying alternative methods...");

                // Try finding by index
                const slideKeys = Object.keys(showData.slides || {});
                const slideIndex = slideKeys.indexOf(slideId);
                if (slideIndex !== -1 && layout.slides[slideIndex]) {
                    layoutSlideData = layout.slides[slideIndex];
                    console.log("Found layout slide by index:", layoutSlideData);
                }

                // If still not found, check if there's a default background for all slides
                if (!layoutSlideData && (layout as any).background) {
                    layoutSlideData = { background: (layout as any).background };
                    console.log("Using layout default background:", layoutSlideData);
                }
            }

            // If we have a layout slide but no background, try to use the first available media as background
            if (layoutSlideData && !layoutSlideData.background && showData.media) {
                const mediaKeys = Object.keys(showData.media);
                if (mediaKeys.length > 0) {
                    layoutSlideData.background = mediaKeys[0];
                    console.log("Using first available media as background:", mediaKeys[0]);
                }
            }
        } else {
            console.log("NO ACTIVE LAYOUT FOUND");

            // Check if there's a global background in show settings
            if ((showData.settings as any)?.background) {
                layoutSlideData = { background: (showData.settings as any).background };
                console.log("Using show default background:", layoutSlideData);
            }

            // If no layout and no show background, try to use the first available media
            if (!layoutSlideData && showData.media) {
                const mediaKeys = Object.keys(showData.media);
                if (mediaKeys.length > 0) {
                    layoutSlideData = { background: mediaKeys[0] };
                    console.log("Using first available media as fallback background:", mediaKeys[0]);
                }
            }
        }

        // Also check if the slide itself has a background property
        if (!layoutSlideData && (slideData as any)?.background) {
            layoutSlideData = { background: (slideData as any).background };
            console.log("Using slide's own background:", layoutSlideData);
        }

        const htmlResponse = generateSlideHtmlResponse(showData, slideData, showId, slideId, layoutSlideData);
        res.send(htmlResponse);
    } catch (error) {
        console.error("Error processing show/slide for HTML generation:", error);
        res.status(500).send("Error generating slide HTML");
    }
} 
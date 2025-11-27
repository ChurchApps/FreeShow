// Slide navigation and timer functionality for FreeShow stage server
// This script handles keyboard navigation, slide transitions, and auto-advance timers

// Global variables - these will be set by the HTML page
let showId, slideIds, currentIndex, nextTimer

// Timer management - simplified to just auto-advance
let slideTimer = null

// Cache for slide content to avoid repeated requests
const slideContentCache = new Map()

// Initialize the navigation system with data from the HTML page
function initializeNavigation(config) {
    showId = config.showId
    slideIds = config.slideIds
    currentIndex = config.currentIndex
    nextTimer = config.nextTimer
}

// Simple timer function - just auto-advance after duration
function startSlideTimer() {
    if (nextTimer <= 0) return

    clearSlideTimer()

    slideTimer = setTimeout(() => {
        // Timer ended - advance to next slide (matching desktop app behavior)
        navigateToSlide(1)
    }, nextTimer * 1000)
}

function clearSlideTimer() {
    if (slideTimer) {
        clearTimeout(slideTimer)
        slideTimer = null
    }
}

// Function to fetch slide content via AJAX
async function loadSlideContent(slideId) {
    // Check cache first
    if (slideContentCache.has(slideId)) {
        return slideContentCache.get(slideId)
    }

    try {
        const response = await fetch(`/show/${showId}/${slideId}`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const html = await response.text()

        // Parse the HTML to extract just the slide content
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, "text/html")
        const newSlideContainer = doc.querySelector(".slide-container")

        if (newSlideContainer) {
            const content = newSlideContainer.innerHTML
            // Cache the content
            slideContentCache.set(slideId, content)
            return content
        }
        return null
    } catch (error) {
        return null
    }
}

// Preload adjacent slides for smoother navigation
function preloadAdjacentSlides() {
    const preloadIndexes = [currentIndex - 1, currentIndex + 1]
    preloadIndexes.forEach(index => {
        if (index >= 0 && index < slideIds.length) {
            const slideId = slideIds[index]
            if (!slideContentCache.has(slideId)) {
                loadSlideContent(slideId) // Fire and forget
            }
        }
    })
}

// Function to update slide content while preserving background video
async function updateSlideContent(newSlideId, newIndex) {
    const slideContainer = document.querySelector(".slide-container")
    if (!slideContainer) return

    // Clear any existing timer when changing slides
    clearSlideTimer()

    // Get current background video element and its state
    const currentVideo = document.querySelector(".background-media video")
    let videoState = null

    if (currentVideo) {
        videoState = {
            src: currentVideo.src,
            currentTime: currentVideo.currentTime,
            paused: currentVideo.paused,
            muted: currentVideo.muted,
            loop: currentVideo.loop,
            volume: currentVideo.volume
        }
    }

    // Load new slide content
    const newContent = await loadSlideContent(newSlideId)
    if (!newContent) {
        return
    }

    // Parse the new content to check if it has the same video
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = newContent
    const newVideoElement = tempDiv.querySelector(".background-media video")

    // Check if the new slide has the same video source
    if (currentVideo && newVideoElement && currentVideo.src === newVideoElement.src) {
        // Remove only the non-video content, keep the video playing
        const slideItems = document.querySelectorAll(".slide-item")

        // Remove old slide items
        slideItems.forEach(item => item.remove())

        // Add new slide items from the new content
        const newSlideItems = tempDiv.querySelectorAll(".slide-item")
        newSlideItems.forEach(item => {
            slideContainer.appendChild(item.cloneNode(true))
        })
    } else {
        // Different video or no current video - replace all content
        slideContainer.innerHTML = newContent

        // Start the new video if it exists and restore state if same video
        const newVideo = document.querySelector(".background-media video")
        if (newVideo) {
            // If it's the same video source, try to restore playback position
            if (videoState && newVideo.src === videoState.src) {
                newVideo.currentTime = videoState.currentTime
                newVideo.muted = videoState.muted
                newVideo.volume = videoState.volume
                if (!videoState.paused) {
                    newVideo.play().catch(err => {})
                }
            } else {
                newVideo.play().catch(err => {})
            }
        }
    }

    // Update current index and navigation info
    currentIndex = newIndex

    // Update browser URL without page reload
    const newUrl = `/show/${showId}/${newSlideId}`
    window.history.pushState(
        {
            slideId: newSlideId,
            index: newIndex
        },
        "",
        newUrl
    )

    // Preload adjacent slides
    setTimeout(preloadAdjacentSlides, 100)

    // Start timer for new slide if it has nextTimer configured
    fetchSlideTimerInfo(newSlideId).then(timerDuration => {
        if (timerDuration > 0) {
            // Update the global timer duration for the new slide
            nextTimer = timerDuration
            // Use the proper startSlideTimer function
            startSlideTimer()
        }
    })
}

// Function to fetch timer info for a specific slide
async function fetchSlideTimerInfo(slideId) {
    try {
        // We'll extract timer info from the slide HTML response
        const response = await fetch(`/show/${showId}/${slideId}`)
        if (!response.ok) return 0

        const html = await response.text()

        // Extract nextTimer value from the initializeNavigation call
        const timerMatch = html.match(/nextTimer:\s*(\d+(?:\.\d+)?)/)
        return timerMatch ? parseFloat(timerMatch[1]) : 0
    } catch (error) {
        return 0
    }
}

function navigateToSlide(direction) {
    const newIndex = currentIndex + direction
    if (newIndex >= 0 && newIndex < slideIds.length) {
        const newSlideId = slideIds[newIndex]
        updateSlideContent(newSlideId, newIndex)
    }
}

function jumpToSlide(index) {
    if (index >= 0 && index < slideIds.length) {
        const newSlideId = slideIds[index]
        updateSlideContent(newSlideId, index)
    }
}

// Event listeners
document.addEventListener("keydown", function (event) {
    switch (event.key) {
        case "ArrowLeft":
            event.preventDefault()
            navigateToSlide(-1)
            break
        case "ArrowRight":
            event.preventDefault()
            navigateToSlide(1)
            break
        case "Home":
            event.preventDefault()
            jumpToSlide(0)
            break
        case "End":
            event.preventDefault()
            jumpToSlide(slideIds.length - 1)
            break
    }
})

// Handle browser back/forward buttons
window.addEventListener("popstate", function (event) {
    if (event.state && event.state.slideId) {
        const slideIndex = slideIds.indexOf(event.state.slideId)
        if (slideIndex !== -1) {
            updateSlideContent(event.state.slideId, slideIndex)
        }
    }
})

// Initialize history state and preload adjacent slides
document.addEventListener("DOMContentLoaded", function () {
    // Set initial history state
    window.history.replaceState(
        {
            slideId: slideIds[currentIndex],
            index: currentIndex
        },
        "",
        window.location.href
    )

    // Cache current slide content
    const slideContainer = document.querySelector(".slide-container")
    if (slideContainer) {
        slideContentCache.set(slideIds[currentIndex], slideContainer.innerHTML)
    }

    // Preload adjacent slides after a short delay
    setTimeout(preloadAdjacentSlides, 500)

    // Start timer for current slide if configured
    if (nextTimer > 0) {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
            startSlideTimer()
        }, 100)
    }
})

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
    clearSlideTimer()
})

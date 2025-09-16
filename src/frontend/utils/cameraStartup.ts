// Camera startup initialization
import { get } from "svelte/store"
import { cameraManager } from "../components/helpers/cameraManager"
import { special } from "../stores"
import { wait } from "./common"

export async function initializeCameraWarming() {
    // Wait a bit to ensure settings are loaded
    await wait(2000)
    
    const keepWarm = get(special).keepCamerasWarm
    if (!keepWarm) {
        console.info("Camera warming is disabled")
        return
    }

    try {
        console.info("Initializing camera warming...")
        await cameraManager.initializeCameraWarming()
    } catch (error) {
        console.error("Failed to initialize camera warming:", error)
    }
}

// Watch for setting changes to enable/disable camera warming
let settingsSubscription: any = null

export function startCameraWarmingSubscription() {
    // Clean up existing subscription
    if (settingsSubscription) {
        settingsSubscription()
        settingsSubscription = null
    }

    // Subscribe to special settings changes
    settingsSubscription = special.subscribe(async (settings) => {
        const keepWarm = settings.keepCamerasWarm
        
        try {
            await cameraManager.toggleCameraWarming(keepWarm)
        } catch (error) {
            console.error("Failed to toggle camera warming:", error)
        }
    })
}

export function stopCameraWarmingSubscription() {
    if (settingsSubscription) {
        settingsSubscription()
        settingsSubscription = null
    }
}
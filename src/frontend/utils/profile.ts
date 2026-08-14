import { get } from "svelte/store"
import type { SettingsTabs, TopViews } from "../../types/Tabs"
import { activeEdit, activeProfile, activeShow, drawerTabsData, focusMode, profiles, showChangeProfileMenu, shows, special } from "../stores"
import { runActionId } from "../components/actions/actions"
import { settingsTabs } from "../values/tabs"

export function getAccess(id: string) {
    return get(activeProfile) ? get(profiles)[get(activeProfile)!]?.access[id] || {} : {}
}

// these drawer tabs are hidden while in focus mode (used by Drawer.svelte as well)
export const hiddenInFocusMode = ["templates", "calendar"]

/** Mirrors the conditions Drawer.svelte uses to render a drawer tab button */
export function isDrawerTabAllowed(tabId: string) {
    if (get(drawerTabsData)[tabId]?.enabled === false) return false
    if (getAccess(tabId).global === "none") return false
    if (get(focusMode) && hiddenInFocusMode.includes(tabId)) return false
    return true
}

export function getAllowedSettingsTabs(): SettingsTabs[] {
    const access = getAccess("settings")
    return settingsTabs.filter((tabId) => access[tabId] !== "none")
}

/** Mirrors the conditions Top.svelte uses to render/enable a page button */
export function isPageAllowed(page: TopViews) {
    // Top.svelte hides settings entirely when more than 7 of the 9 tabs are restricted
    if (page === "settings") return Object.keys(getAccess("settings")).length <= 7

    if (page === "edit") {
        // editing a media/overlay/template item is always allowed
        const currentEdit = get(activeEdit)
        if (currentEdit?.id && (currentEdit.type || "show") !== "show") return true

        const currentShow = get(activeShow)
        if (currentShow && (currentShow.type || "show") === "show") {
            const show = get(shows)[currentShow.id || ""]
            const showAccess = getAccess("shows")
            return !(show?.locked || showAccess.global === "read" || showAccess[show?.category || ""] === "read")
        }

        // nothing (or a PDF) open means there is nothing to edit
        return !(currentShow?.type === "pdf" || !currentShow?.id)
    }

    return true
}

export function openProfileByName(profileName: string) {
    if (!profileName) return
    if (profileName.toLowerCase() === "admin") {
        activeProfile.set("")
        return
    }

    // find profile by name (case-insensitive)
    const normalizedName = profileName.toLowerCase()
    const profileId = Object.keys(get(profiles)).find((id) => (get(profiles)[id]?.name?.toString() || "").toLowerCase() === normalizedName)
    if (!profileId) return

    activeProfile.set(profileId)

    // run action
    const actionId = get(profiles)[profileId]?.action
    if (actionId) runActionId(actionId, "profile")
}

export function autoOpenLastUsedProfile() {
    if (!get(profiles).admin?.autoOpenLastUsed) return

    const lastUsedId = get(special).lastUsedProfile
    if (lastUsedId !== "" && (!lastUsedId || !get(profiles)[lastUsedId])) return

    activeProfile.set(lastUsedId)

    // NOTE: don't run action on auto open because this profile is already active

    showChangeProfileMenu.set(true)
    setTimeout(() => showChangeProfileMenu.set(false), 5000)
}

// doesn't need to be secure
export function encodePassword(password: string) {
    return encrypt(password)
}
export function checkPassword(password: string, encoded: string) {
    if (!password || !encoded) return false
    return encoded === encrypt(password)
}
const k = "bw46feskw4"
const encrypt = (text) => Array.from(text, (char: string, i) => ("0" + (char.charCodeAt(0) ^ k.charCodeAt(i % k.length)).toString(16)).slice(-2)).join("")

export function isGroupHidden(groupId: string): boolean {
    const profile = getAccess("groups")
    const currentLocalLevel = profile[groupId] || "write"
    const currentGlobalLevel = profile.global || "write"

    if (currentGlobalLevel === "none") return true
    return currentLocalLevel === "none"
}

import { describe, expect, it } from "vitest"
import { claimSlot, MAX_HIDDEN_WEBSITES, releaseSlot, type WebsiteSlots } from "./websitePool"

const element = () => ({}) as HTMLElement
const options = { navigation: false, slideControls: true }

describe("website pool", () => {
    it("keeps a released website loaded but hidden", () => {
        const el = element()
        let slots: WebsiteSlots = claimSlot({}, "https://a", el, options, 1)
        slots = releaseSlot(slots, "https://a", el, 2)
        expect(slots["https://a"]).toMatchObject({ element: null, lastUsed: 2, slideControls: true })
    })

    it("does not release a website another slide has claimed", () => {
        const oldEl = element()
        const newEl = element()
        let slots: WebsiteSlots = claimSlot({}, "https://a", oldEl, options, 1)
        slots = claimSlot(slots, "https://a", newEl, options, 2)
        slots = releaseSlot(slots, "https://a", oldEl, 3)
        expect(slots["https://a"].element).toBe(newEl)
    })

    it("unloads the least recently used hidden websites", () => {
        let slots: WebsiteSlots = {}
        for (let i = 0; i <= MAX_HIDDEN_WEBSITES; i++) {
            const el = element()
            slots = claimSlot(slots, `https://${i}`, el, options, i * 2)
            slots = releaseSlot(slots, `https://${i}`, el, i * 2 + 1)
        }
        expect(Object.keys(slots)).toHaveLength(MAX_HIDDEN_WEBSITES)
        expect(slots["https://0"]).toBeUndefined()
    })

    it("never unloads visible websites", () => {
        let slots: WebsiteSlots = claimSlot({}, "https://visible", element(), options, 0)
        for (let i = 0; i <= MAX_HIDDEN_WEBSITES; i++) {
            const el = element()
            slots = claimSlot(slots, `https://${i}`, el, options, i * 2 + 1)
            slots = releaseSlot(slots, `https://${i}`, el, i * 2 + 2)
        }
        expect(slots["https://visible"]).toBeDefined()
    })
})

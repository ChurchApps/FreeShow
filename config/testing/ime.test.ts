import { expect, test } from "@playwright/test"
import { clickSafe, createProject, delay, launchApp, type TestApp } from "./appHelpers"

// Keys typed while an IME (Chinese/Japanese/Korean input) is composing belong to the IME, not to app shortcuts or inputs.

let t: TestApp

test.beforeAll(async () => {
    test.setTimeout(120_000)
    t = await launchApp()
    await createProject(t.win)
})

test.afterAll(async () => {
    await t?.close()
})

test("Enter while an IME is composing does not submit the create show name", async () => {
    const { win } = t
    await clickSafe(win, win.getByText("New show").first())
    const name = win.locator("#name")
    await name.click()
    await win.keyboard.type("ni")

    // what Chromium sends when a CJK candidate is committed with Enter
    await name.evaluate((elem) => elem.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: true, bubbles: true, cancelable: true })))
    await delay(300)
    await expect(win.getByPlaceholder("[Verse]")).toHaveCount(0)

    // a normal Enter still goes on to the lyrics
    await name.press("Enter")
    await expect(win.getByPlaceholder("[Verse]")).toBeVisible()
})

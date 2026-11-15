import { expect, test } from "@playwright/test"
import { clickSafe, createProject, launchApp, MOD, pressGlobal, type TestApp } from "./appHelpers"

let t: TestApp

test.beforeAll(async () => {
    test.setTimeout(120_000)
    t = await launchApp()
    await createProject(t.win)
})

test.afterAll(async () => {
    await t?.close()
})

test("the open project can be renamed from its header", async () => {
    const { win } = t
    const header = win.locator(".tabs .header .projectName")
    const originalName = (await header.innerText()).trim()

    await clickSafe(win, header, { button: "right" })
    await clickSafe(win, win.locator(".contextMenu .item").filter({ hasText: "Rename" }).first())
    const input = win.locator(".tabs .header input")
    await input.fill("Sunday service")
    await input.press("Enter")
    await expect(header).toHaveText("Sunday service")

    await pressGlobal(win, `${MOD}+z`)
    await expect(header).toHaveText(originalName)
})

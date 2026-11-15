// Patches the "slideshow" dependency (github:vassbo/slideshow) so PowerPoint can start in Presenter View.
//
// Problem in the upstream Windows connector (connector-win-ppt2010.js):
//  1. `START <arg>` receives `arg` as a string, but it is compared with `arg === true`,
//     so ShowPresenterView is always false (plain "Slide Show" only).
//  2. `activeApplication(arg)` is called for every command, so for `START true` the text "true"
//     would be treated as a file path to open if PowerPoint is not visible.
//
// This script is idempotent and safe to run on every install.

const fs = require("fs")
const path = require("path")

const file = path.join(__dirname, "..", "node_modules", "slideshow", "connector-win-ppt2010.js")

const patches = [
    {
        name: "presenter view flag",
        from: "pres.SlideShowSettings.ShowPresenterView = (arg === true);",
        to: 'pres.SlideShowSettings.ShowPresenterView = (arg === true || arg === "true"); // patched by FreeShow'
    },
    {
        name: "only open files for BOOT/OPEN",
        from: "var app  = activeApplication(arg);",
        to: 'var app  = activeApplication(cmd === "BOOT" || cmd === "OPEN" ? arg : ""); // patched by FreeShow'
    }
]

function run() {
    if (!fs.existsSync(file)) {
        console.log("[patchSlideshow] connector not found, skipping:", file)
        return
    }

    let content = fs.readFileSync(file, "utf8")
    let changed = false

    patches.forEach((patch) => {
        if (content.includes(patch.to)) return

        if (!content.includes(patch.from)) {
            console.warn(`[patchSlideshow] could not apply "${patch.name}": upstream code has changed`)
            return
        }

        content = content.replace(patch.from, patch.to)
        changed = true
    })

    if (changed) {
        fs.writeFileSync(file, content)
        console.log("[patchSlideshow] patched", file)
    }
}

run()

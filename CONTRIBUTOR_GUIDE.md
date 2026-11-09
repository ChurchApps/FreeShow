# FreeShow Contributor Guide for Beginners

Welcome! You do not need to understand the whole codebase before making a useful contribution. This guide gives you a map, explains how to run the app, and offers a small, repeatable way to choose and submit a change.

## 1. What FreeShow Is

FreeShow is a desktop presentation application. It helps people prepare and display songs, lyrics, slides, media, and other content. It can also show content in separate output windows and connect to other devices through web-based clients such as its remote and stage views.

This repository is the source code for the application. It includes the desktop program, its user interface, supporting web clients, assets, build scripts, and tests. The published application is built from these files; the generated build folders are not the source to edit.

## 2. The Main Technologies

- **TypeScript** is JavaScript with type checking. Most application logic is TypeScript (`.ts`). Types help the editor catch mistakes and describe the data passed between parts of the app.
- **JavaScript** is used for build scripts and some browser-side code (`.js`, `.mjs`). Node.js runs scripts and the Electron main process.
- **Svelte** builds the user interface from components (`.svelte`). A component usually contains markup, TypeScript logic, and CSS together.
- **HTML and CSS** describe page structure and appearance. Global browser styles live in `public/global.css`; component styles are often inside Svelte files.
- **Electron** packages Chromium and Node.js into a desktop application. Chromium displays the interface; the Node.js side can work with the operating system, files, windows, and native integrations.
- **Vite** serves and bundles the frontend during development and production builds. It is also used to build the auxiliary web clients.
- **JSON** stores configuration, translations, package metadata, and other structured data. Files in `public/lang/` are translations.
- **Protocol Buffers (`.proto`)** define structured message/data formats used by parts of the application.
- **C#** is used by a small Windows helper under `scripts/aero-peek-helper/`; it is not the main application language.

Libraries listed in `package.json` provide capabilities such as audio, video, networking, databases, cloud services, and export. You usually do not need to learn every library to make a focused change.

## 3. How the Application Fits Together

Think of FreeShow as a few cooperating pieces:

```text
Svelte interface (Chromium renderer)
        | calls the narrow window.api bridge
        v
Preload script (security boundary)
        | Electron IPC messages
        v
Electron main process (OS, files, windows, media, services)
        |
        +-- remote / stage / controller / output-stream web clients
```

### The desktop interface

- `public/index.html` is the HTML page Vite loads in development.
- `src/frontend/main.ts` creates the Svelte application.
- `src/frontend/App.svelte` selects the main view and composes high-level UI pieces.
- `src/frontend/components/` contains many of the visible features, grouped into folders such as `show`, `slide`, `media`, `output`, and `settings`.
- `src/frontend/stores.ts` contains shared Svelte stores. A store is shared state that components can read and update.
- `src/frontend/utils/` contains frontend logic that does not naturally belong to one visual component.

### The Electron desktop process

- `src/electron/index.ts` is the main Electron entry point. It creates windows, initializes services, and coordinates desktop behavior.
- `src/electron/` contains operating-system and application services: data persistence, media, audio, output rendering, cloud connections, streaming, and more.
- `src/electron/preload.ts` exposes a small `window.api` interface to the UI. The UI should use this bridge instead of importing Electron's unrestricted APIs.

### Messages between the interface and Electron

The frontend and Electron run in separate processes. They communicate with **IPC** (inter-process communication), which is a message/request system.

- Shared channel names and data types live under `src/types/`, including `src/types/Channels.ts` and `src/types/IPC/`.
- The frontend-side helpers are in `src/frontend/IPC/`.
- The Electron-side handlers are in `src/electron/IPC/`.
- To add or change a message, trace an existing similar message through all of these places. Keep the sender, handler, response, and shared types in agreement.

### The auxiliary web clients

`src/server/` contains browser interfaces used alongside the desktop app. Examples include `remote`, `stage`, `controller`, and `output_stream`. They are built separately from the main interface, but share some app data and types. The active server build setup is `config/building/vite.config.servers.mjs`.

### Build and project support files

- `scripts/` contains startup, build, and development-watch scripts.
- `config/typescript/` contains TypeScript configurations for the different parts of the app.
- `config/testing/` contains Vitest and Playwright configuration.
- `config/linting/` and `config/formatting/` configure code checks.
- `public/assets/`, `public/fonts/`, `public/lang/`, and `public/proto/` contain assets, translations, and data definitions.

## 4. Set Up on Windows

The project declares **Node.js 22.12.0 or newer** in `package.json`. For fewer compatibility surprises with older development tools in this repo, use the Node.js 22 LTS line. Windows also needs **Python 3.12 with setuptools** and **Visual Studio Build Tools with Desktop development with C++ and the Windows 10 SDK**. Some dependencies contain native code and need those tools to install or build.

1. Install Git, Node.js 22, Python 3.12, and Visual Studio Build Tools. In the Visual Studio installer, select **Desktop development with C++** and the **Windows 10 SDK**. During Python setup, enable the Python launcher; then install setuptools with:

        ```powershell
        py -3.12 -m pip install setuptools
        ```

2. Clone your fork if you have not already, then enter the project folder. Use your own fork URL if your GitHub username differs:

        ```powershell
        git clone https://github.com/SSEMANDA-GERALD/FreeShow.git
        cd FreeShow
        ```

        If you already have the project open in VS Code, skip this step.
3. Open a terminal in the project folder. In VS Code, choose **Terminal > New Terminal**; confirm the prompt is in the folder containing `package.json`.
4. Install the exact dependencies from the lockfile:

   ```powershell
        npm.cmd ci
   ```

        This may take a while because of native dependencies. `npm.cmd ci` installs the versions recorded in `package-lock.json`. The install also runs the project's Electron native-dependency setup. Use `npm.cmd` in PowerShell if `npm` is blocked by your script execution policy; it runs the same npm program without changing that policy.
5. Start the development app:

   ```powershell
        npm.cmd start
   ```

        Keep this terminal open while using the app. The first startup can take a little while. Vite serves the main interface on port 3000, and Electron opens the desktop window.
6. To stop the development processes, focus the terminal running FreeShow and press `Ctrl+C`.

### See your code changes

1. Make and save a change in a source file, usually somewhere under `src/` (for example, the Svelte component for the screen you are working on).
2. For frontend Svelte/CSS changes, leave `npm.cmd start` running. Vite normally applies the edit to the open app automatically (hot reload). Watch the terminal for compile errors if the screen does not update.
3. Changes to Electron's main-process code, startup behavior, or native integrations may need the app restarted. Press `Ctrl+C`, then run `npm.cmd start` again. A TypeScript watcher compiling a file does not necessarily restart the already-running Electron process.
4. If you are unsure whether a change was picked up, restart the app. Do not edit `build/` or `public/build/`; those are generated and can be deleted when startup runs.

To confirm which version of a file you are editing, use VS Code's Explorer and check that its path is inside this project folder, not `node_modules/`, `build/`, or another clone.

### What `npm start` does

The `start` script in `package.json` runs `scripts/start.js`. In broad strokes, it:

1. Sets development mode and clears port 3000 if another process is using it.
2. Runs `scripts/preBuild.js` to prepare required generated files.
3. Starts Vite for the main frontend.
4. Starts Vite watchers for the auxiliary server clients.
5. Starts the Electron TypeScript watcher and desktop app.

The prep script deletes the generated `public/build` and `build` folders before rebuilding them. Do not put source files or personal files in those generated folders; edit the source folders instead.

### Common setup problems

- **A native dependency fails to install:** confirm Python 3.12/setuptools and the Visual Studio C++ workload/Windows SDK are installed, then retry `npm.cmd ci` and read the first error in the terminal.
- **The `openmediatransport` build mentions `node.profdata` and splits a path at a space:** use a no-space npm cache for this PowerShell session, then retry the install:

        ```powershell
        $env:npm_config_cache = 'D:\npm-cache'
        npm.cmd ci
        ```

        This only changes the cache location in the current terminal session. It does not change your global npm configuration.
- **Port 3000 is already in use:** `npm start` attempts to clear it. If that does not work, close the other development server using that port and retry.
- **The app window does not appear:** leave the startup terminal open and check its first error. Electron starts after the frontend and server watchers begin.
- **Changes do not show up:** check that you edited a file under `src/` or `public/`, not generated output under `build/` or `public/build/`.

## 5. Finding a First Contribution

You do not need to pick a large feature. A good first change is small enough that you can explain what should happen and check that behavior afterward.

1. Look at open issues in the upstream GitHub repository, or use the app and note a specific confusing label, incorrect behavior, or missing small detail.
2. Search the code for the relevant screen or wording. The folder names under `src/frontend/components/` are a useful starting point. Search for nearby code before creating a new abstraction.
3. Describe the expected behavior in one sentence. For example: "When this setting is disabled, the output window should not do X."
4. Find a nearby test or run the relevant screen in the app. Make the smallest change that can meet the expectation.
5. Run checks relevant to the files you changed, then explain the change and how you checked it in your pull request.

If the change affects text users see, remember that FreeShow has translation files under `public/lang/`. Follow the existing translation pattern in the feature rather than adding a hard-coded English string if the surrounding UI uses the language dictionary.

## 6. Work From Your Fork

This checkout's `origin` points to your fork, `SSEMANDA-GERALD/FreeShow`. The original project is `ChurchApps/FreeShow`. Add the original as `upstream` once:

```powershell
git remote add upstream https://github.com/ChurchApps/FreeShow.git
git fetch upstream
```

Before starting a new change, update your local `main` and make a separate branch:

```powershell
git switch main
git fetch upstream
git merge upstream/main
git push origin main
git switch -c fix/short-description
```

Use a descriptive branch name, such as `fix/slide-counter` or `docs/first-run-guide`. Do your work on that branch, not directly on `main`.

After making and checking your change:

```powershell
git status
git diff
git add path/to/changed-file
git commit -m "Describe the change"
git push -u origin fix/short-description
```

Then open a pull request on GitHub from your fork's branch into `ChurchApps/FreeShow`'s `main` branch. Explain the problem, what you changed, and the checks you ran. Add screenshots for visible UI changes when they help reviewers. Do not include generated build output or unrelated changes.

If `git merge upstream/main` reports conflicts, stop and resolve them before continuing. A conflict means both branches changed the same area; do not delete unfamiliar changes just to make Git proceed.

## 7. How to Check Your Work

The project has focused commands in `package.json`:

```powershell
npm.cmd run test:unit
npm.cmd run test:svelte
npm.cmd run test:format
npm.cmd run test:playwright
```

- `test:unit` runs Vitest tests named `*.test.ts` under `src/`.
- `test:svelte` runs Svelte diagnostics/type checks.
- `test:format` checks formatting for `src/` and `scripts/`.
- `test:playwright` runs end-to-end browser/Electron tests. It can take longer and may need a working app environment.
- `npm.cmd test` runs all four checks in sequence.
- `npm.cmd run build` makes a production build; it is a useful broader check, but takes longer.

Run the narrowest check that covers your change first. For example, after changing a small pure utility, run its unit test; after changing a Svelte component, run `npm run test:svelte` and manually check the app. Run broader checks before submitting when practical, and report any check you could not run.

The lint scripts in this repository include ESLint's `--fix` option for some source folders, meaning they may edit files automatically. Review `git diff` afterward and do not commit formatting changes unrelated to your contribution.

## 8. A Few Important Habits

- Keep changes focused. A small pull request is easier to understand and review.
- Follow the style and patterns in neighboring code. This is a mature application with existing helpers and conventions.
- Keep TypeScript types accurate, especially for IPC messages and shared app data.
- Do not import Electron APIs directly into the Svelte UI. Use the existing preload bridge and IPC helpers.
- Treat files in `build/` and `public/build/` as generated output.
- Do not commit credentials, private user data, local settings, or unrelated work.
- Ask questions in the project's issue/discussion channels when the intended behavior is unclear. It is better to clarify a feature than guess at a broad change.

## 9. Where to Look First

| If you want to understand... | Start here |
| --- | --- |
| The main application window | `src/electron/index.ts` |
| How the main Svelte UI starts | `public/index.html`, `src/frontend/main.ts`, `src/frontend/App.svelte` |
| A visible UI feature | `src/frontend/components/` |
| Frontend shared state | `src/frontend/stores.ts` |
| Frontend-to-Electron messages | `src/frontend/IPC/`, `src/electron/IPC/`, `src/types/IPC/` |
| The secure renderer bridge | `src/electron/preload.ts` |
| Remote/stage/controller web clients | `src/server/` |
| Development startup | `scripts/start.js` |
| Main app build settings | `vite.config.mjs`, `config/building/vite.config.servers.mjs` |
| Tests and checks | `config/testing/`, `package.json` |

The open file `config/building/rollup.config.mjs` is marked deprecated and its main application/server entries are commented out. It is kept for reference; current development and build commands use Vite instead.

## 10. About Project History

The current source and build setup are the reliable guide to how the application works today. Recent Git history in this checkout is mostly version and release commits, so it does not provide a complete narrative of every design decision. For historical context on a particular file or feature, use GitHub's file history/blame and the pull request that introduced it; for making a contribution, the architecture and workflow above are the practical starting point.
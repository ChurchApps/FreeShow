# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
npm start              # Start development server with hot reload
npm run build         # Build for production
npm run release       # Build platform installers
```

### Code Quality
```bash
npm run lint          # Run all linters (electron, frontend, svelte, styles)
npm run format:prettier # Format code with Prettier
npm test              # Run Playwright tests and format checks
```

## Architecture Overview

FreeShow is an Electron-based presentation software with a multi-process architecture:

### Core Components

1. **Main Process** (`src/electron/`)
   - Manages application lifecycle, windows, and system operations
   - Handles file I/O, native integrations (NDI, MIDI, etc.)
   - IPC communication hub between all processes

2. **Renderer Process** (`src/frontend/`)
   - Svelte 3 application for the main UI
   - State management using Svelte stores in `src/frontend/stores.ts`
   - Component-based architecture in `src/frontend/components/`

3. **Web Servers** (`src/server/`)
   - `remote/`: Web interface for remote control
   - `stage/`: Stage display for performers
   - `controller/`: Simplified controller interface
   - `output_stream/`: Stream outputs over network

### Key Architectural Patterns

1. **Store-Based State Management**
   - All global state in `src/frontend/stores.ts`
   - Stores are reactive and persist across sessions
   - Use `get()` from 'svelte/store' to read store values
   - Special stores like `special` may have undefined properties - always use optional chaining

2. **IPC Communication**
   - Main ↔ Renderer: Via Electron IPC (`src/electron/IPC/` and `src/frontend/IPC/`)
   - Server communication: WebSocket-based for real-time updates

3. **Show Data Structure**
   - Projects → Shows → Slides → Items
   - Shows stored in `shows` and `showsCache` stores
   - Media references tracked separately in `media` store

4. **Output System**
   - Multiple simultaneous outputs supported
   - Each output has its own window and configuration
   - Transitions, effects, and overlays applied per-output

### Important Considerations

1. **Cross-Platform Development**
   - Test platform-specific code (Windows/Mac/Linux)
   - File paths must use proper separators
   - Some features (like NDI) may have platform limitations

2. **Performance**
   - Large shows can have thousands of slides
   - Media files are referenced, not embedded
   - Use virtual scrolling for long lists
   - Cache thumbnails and preview data

3. **Type Safety**
   - Extensive TypeScript usage - maintain type definitions
   - Shared types in `src/types/`
   - Avoid `any` types where possible

4. **Error Handling**
   - Always check for undefined/null before accessing nested properties
   - Handle file I/O errors gracefully
   - Provide user-friendly error messages

5. **Localization**
   - All user-facing strings should use translation system
   - Translation files in `public/lang/`
   - Use `T` component or `$dictionary` store

## Common Development Tasks

### Adding a New Feature
1. Define types in `src/types/`
2. Add store if needed in `src/frontend/stores.ts`
3. Create UI components in `src/frontend/components/`
4. Add IPC handlers if main process interaction needed
5. Update translations in `public/lang/en.json`

### Debugging
- DevTools available in development mode
- Check console for errors in both main and renderer processes
- Store updates can be monitored via Svelte DevTools

### File Format Support
- Converters in `src/frontend/converters/`
- Each converter handles import/export for specific formats
- Test with real-world files from each format

## Testing Approach
- E2E tests using Playwright
- Test files in same directory as source files
- Run specific test: `npx playwright test [test-name]`
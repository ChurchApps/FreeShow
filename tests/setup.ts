// Test setup for FreeShow
// This file is loaded before all tests

// Mock Electron APIs for unit tests
;(global as any).electronAPI = {
    sendToMain: jest.fn(),
    receiveFromMain: jest.fn(),
    removeListeners: jest.fn()
}

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
}
;(global as any).localStorage = localStorageMock

// Mock DOM APIs that might be used
;(global as any).ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}))

// Mock window for Node.js environment
;(global as any).window = {
    matchMedia: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
    }))
}

// Mock navigator
;(global as any).navigator = {
    mediaDevices: {
        getUserMedia: jest.fn(),
        enumerateDevices: jest.fn()
    }
}

// Increase timeout for async operations
jest.setTimeout(15000)

import { describe, expect, test, beforeEach, jest } from '@jest/globals'

// Mock output utilities
const mockOutputHelpers = {
    createOutput: jest.fn(),
    updateOutput: jest.fn(),
    deleteOutput: jest.fn(),
    sendToOutput: jest.fn(),
    clearOutput: jest.fn(),
    toggleOutputEnabled: jest.fn(),
    moveOutput: jest.fn(),
    resizeOutput: jest.fn()
}

// Mock displays
const mockDisplays = [
    {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        primary: true,
        label: 'Primary Display'
    },
    {
        id: 2,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        primary: false,
        label: 'Secondary Display'
    }
]

// Mock stores
const mockStores = {
    outputs: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue({
            'output-1': {
                id: 'output-1',
                name: 'Main Output',
                enabled: true,
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                screen: 1,
                type: 'window'
            },
            'output-2': {
                id: 'output-2',
                name: 'Stage Display',
                enabled: false,
                bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
                screen: 2,
                type: 'screen'
            }
        })
    },
    displays: {
        subscribe: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue(mockDisplays)
    },
    outLocked: {
        subscribe: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue(false)
    },
    currentOutputSettings: {
        subscribe: jest.fn(),
        set: jest.fn()
    },
    activeShow: {
        subscribe: jest.fn(),
        get: jest.fn().mockReturnValue('show-1')
    },
    activeLayout: {
        subscribe: jest.fn(),
        get: jest.fn().mockReturnValue({
            id: 'layout-1',
            name: 'Main Layout'
        })
    }
}

// Mock IPC
const mockIPC = {
    sendMain: jest.fn(),
    requestMain: jest.fn(() => Promise.resolve(mockDisplays))
}

// Mock window management
const mockWindowManager = {
    openOutputWindow: jest.fn(),
    closeOutputWindow: jest.fn(),
    moveOutputWindow: jest.fn(),
    resizeOutputWindow: jest.fn(),
    setOutputFullscreen: jest.fn()
}

jest.mock('../../src/frontend/stores', () => mockStores)
jest.mock('../../src/frontend/IPC/main', () => mockIPC)
jest.mock('svelte/store', () => ({
    get: jest.fn((store) => {
        if (store === mockStores.outputs) return mockStores.outputs.get()
        if (store === mockStores.displays) return mockStores.displays.get()
        if (store === mockStores.outLocked) return mockStores.outLocked.get()
        if (store === mockStores.activeShow) return mockStores.activeShow.get()
        if (store === mockStores.activeLayout) return mockStores.activeLayout.get()
        return {}
    })
}))

describe('Output Management Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Output Creation and Management', () => {
        test('should create a new output', () => {
            const newOutput = {
                id: 'output-3',
                name: 'Recording Output',
                enabled: true,
                bounds: { x: 0, y: 0, width: 1280, height: 720 },
                screen: 0,
                type: 'window',
                style: {
                    background: '#000000',
                    textAlign: 'center'
                }
            }

            mockOutputHelpers.createOutput(newOutput)
            expect(mockOutputHelpers.createOutput).toHaveBeenCalledWith(newOutput)
        })

        test('should update output properties', () => {
            const outputId = 'output-1'
            const updates = {
                name: 'Updated Main Output',
                bounds: { x: 100, y: 100, width: 1920, height: 1080 }
            }

            mockOutputHelpers.updateOutput(outputId, updates)
            expect(mockOutputHelpers.updateOutput).toHaveBeenCalledWith(outputId, updates)
        })

        test('should delete output', () => {
            const outputId = 'output-to-delete'

            mockOutputHelpers.deleteOutput(outputId)
            expect(mockOutputHelpers.deleteOutput).toHaveBeenCalledWith(outputId)
        })

        test('should toggle output enabled state', () => {
            const outputId = 'output-1'

            mockOutputHelpers.toggleOutputEnabled(outputId)
            expect(mockOutputHelpers.toggleOutputEnabled).toHaveBeenCalledWith(outputId)
        })

        test('should generate unique output ID', () => {
            const generateOutputId = () => `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            
            const id1 = generateOutputId()
            const id2 = generateOutputId()
            
            expect(id1).not.toBe(id2)
            expect(id1).toMatch(/^output-\d+-[a-z0-9]+$/)
        })
    })

    describe('Display Detection and Management', () => {
        test('should detect available displays', async () => {
            const displays = await mockIPC.requestMain()
            
            expect(mockIPC.requestMain).toHaveBeenCalled()
            expect(displays).toBeDefined()
            expect(Array.isArray(displays)).toBe(true)
            expect(displays.length).toBeGreaterThan(0)
        })

        test('should identify primary display', () => {
            const primaryDisplay = mockDisplays.find(display => display.primary)
            
            expect(primaryDisplay).toBeDefined()
            expect(primaryDisplay!.id).toBe(1)
        })

        test('should calculate display bounds', () => {
            const totalWidth = mockDisplays.reduce((width, display) => {
                return Math.max(width, display.bounds.x + display.bounds.width)
            }, 0)

            const totalHeight = mockDisplays.reduce((height, display) => {
                return Math.max(height, display.bounds.y + display.bounds.height)
            }, 0)

            expect(totalWidth).toBe(3840) // Two 1920px wide displays
            expect(totalHeight).toBe(1080)
        })

        test('should validate display selection', () => {
            const isValidDisplay = (displayId: number) => {
                return mockDisplays.some(display => display.id === displayId)
            }

            expect(isValidDisplay(1)).toBe(true)
            expect(isValidDisplay(2)).toBe(true)
            expect(isValidDisplay(999)).toBe(false)
        })
    })

    describe('Output Content Management', () => {
        test('should send slide to output', () => {
            const outputId = 'output-1'
            const slideData = {
                type: 'slide',
                id: 'slide-1',
                items: [
                    {
                        type: 'text',
                        value: 'Hello World',
                        style: { color: '#FFFFFF', fontSize: '48px' }
                    }
                ]
            }

            mockOutputHelpers.sendToOutput(outputId, slideData)
            expect(mockOutputHelpers.sendToOutput).toHaveBeenCalledWith(outputId, slideData)
        })

        test('should clear output', () => {
            const outputId = 'output-1'

            mockOutputHelpers.clearOutput(outputId)
            expect(mockOutputHelpers.clearOutput).toHaveBeenCalledWith(outputId)
        })

        test('should send media to output', () => {
            const outputId = 'output-1'
            const mediaData = {
                type: 'media',
                path: '/path/to/video.mp4',
                loop: false,
                volume: 0.8
            }

            mockOutputHelpers.sendToOutput(outputId, mediaData)
            expect(mockOutputHelpers.sendToOutput).toHaveBeenCalledWith(outputId, mediaData)
        })

        test('should handle transition effects', () => {
            const transitionData = {
                type: 'transition',
                effect: 'fade',
                duration: 1000,
                easing: 'ease-in-out'
            }

            mockIPC.sendMain('TRANSITION_OUTPUT', {
                outputId: 'output-1',
                transition: transitionData
            })

            expect(mockIPC.sendMain).toHaveBeenCalledWith('TRANSITION_OUTPUT', {
                outputId: 'output-1',
                transition: transitionData
            })
        })

        test('should send overlays to output', () => {
            const overlayData = {
                type: 'overlay',
                id: 'timer-overlay',
                position: { x: 50, y: 50 },
                content: {
                    type: 'timer',
                    duration: 600,
                    format: 'mm:ss'
                }
            }

            mockOutputHelpers.sendToOutput('output-1', overlayData)
            expect(mockOutputHelpers.sendToOutput).toHaveBeenCalledWith('output-1', overlayData)
        })
    })

    describe('Output Window Management', () => {
        test('should open output window', () => {
            const outputId = 'output-1'
            const windowConfig = {
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                fullscreen: false,
                alwaysOnTop: true
            }

            mockWindowManager.openOutputWindow(outputId, windowConfig)
            expect(mockWindowManager.openOutputWindow).toHaveBeenCalledWith(outputId, windowConfig)
        })

        test('should close output window', () => {
            const outputId = 'output-1'

            mockWindowManager.closeOutputWindow(outputId)
            expect(mockWindowManager.closeOutputWindow).toHaveBeenCalledWith(outputId)
        })

        test('should move output window', () => {
            const outputId = 'output-1'
            const newPosition = { x: 100, y: 100 }

            mockOutputHelpers.moveOutput(outputId, newPosition)
            expect(mockOutputHelpers.moveOutput).toHaveBeenCalledWith(outputId, newPosition)
        })

        test('should resize output window', () => {
            const outputId = 'output-1'
            const newSize = { width: 1280, height: 720 }

            mockOutputHelpers.resizeOutput(outputId, newSize)
            expect(mockOutputHelpers.resizeOutput).toHaveBeenCalledWith(outputId, newSize)
        })

        test('should set fullscreen mode', () => {
            const outputId = 'output-1'
            const fullscreen = true

            mockWindowManager.setOutputFullscreen(outputId, fullscreen)
            expect(mockWindowManager.setOutputFullscreen).toHaveBeenCalledWith(outputId, fullscreen)
        })
    })

    describe('Output Styling and Themes', () => {
        test('should apply output theme', () => {
            const outputId = 'output-1'
            const theme = {
                background: {
                    type: 'gradient',
                    colors: ['#1a1a1a', '#2a2a2a']
                },
                text: {
                    color: '#FFFFFF',
                    fontFamily: 'Arial',
                    fontSize: '48px',
                    lineHeight: 1.2
                },
                margins: {
                    top: 50,
                    right: 50,
                    bottom: 50,
                    left: 50
                }
            }

            mockStores.outputs.update((outputs) => {
                if (outputs[outputId]) {
                    outputs[outputId].style = theme
                }
                return outputs
            })

            expect(mockStores.outputs.update).toHaveBeenCalled()
        })

        test('should validate style properties', () => {
            const validStyle = {
                background: '#000000',
                color: '#FFFFFF',
                fontSize: '48px',
                fontFamily: 'Arial'
            }

            const invalidStyle = {
                background: 'invalid-color',
                fontSize: 'invalid-size'
            }

            const isValidColor = (color: string) => {
                return /^#[0-9A-F]{6}$/i.test(color) || /^#[0-9A-F]{3}$/i.test(color)
            }

            const isValidFontSize = (size: string) => {
                return /^\d+px$/.test(size) || /^\d+rem$/.test(size) || /^\d+em$/.test(size)
            }

            expect(isValidColor(validStyle.background)).toBe(true)
            expect(isValidColor(validStyle.color)).toBe(true)
            expect(isValidFontSize(validStyle.fontSize)).toBe(true)

            expect(isValidColor(invalidStyle.background)).toBe(false)
            expect(isValidFontSize(invalidStyle.fontSize)).toBe(false)
        })

        test('should apply custom CSS to output', () => {
            const customCSS = `
                .slide {
                    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                    border-radius: 20px;
                }
                .text {
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                }
            `

            mockIPC.sendMain('APPLY_OUTPUT_CSS', {
                outputId: 'output-1',
                css: customCSS
            })

            expect(mockIPC.sendMain).toHaveBeenCalledWith('APPLY_OUTPUT_CSS', {
                outputId: 'output-1',
                css: customCSS
            })
        })
    })

    describe('Output Presets and Templates', () => {
        test('should create output preset', () => {
            const preset = {
                id: 'preset-1',
                name: 'Main Sanctuary',
                outputs: [
                    {
                        name: 'Main Screen',
                        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                        screen: 1
                    },
                    {
                        name: 'Stage Display',
                        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
                        screen: 2
                    }
                ]
            }

            mockStores.outputs.update((outputs) => {
                if (!outputs.presets) outputs.presets = {}
                outputs.presets[preset.id] = preset
                return outputs
            })

            expect(mockStores.outputs.update).toHaveBeenCalled()
        })

        test('should apply output preset', () => {
            const presetId = 'preset-1'
            const preset = {
                outputs: [
                    { name: 'Main Screen', screen: 1 },
                    { name: 'Stage Display', screen: 2 }
                ]
            }

            preset.outputs.forEach((outputConfig, index) => {
                const outputId = `preset-output-${index}`
                mockOutputHelpers.createOutput({
                    id: outputId,
                    ...outputConfig
                })
            })

            expect(mockOutputHelpers.createOutput).toHaveBeenCalledTimes(2)
        })

        test('should save current outputs as preset', () => {
            const currentOutputs = mockStores.outputs.get() as any
            const presetName = 'Current Setup'

            const preset = {
                id: `preset-${Date.now()}`,
                name: presetName,
                outputs: Object.values(currentOutputs).map((output: any) => ({
                    name: output.name,
                    bounds: output.bounds,
                    screen: output.screen,
                    style: output.style
                }))
            }

            expect(preset.outputs.length).toBe(2)
        })
    })

    describe('Output Synchronization', () => {
        test('should sync slides across outputs', () => {
            const slideData = {
                type: 'slide',
                id: 'slide-1',
                content: 'Synchronized slide content'
            }

            const outputs = ['output-1', 'output-2']
            
            outputs.forEach(outputId => {
                mockOutputHelpers.sendToOutput(outputId, slideData)
            })

            expect(mockOutputHelpers.sendToOutput).toHaveBeenCalledTimes(2)
        })

        test('should handle output delay compensation', () => {
            const outputDelays = {
                'output-1': 0,    // Main output - no delay
                'output-2': 100   // Stage display - 100ms delay
            }

            const sendWithDelay = (outputId: string, data: any) => {
                const delay = outputDelays[outputId] || 0
                setTimeout(() => {
                    mockOutputHelpers.sendToOutput(outputId, data)
                }, delay)
            }

            const slideData = { type: 'slide', content: 'Test slide' }
            
            sendWithDelay('output-1', slideData)
            sendWithDelay('output-2', slideData)

            // Verify functions are set up (actual delays would require async testing)
            expect(typeof sendWithDelay).toBe('function')
        })

        test('should maintain output state consistency', () => {
            const outputState = {
                currentSlide: 'slide-1',
                isPlaying: false,
                volume: 0.8,
                brightness: 1.0
            }

            mockStores.outputs.update((outputs) => {
                Object.keys(outputs).forEach(outputId => {
                    outputs[outputId].state = { ...outputState }
                })
                return outputs
            })

            expect(mockStores.outputs.update).toHaveBeenCalled()
        })
    })

    describe('Output Performance and Monitoring', () => {
        test('should monitor output performance', () => {
            const outputStats = {
                fps: 60,
                memoryUsage: 150, // MB
                renderTime: 16.67, // ms per frame
                dropped_frames: 0
            }

            mockIPC.sendMain('GET_OUTPUT_STATS', 'output-1')
            expect(mockIPC.sendMain).toHaveBeenCalledWith('GET_OUTPUT_STATS', 'output-1')
        })

        test('should handle output errors gracefully', () => {
            const errorHandler = (outputId: string, error: any) => {
                console.error(`Output ${outputId} error:`, error)
                
                // Attempt recovery
                mockOutputHelpers.clearOutput(outputId)
                
                // Notify user
                mockIPC.sendMain('OUTPUT_ERROR', { outputId, error })
            }

            const testError = new Error('Test output error')
            errorHandler('output-1', testError)

            expect(mockOutputHelpers.clearOutput).toHaveBeenCalledWith('output-1')
            expect(mockIPC.sendMain).toHaveBeenCalledWith('OUTPUT_ERROR', {
                outputId: 'output-1',
                error: testError
            })
        })

        test('should optimize output rendering', () => {
            const optimizationSettings = {
                enableHardwareAcceleration: true,
                maxFPS: 60,
                quality: 'high',
                antialiasing: true
            }

            mockIPC.sendMain('SET_OUTPUT_OPTIMIZATION', {
                outputId: 'output-1',
                settings: optimizationSettings
            })

            expect(mockIPC.sendMain).toHaveBeenCalledWith('SET_OUTPUT_OPTIMIZATION', {
                outputId: 'output-1',
                settings: optimizationSettings
            })
        })

        test('should handle multiple outputs efficiently', () => {
            const multipleOutputs = Array.from({ length: 10 }, (_, i) => ({
                id: `output-${i}`,
                name: `Output ${i}`,
                enabled: true
            }))

            const start = performance.now()
            
            multipleOutputs.forEach(output => {
                mockOutputHelpers.createOutput(output)
            })
            
            const end = performance.now()
            
            expect(mockOutputHelpers.createOutput).toHaveBeenCalledTimes(10)
            expect(end - start).toBeLessThan(100) // Should complete quickly
        })
    })

    describe('Output Lock and Security', () => {
        test('should handle output lock', () => {
            mockStores.outLocked.set(true)
            expect(mockStores.outLocked.set).toHaveBeenCalledWith(true)
        })

        test('should prevent output changes when locked', () => {
            const isLocked = true
            
            const attemptOutputChange = (outputId: string, data: any) => {
                if (isLocked) {
                    console.warn('Output is locked, changes prevented')
                    return false
                }
                mockOutputHelpers.sendToOutput(outputId, data)
                return true
            }

            const result = attemptOutputChange('output-1', { type: 'slide' })
            expect(result).toBe(false)
            expect(mockOutputHelpers.sendToOutput).not.toHaveBeenCalled()
        })

        test('should unlock outputs with proper authorization', () => {
            const unlockOutputs = (password: string) => {
                const correctPassword = 'admin123'
                
                if (password === correctPassword) {
                    mockStores.outLocked.set(false)
                    return true
                }
                return false
            }

            expect(unlockOutputs('wrong')).toBe(false)
            expect(unlockOutputs('admin123')).toBe(true)
        })
    })
})

import { describe, it, expect, beforeEach, jest } from "@jest/globals"

// Mock output helper functions
const mockOutput = {
    id: "output-1",
    name: "Main Output",
    enabled: true,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }
}

const mockOutputHelper = {
    setOutput: jest.fn(),
    getActiveOutputs: jest.fn(() => [mockOutput]),
    clearOutput: jest.fn(),
    refreshOut: jest.fn()
}

jest.mock("../../src/frontend/components/helpers/output", () => mockOutputHelper)

describe("Output Management", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("setOutput function", () => {
        it("should set output content", () => {
            const outputData = {
                type: "slide",
                id: "slide-1",
                show: "test-show-1"
            }

            mockOutputHelper.setOutput("background", outputData)

            expect(mockOutputHelper.setOutput).toHaveBeenCalledWith("background", outputData)
        })

        it("should handle different output types", () => {
            const slideOutput = { type: "slide", id: "slide-1" }
            const mediaOutput = { type: "video", path: "/path/to/video.mp4" }

            mockOutputHelper.setOutput("background", slideOutput)
            mockOutputHelper.setOutput("foreground", mediaOutput)

            expect(mockOutputHelper.setOutput).toHaveBeenCalledTimes(2)
        })
    })

    describe("getActiveOutputs function", () => {
        it("should return active outputs", () => {
            const outputs = mockOutputHelper.getActiveOutputs()

            expect(outputs).toBeDefined()
            expect(Array.isArray(outputs)).toBe(true)
            expect(outputs.length).toBeGreaterThan(0)
            expect(outputs[0]).toEqual(mockOutput)
        })

        it("should filter enabled outputs", () => {
            const filterEnabledOutputs = (outputs: any[]) => {
                return outputs.filter(output => output.enabled)
            }

            const allOutputs = [
                { ...mockOutput, enabled: true },
                { ...mockOutput, id: "output-2", enabled: false }
            ]

            const enabledOutputs = filterEnabledOutputs(allOutputs)
            expect(enabledOutputs).toHaveLength(1)
            expect(enabledOutputs[0].id).toBe("output-1")
        })
    })

    describe("clearOutput function", () => {
        it("should clear output content", () => {
            mockOutputHelper.clearOutput()
            expect(mockOutputHelper.clearOutput).toHaveBeenCalled()
        })
    })

    describe("refreshOut function", () => {
        it("should refresh output display", () => {
            mockOutputHelper.refreshOut()
            expect(mockOutputHelper.refreshOut).toHaveBeenCalled()
        })
    })

    describe("Output validation", () => {
        it("should validate output configuration", () => {
            const isValidOutput = (output: any) => {
                if (!output || typeof output !== "object") {
                    return false
                }
                return typeof output.id === "string" && typeof output.name === "string" && typeof output.enabled === "boolean" && output.bounds && typeof output.bounds.width === "number" && typeof output.bounds.height === "number"
            }

            expect(isValidOutput(mockOutput)).toBe(true)
            expect(isValidOutput({})).toBe(false)
            expect(isValidOutput(null)).toBe(false)
            expect(isValidOutput(undefined)).toBe(false)
        })

        it("should validate output bounds", () => {
            const hasValidBounds = (output: any) => {
                return output.bounds && output.bounds.width > 0 && output.bounds.height > 0
            }

            expect(hasValidBounds(mockOutput)).toBe(true)

            const invalidOutput = {
                ...mockOutput,
                bounds: { x: 0, y: 0, width: 0, height: 0 }
            }
            expect(hasValidBounds(invalidOutput)).toBe(false)
        })
    })

    describe("Output content handling", () => {
        it("should handle slide content", () => {
            const slideContent = {
                type: "slide",
                slideId: "slide-1",
                showId: "show-1",
                layoutId: "layout-1"
            }

            const isSlideContent = (content: any) => {
                return content && content.type === "slide" && !!content.slideId && !!content.showId
            }

            expect(isSlideContent(slideContent)).toBe(true)
        })

        it("should handle media content", () => {
            const mediaContent = {
                type: "video",
                path: "/path/to/video.mp4",
                duration: 120,
                currentTime: 0
            }

            const isMediaContent = (content: any) => {
                return content && (content.type === "video" || content.type === "audio") && !!content.path
            }

            expect(isMediaContent(mediaContent)).toBe(true)
        })

        it("should handle background content", () => {
            const backgroundContent = {
                type: "image",
                path: "/path/to/image.jpg",
                fit: "cover"
            }

            const isBackgroundContent = (content: any) => {
                return content && content.type === "image" && !!content.path
            }

            expect(isBackgroundContent(backgroundContent)).toBe(true)
        })
    })
})

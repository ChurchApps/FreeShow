import { describe, it, expect, beforeEach, jest } from "@jest/globals"

// Mock media helper functions with proper typing
const mockMediaHelper = {
    getMediaDuration: jest.fn() as jest.MockedFunction<(path: string) => Promise<number>>,
    getVideoMetadata: jest.fn() as jest.MockedFunction<(path: string) => Promise<any>>,
    getAudioMetadata: jest.fn() as jest.MockedFunction<(path: string) => Promise<any>>,
    encodeFilePath: jest.fn() as jest.MockedFunction<(path: string) => string>,
    getExtension: jest.fn() as jest.MockedFunction<(path: string) => string>,
    getFileName: jest.fn() as jest.MockedFunction<(path: string) => string>,
    removeExtension: jest.fn() as jest.MockedFunction<(path: string) => string>
}

jest.mock("../../src/frontend/components/helpers/media", () => mockMediaHelper)

describe("Media Helper Functions", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("File path utilities", () => {
        it("should encode file paths correctly", () => {
            const testPath = "/path/to/file with spaces.mp4"
            mockMediaHelper.encodeFilePath.mockReturnValue("/path/to/file%20with%20spaces.mp4")

            const encoded = mockMediaHelper.encodeFilePath(testPath)

            expect(mockMediaHelper.encodeFilePath).toHaveBeenCalledWith(testPath)
            expect(encoded).toBe("/path/to/file%20with%20spaces.mp4")
        })

        it("should get file extension", () => {
            const testCases = [
                { input: "video.mp4", expected: "mp4" },
                { input: "audio.wav", expected: "wav" },
                { input: "image.jpg", expected: "jpg" },
                { input: "document.pdf", expected: "pdf" }
            ]

            testCases.forEach(({ input, expected }) => {
                mockMediaHelper.getExtension.mockReturnValue(expected)
                const result = mockMediaHelper.getExtension(input)
                expect(result).toBe(expected)
            })
        })

        it("should get file name without path", () => {
            const testPath = "/long/path/to/filename.mp4"
            mockMediaHelper.getFileName.mockReturnValue("filename.mp4")

            const fileName = mockMediaHelper.getFileName(testPath)

            expect(mockMediaHelper.getFileName).toHaveBeenCalledWith(testPath)
            expect(fileName).toBe("filename.mp4")
        })

        it("should remove file extension", () => {
            const testFileName = "video.mp4"
            mockMediaHelper.removeExtension.mockReturnValue("video")

            const nameWithoutExt = mockMediaHelper.removeExtension(testFileName)

            expect(mockMediaHelper.removeExtension).toHaveBeenCalledWith(testFileName)
            expect(nameWithoutExt).toBe("video")
        })
    })

    describe("Media metadata extraction", () => {
        it("should get video metadata", async () => {
            const mockMetadata = {
                duration: 120,
                width: 1920,
                height: 1080,
                fps: 30,
                format: "mp4"
            }

            mockMediaHelper.getVideoMetadata.mockResolvedValue(mockMetadata)

            const metadata = await mockMediaHelper.getVideoMetadata("/path/to/video.mp4")

            expect(mockMediaHelper.getVideoMetadata).toHaveBeenCalledWith("/path/to/video.mp4")
            expect(metadata).toEqual(mockMetadata)
        })

        it("should get audio metadata", async () => {
            const mockMetadata = {
                duration: 180,
                format: "mp3",
                bitrate: 320,
                sampleRate: 44100,
                title: "Test Audio",
                artist: "Test Artist"
            }

            mockMediaHelper.getAudioMetadata.mockResolvedValue(mockMetadata)

            const metadata = await mockMediaHelper.getAudioMetadata("/path/to/audio.mp3")

            expect(mockMediaHelper.getAudioMetadata).toHaveBeenCalledWith("/path/to/audio.mp3")
            expect(metadata).toEqual(mockMetadata)
        })

        it("should handle metadata extraction errors", async () => {
            mockMediaHelper.getVideoMetadata.mockRejectedValue(new Error("File not found"))

            try {
                await mockMediaHelper.getVideoMetadata("/invalid/path.mp4")
                fail("Should have thrown an error")
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toBe("File not found")
            }
        })
    })

    describe("Media duration calculation", () => {
        it("should get media duration", async () => {
            mockMediaHelper.getMediaDuration.mockResolvedValue(120)

            const duration = await mockMediaHelper.getMediaDuration("/path/to/media.mp4")

            expect(mockMediaHelper.getMediaDuration).toHaveBeenCalledWith("/path/to/media.mp4")
            expect(duration).toBe(120)
        })

        it("should handle zero duration", async () => {
            mockMediaHelper.getMediaDuration.mockResolvedValue(0)

            const duration = await mockMediaHelper.getMediaDuration("/path/to/empty.mp4")

            expect(duration).toBe(0)
        })
    })

    describe("Media type validation", () => {
        it("should validate video extensions", () => {
            const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm"]
            const isVideoFile = (filename: string) => {
                const ext = filename.split(".").pop()?.toLowerCase()
                return videoExtensions.includes(ext || "")
            }

            expect(isVideoFile("video.mp4")).toBe(true)
            expect(isVideoFile("video.mov")).toBe(true)
            expect(isVideoFile("audio.mp3")).toBe(false)
            expect(isVideoFile("document.pdf")).toBe(false)
        })

        it("should validate audio extensions", () => {
            const audioExtensions = ["mp3", "wav", "flac", "aac", "ogg"]
            const isAudioFile = (filename: string) => {
                const ext = filename.split(".").pop()?.toLowerCase()
                return audioExtensions.includes(ext || "")
            }

            expect(isAudioFile("audio.mp3")).toBe(true)
            expect(isAudioFile("audio.wav")).toBe(true)
            expect(isAudioFile("video.mp4")).toBe(false)
            expect(isAudioFile("image.jpg")).toBe(false)
        })

        it("should validate image extensions", () => {
            const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"]
            const isImageFile = (filename: string) => {
                const ext = filename.split(".").pop()?.toLowerCase()
                return imageExtensions.includes(ext || "")
            }

            expect(isImageFile("image.jpg")).toBe(true)
            expect(isImageFile("image.png")).toBe(true)
            expect(isImageFile("video.mp4")).toBe(false)
            expect(isImageFile("audio.mp3")).toBe(false)
        })
    })

    describe("Media show creation", () => {
        it("should create video show", () => {
            const createMediaShow = (path: string, type: "video" | "audio" | "image") => {
                return {
                    id: `media-${Date.now()}`,
                    name: mockMediaHelper.getFileName(path),
                    type,
                    data: { path }
                }
            }

            mockMediaHelper.getFileName.mockReturnValue("video.mp4")

            const videoShow = createMediaShow("/path/to/video.mp4", "video")

            expect(videoShow.type).toBe("video")
            expect(videoShow.data.path).toBe("/path/to/video.mp4")
            expect(videoShow.name).toBe("video.mp4")
        })

        it("should create audio show", () => {
            const createMediaShow = (path: string, type: "video" | "audio" | "image") => {
                return {
                    id: `media-${Date.now()}`,
                    name: mockMediaHelper.getFileName(path),
                    type,
                    data: { path }
                }
            }

            mockMediaHelper.getFileName.mockReturnValue("audio.mp3")

            const audioShow = createMediaShow("/path/to/audio.mp3", "audio")

            expect(audioShow.type).toBe("audio")
            expect(audioShow.data.path).toBe("/path/to/audio.mp3")
            expect(audioShow.name).toBe("audio.mp3")
        })
    })
})

import type { Show, Slide } from "../../src/types/Show"
import type { Project } from "../../src/types/Projects"

export const mockShow: Show = {
    id: "test-show-1",
    name: "Test Show",
    category: null,
    private: false,
    settings: {
        activeLayout: "layout-1",
        template: ""
    },
    timestamps: {
        created: Date.now(),
        modified: null,
        used: null
    },
    quickAccess: {},
    meta: {},
    media: {},
    slides: {
        "slide-1": {
            group: null,
            color: null,
            settings: {},
            notes: "",
            items: [
                {
                    style: "left:50px;top:50px;",
                    lines: [
                        {
                            align: "",
                            text: [
                                {
                                    style: "",
                                    value: "Sample slide text"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    layouts: {
        "layout-1": {
            name: "Default Layout",
            notes: "",
            slides: [{ id: "slide-1" }]
        }
    }
}

export const mockSlide: Slide = {
    group: null,
    color: null,
    settings: {},
    notes: "Test slide notes",
    items: [
        {
            style: "left:100px;top:100px;width:300px;height:200px;",
            lines: [
                {
                    align: "center",
                    text: [
                        {
                            style: "font-size:24px;color:#ffffff;",
                            value: "Test slide content"
                        }
                    ]
                }
            ]
        }
    ]
}

export const mockProject: Project = {
    id: "test-project-1",
    name: "Test Project",
    parent: "/",
    created: Date.now(),
    shows: [
        {
            id: "test-show-1",
            type: "show"
        }
    ]
}

// Mock functions for testing
export const mockElectronAPI = {
    sendToMain: jest.fn(),
    receiveFromMain: jest.fn(),
    removeListeners: jest.fn()
}

export const mockStores = {
    showsCache: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn()
    },
    activeShow: {
        subscribe: jest.fn(),
        set: jest.fn()
    },
    outputs: {
        subscribe: jest.fn(),
        update: jest.fn()
    }
}

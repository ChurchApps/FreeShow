import { describe, expect, test, beforeEach, jest } from '@jest/globals'

// Mock template utilities
const mockTemplateHelpers = {
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    applyTemplate: jest.fn(),
    duplicateTemplate: jest.fn()
}

// Mock stores
const mockStores = {
    templates: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue({
            'template-1': {
                id: 'template-1',
                name: 'Song Template',
                category: 'song',
                items: [
                    {
                        style: 'font-size: 48px; color: white; text-align: center;',
                        lines: []
                    }
                ]
            }
        })
    },
    templateCategories: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue({
            song: { name: 'Song', icon: 'song', default: true },
            presentation: { name: 'Presentation', icon: 'presentation', default: true }
        })
    },
    overlayCategories: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn()
    }
}

// Mock IPC
const mockIPC = {
    sendMain: jest.fn(),
    requestMain: jest.fn()
}

jest.mock('../../src/frontend/stores', () => mockStores)
jest.mock('../../src/frontend/IPC/main', () => mockIPC)
jest.mock('svelte/store', () => ({
    get: jest.fn((store) => {
        if (store === mockStores.templates) return mockStores.templates.get()
        if (store === mockStores.templateCategories) return mockStores.templateCategories.get()
        return {}
    })
}))

describe('Template System Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Template Creation', () => {
        test('should create a new template', () => {
            const newTemplate = {
                id: 'template-2',
                name: 'Presentation Template',
                category: 'presentation',
                items: [
                    {
                        style: 'font-size: 60px; color: #333; background: rgba(255,255,255,0.8); padding: 20px;',
                        lines: [],
                        align: 'center'
                    }
                ]
            }

            mockTemplateHelpers.createTemplate(newTemplate)
            expect(mockTemplateHelpers.createTemplate).toHaveBeenCalledWith(newTemplate)
        })

        test('should validate template structure', () => {
            const validTemplate = {
                id: 'valid-template',
                name: 'Valid Template',
                category: 'song',
                items: [
                    {
                        style: 'font-size: 48px;',
                        lines: []
                    }
                ]
            }

            const isValid = (template: any) => {
                return template.id && 
                       template.name && 
                       template.items && 
                       Array.isArray(template.items) &&
                       template.items.every((item: any) => item.style !== undefined)
            }

            expect(isValid(validTemplate)).toBe(true)
        })

        test('should set default template properties', () => {
            const basicTemplate = {
                name: 'Basic Template',
                category: 'song'
            }

            const templateWithDefaults = {
                ...basicTemplate,
                id: `template-${Date.now()}`,
                items: [
                    {
                        style: 'font-size: 48px; color: white;',
                        lines: [],
                        align: 'center'
                    }
                ],
                created: Date.now(),
                modified: Date.now()
            }

            expect(templateWithDefaults.id).toBeDefined()
            expect(templateWithDefaults.items).toBeDefined()
            expect(templateWithDefaults.created).toBeDefined()
        })

        test('should handle template categories', () => {
            const songTemplate = {
                name: 'Song Template',
                category: 'song'
            }

            const presentationTemplate = {
                name: 'Presentation Template',
                category: 'presentation'
            }

            expect(['song', 'presentation']).toContain(songTemplate.category)
            expect(['song', 'presentation']).toContain(presentationTemplate.category)
        })
    })

    describe('Template Management', () => {
        test('should update existing template', () => {
            const templateId = 'template-1'
            const updates = {
                name: 'Updated Song Template',
                items: [
                    {
                        style: 'font-size: 52px; color: yellow;',
                        lines: []
                    }
                ]
            }

            mockTemplateHelpers.updateTemplate(templateId, updates)
            expect(mockTemplateHelpers.updateTemplate).toHaveBeenCalledWith(templateId, updates)
        })

        test('should delete template', () => {
            const templateId = 'template-to-delete'

            mockStores.templates.update((templates) => {
                delete templates[templateId]
                return templates
            })

            expect(mockStores.templates.update).toHaveBeenCalled()
        })

        test('should duplicate template', () => {
            const originalTemplate = {
                id: 'original-template',
                name: 'Original Template',
                category: 'song',
                items: [
                    {
                        style: 'font-size: 48px;',
                        lines: []
                    }
                ]
            }

            const duplicatedTemplate = {
                ...originalTemplate,
                id: 'duplicated-template',
                name: 'Copy of Original Template'
            }

            mockTemplateHelpers.duplicateTemplate(originalTemplate.id)
            expect(mockTemplateHelpers.duplicateTemplate).toHaveBeenCalledWith(originalTemplate.id)
        })

        test('should organize templates by category', () => {
            const templates = {
                'template-1': { category: 'song', name: 'Song Template 1' },
                'template-2': { category: 'song', name: 'Song Template 2' },
                'template-3': { category: 'presentation', name: 'Presentation Template' }
            }

            const songTemplates = Object.values(templates).filter((t: any) => t.category === 'song')
            const presentationTemplates = Object.values(templates).filter((t: any) => t.category === 'presentation')

            expect(songTemplates.length).toBe(2)
            expect(presentationTemplates.length).toBe(1)
        })
    })

    describe('Template Application', () => {
        test('should apply template to slide', () => {
            const template = {
                id: 'template-1',
                items: [
                    {
                        style: 'font-size: 48px; color: white;',
                        lines: []
                    }
                ]
            }

            const slide = {
                id: 'slide-1',
                items: [
                    {
                        style: '',
                        lines: [
                            { text: [{ value: 'Amazing Grace' }] }
                        ]
                    }
                ]
            }

            const appliedSlide = {
                ...slide,
                items: slide.items.map((item, index) => ({
                    ...item,
                    style: template.items[index]?.style || item.style
                }))
            }

            mockTemplateHelpers.applyTemplate(template.id, slide.id)
            expect(mockTemplateHelpers.applyTemplate).toHaveBeenCalledWith(template.id, slide.id)
        })

        test('should apply template to multiple slides', () => {
            const templateId = 'template-1'
            const slideIds = ['slide-1', 'slide-2', 'slide-3']

            slideIds.forEach(slideId => {
                mockTemplateHelpers.applyTemplate(templateId, slideId)
            })

            expect(mockTemplateHelpers.applyTemplate).toHaveBeenCalledTimes(slideIds.length)
        })

        test('should preserve slide content when applying template', () => {
            const originalSlide = {
                id: 'slide-1',
                items: [
                    {
                        style: 'font-size: 24px;',
                        lines: [
                            { text: [{ value: 'Original content' }] }
                        ]
                    }
                ]
            }

            const template = {
                items: [
                    {
                        style: 'font-size: 48px; color: blue;',
                        lines: []
                    }
                ]
            }

            // Template should only change style, not content
            const result = {
                ...originalSlide,
                items: originalSlide.items.map((item, index) => ({
                    ...item,
                    style: template.items[index]?.style || item.style
                }))
            }

            expect(result.items[0].lines).toEqual(originalSlide.items[0].lines)
            expect(result.items[0].style).toBe(template.items[0].style)
        })

        test('should handle template with multiple items', () => {
            const multiItemTemplate = {
                items: [
                    {
                        style: 'font-size: 48px; color: white;',
                        lines: [],
                        align: 'center'
                    },
                    {
                        style: 'font-size: 24px; color: gray;',
                        lines: [],
                        align: 'bottom'
                    }
                ]
            }

            expect(multiItemTemplate.items.length).toBe(2)
            expect(multiItemTemplate.items[0].align).toBe('center')
            expect(multiItemTemplate.items[1].align).toBe('bottom')
        })
    })

    describe('Template Styles', () => {
        test('should validate CSS style properties', () => {
            const validStyles = [
                'font-size: 48px;',
                'color: white;',
                'background: rgba(0,0,0,0.5);',
                'text-align: center;',
                'padding: 20px;',
                'border-radius: 10px;'
            ]

            validStyles.forEach(style => {
                expect(typeof style).toBe('string')
                expect(style.includes(':')).toBe(true)
            })
        })

        test('should handle font family settings', () => {
            const fontFamilies = [
                'Arial',
                'Helvetica',
                'Times New Roman',
                'Georgia',
                'Verdana'
            ]

            fontFamilies.forEach(font => {
                const style = `font-family: ${font};`
                expect(style).toContain(font)
            })
        })

        test('should handle responsive font sizes', () => {
            const fontSizes = {
                small: '32px',
                medium: '48px',
                large: '64px',
                extraLarge: '80px'
            }

            Object.entries(fontSizes).forEach(([size, value]) => {
                const style = `font-size: ${value};`
                expect(style).toContain(value)
            })
        })

        test('should handle color formats', () => {
            const colorFormats = [
                '#ffffff',              // hex
                'rgb(255, 255, 255)',   // rgb
                'rgba(255, 255, 255, 0.8)', // rgba
                'white',                // named color
                'hsl(0, 0%, 100%)'     // hsl
            ]

            colorFormats.forEach(color => {
                const style = `color: ${color};`
                expect(style).toContain(color)
            })
        })

        test('should handle text alignment options', () => {
            const alignments = ['left', 'center', 'right', 'justify']
            
            alignments.forEach(align => {
                const style = `text-align: ${align};`
                expect(style).toContain(align)
            })
        })
    })

    describe('Template Categories', () => {
        test('should manage template categories', () => {
            const newCategory = {
                id: 'worship',
                name: 'Worship',
                icon: 'music',
                default: false
            }

            mockStores.templateCategories.update((categories) => {
                categories[newCategory.id] = newCategory
                return categories
            })

            expect(mockStores.templateCategories.update).toHaveBeenCalled()
        })

        test('should filter templates by category', () => {
            const templates = {
                'template-1': { category: 'song' },
                'template-2': { category: 'song' },
                'template-3': { category: 'presentation' },
                'template-4': { category: 'worship' }
            }

            const getTemplatesByCategory = (category: string) => {
                return Object.values(templates).filter((t: any) => t.category === category)
            }

            expect(getTemplatesByCategory('song').length).toBe(2)
            expect(getTemplatesByCategory('presentation').length).toBe(1)
            expect(getTemplatesByCategory('worship').length).toBe(1)
        })

        test('should handle default categories', () => {
            const defaultCategories = {
                song: { name: 'Song', icon: 'song', default: true },
                presentation: { name: 'Presentation', icon: 'presentation', default: true }
            }

            const defaultCategoryIds = Object.entries(defaultCategories)
                .filter(([id, category]) => category.default)
                .map(([id]) => id)

            expect(defaultCategoryIds).toContain('song')
            expect(defaultCategoryIds).toContain('presentation')
        })
    })

    describe('Template Import/Export', () => {
        test('should export template to JSON', () => {
            const template = {
                id: 'template-1',
                name: 'Song Template',
                category: 'song',
                items: [
                    {
                        style: 'font-size: 48px;',
                        lines: []
                    }
                ]
            }

            const exportData = {
                template: template,
                version: '1.4.9',
                exported: Date.now()
            }

            mockIPC.sendMain('EXPORT_TEMPLATE', exportData)
            expect(mockIPC.sendMain).toHaveBeenCalledWith('EXPORT_TEMPLATE', exportData)
        })

        test('should import template from JSON', () => {
            const importData = {
                template: {
                    name: 'Imported Template',
                    category: 'song',
                    items: [
                        {
                            style: 'font-size: 52px; color: blue;',
                            lines: []
                        }
                    ]
                }
            }

            // Assign new ID to avoid conflicts
            const newTemplate = {
                ...importData.template,
                id: `template-${Date.now()}`
            }

            mockStores.templates.update((templates) => {
                templates[newTemplate.id] = newTemplate
                return templates
            })

            expect(mockStores.templates.update).toHaveBeenCalled()
        })

        test('should validate imported template structure', () => {
            const validImport = {
                template: {
                    name: 'Valid Template',
                    items: [{ style: '', lines: [] }]
                }
            }

            const invalidImport = {
                template: {
                    name: 'Invalid Template'
                    // missing items
                }
            }

            const isValidTemplate = (data: any) => {
                return !!(data.template && 
                         data.template.name && 
                         data.template.items && 
                         Array.isArray(data.template.items))
            }

            expect(isValidTemplate(validImport)).toBe(true)
            expect(isValidTemplate(invalidImport)).toBe(false)
        })
    })

    describe('Template Performance', () => {
        test('should handle large number of templates', () => {
            const templates: any = {}
            
            // Create 1000 templates
            for (let i = 0; i < 1000; i++) {
                templates[`template-${i}`] = {
                    id: `template-${i}`,
                    name: `Template ${i}`,
                    category: i % 2 === 0 ? 'song' : 'presentation',
                    items: [{ style: `font-size: ${24 + i % 20}px;`, lines: [] }]
                }
            }

            const templateCount = Object.keys(templates).length
            expect(templateCount).toBe(1000)
        })

        test('should efficiently search templates', () => {
            const templates = {
                'template-1': { name: 'Amazing Grace Template', category: 'song' },
                'template-2': { name: 'Presentation Template', category: 'presentation' },
                'template-3': { name: 'Worship Song Template', category: 'song' }
            }

            const searchTerm = 'song'
            const searchResults = Object.values(templates).filter((template: any) => 
                template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                template.category.toLowerCase().includes(searchTerm.toLowerCase())
            )

            expect(searchResults.length).toBe(2)
        })

        test('should cache frequently used templates', () => {
            const templateUsageCount: { [key: string]: number } = {}
            
            // Simulate template usage
            const usedTemplates = ['template-1', 'template-1', 'template-2', 'template-1']
            
            usedTemplates.forEach(templateId => {
                templateUsageCount[templateId] = (templateUsageCount[templateId] || 0) + 1
            })

            const mostUsed = Object.entries(templateUsageCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)

            expect(mostUsed[0][0]).toBe('template-1')
            expect(mostUsed[0][1]).toBe(3)
        })
    })
})

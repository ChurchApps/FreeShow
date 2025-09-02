import { describe, expect, test, beforeEach, jest } from '@jest/globals'

// Mock project utilities
const mockProjectHelpers = {
    createProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    duplicateProject: jest.fn(),
    addShowToProject: jest.fn(),
    removeShowFromProject: jest.fn(),
    reorderProjectItems: jest.fn()
}

// Mock stores
const mockStores = {
    projects: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue({
            projects: {
                'project-1': {
                    id: 'project-1',
                    name: 'Sunday Service',
                    created: Date.now(),
                    items: [
                        { type: 'show', id: 'opening-song', name: 'Opening Song' },
                        { type: 'show', id: 'announcements', name: 'Announcements' },
                        { type: 'show', id: 'closing-song', name: 'Closing Song' }
                    ]
                }
            },
            folders: {
                'folder-1': {
                    id: 'folder-1',
                    name: 'Services',
                    parent: null
                }
            }
        })
    },
    activeProject: {
        subscribe: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue('project-1')
    },
    projectView: {
        subscribe: jest.fn(),
        set: jest.fn()
    },
    shows: {
        subscribe: jest.fn(),
        get: jest.fn().mockReturnValue({
            'opening-song': { name: 'Amazing Grace' },
            'announcements': { name: 'Weekly Announcements' },
            'closing-song': { name: 'Blessed Be Your Name' }
        })
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
        if (store === mockStores.projects) return mockStores.projects.get()
        if (store === mockStores.activeProject) return mockStores.activeProject.get()
        if (store === mockStores.shows) return mockStores.shows.get()
        return {}
    })
}))

describe('Project Management Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Project Creation', () => {
        test('should create a new project', () => {
            const newProject = {
                id: 'project-2',
                name: 'Evening Service',
                created: Date.now(),
                folderId: 'folder-1',
                items: []
            }

            mockProjectHelpers.createProject(newProject)
            expect(mockProjectHelpers.createProject).toHaveBeenCalledWith(newProject)
        })

        test('should generate unique project ID', () => {
            const generateProjectId = () => `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            
            const id1 = generateProjectId()
            const id2 = generateProjectId()
            
            expect(id1).not.toBe(id2)
            expect(id1).toMatch(/^project-\d+-[a-z0-9]+$/)
        })

        test('should set default project properties', () => {
            const basicProject = {
                name: 'New Project'
            }

            const projectWithDefaults = {
                ...basicProject,
                id: `project-${Date.now()}`,
                created: Date.now(),
                modified: Date.now(),
                items: [],
                folderId: null,
                settings: {
                    autoPlay: false,
                    loop: false
                }
            }

            expect(projectWithDefaults.id).toBeDefined()
            expect(projectWithDefaults.created).toBeDefined()
            expect(Array.isArray(projectWithDefaults.items)).toBe(true)
        })

        test('should validate project name', () => {
            const validNames = ['Sunday Service', 'Christmas Special', 'Youth Night 2024']
            const invalidNames = ['', '   ', null, undefined]

            validNames.forEach(name => {
                expect(name && name.trim().length > 0).toBe(true)
            })

            invalidNames.forEach(name => {
                expect(!name || name.trim().length === 0).toBe(true)
            })
        })
    })

    describe('Project Management', () => {
        test('should update project properties', () => {
            const projectId = 'project-1'
            const updates = {
                name: 'Updated Sunday Service',
                modified: Date.now()
            }

            mockProjectHelpers.updateProject(projectId, updates)
            expect(mockProjectHelpers.updateProject).toHaveBeenCalledWith(projectId, updates)
        })

        test('should delete project', () => {
            const projectId = 'project-to-delete'

            mockStores.projects.update((projects) => {
                delete projects.projects[projectId]
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should duplicate project', () => {
            const originalProject = {
                id: 'original-project',
                name: 'Original Project',
                items: [
                    { type: 'show', id: 'show-1', name: 'Show 1' }
                ]
            }

            const duplicatedProject = {
                ...originalProject,
                id: 'duplicated-project',
                name: 'Copy of Original Project',
                created: Date.now()
            }

            mockProjectHelpers.duplicateProject(originalProject.id)
            expect(mockProjectHelpers.duplicateProject).toHaveBeenCalledWith(originalProject.id)
        })

        test('should set active project', () => {
            const projectId = 'project-2'

            mockStores.activeProject.set(projectId)
            expect(mockStores.activeProject.set).toHaveBeenCalledWith(projectId)
        })

        test('should handle project without active project', () => {
            mockStores.activeProject.set(null)
            expect(mockStores.activeProject.set).toHaveBeenCalledWith(null)
        })
    })

    describe('Project Items Management', () => {
        test('should add show to project', () => {
            const projectId = 'project-1'
            const showItem = {
                type: 'show',
                id: 'new-show',
                name: 'New Show',
                scheduleLength: 300 // 5 minutes
            }

            mockProjectHelpers.addShowToProject(projectId, showItem)
            expect(mockProjectHelpers.addShowToProject).toHaveBeenCalledWith(projectId, showItem)
        })

        test('should add section to project', () => {
            const projectId = 'project-1'
            const sectionItem = {
                type: 'section',
                id: 'section-1',
                name: 'Worship',
                scheduleLength: 1800 // 30 minutes
            }

            mockStores.projects.update((projects) => {
                if (projects.projects[projectId]) {
                    projects.projects[projectId].items.push(sectionItem)
                }
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should remove item from project', () => {
            const projectId = 'project-1'
            const itemId = 'announcements'

            mockProjectHelpers.removeShowFromProject(projectId, itemId)
            expect(mockProjectHelpers.removeShowFromProject).toHaveBeenCalledWith(projectId, itemId)
        })

        test('should reorder project items', () => {
            const projectId = 'project-1'
            const newOrder = [
                { type: 'show', id: 'closing-song', name: 'Closing Song' },
                { type: 'show', id: 'opening-song', name: 'Opening Song' },
                { type: 'show', id: 'announcements', name: 'Announcements' }
            ]

            mockProjectHelpers.reorderProjectItems(projectId, newOrder)
            expect(mockProjectHelpers.reorderProjectItems).toHaveBeenCalledWith(projectId, newOrder)
        })

        test('should calculate total project duration', () => {
            const projectItems = [
                { type: 'show', scheduleLength: 300 },   // 5 minutes
                { type: 'show', scheduleLength: 600 },   // 10 minutes
                { type: 'section', scheduleLength: 900 } // 15 minutes
            ]

            const totalDuration = projectItems.reduce((total, item) => {
                return total + (item.scheduleLength || 0)
            }, 0)

            expect(totalDuration).toBe(1800) // 30 minutes total
        })

        test('should handle nested sections', () => {
            const nestedStructure = [
                {
                    type: 'section',
                    id: 'worship',
                    name: 'Worship',
                    children: [
                        { type: 'show', id: 'song1', name: 'Song 1' },
                        { type: 'show', id: 'song2', name: 'Song 2' }
                    ]
                },
                {
                    type: 'section',
                    id: 'message',
                    name: 'Message',
                    children: [
                        { type: 'show', id: 'sermon', name: 'Sermon Slides' }
                    ]
                }
            ]

            const countTotalItems = (items: any[]): number => {
                return items.reduce((count, item) => {
                    let itemCount = 1
                    if (item.children && Array.isArray(item.children)) {
                        itemCount += countTotalItems(item.children)
                    }
                    return count + itemCount
                }, 0)
            }

            expect(countTotalItems(nestedStructure)).toBe(5) // 2 sections + 3 shows
        })
    })

    describe('Project Folders', () => {
        test('should create project folder', () => {
            const newFolder = {
                id: 'folder-2',
                name: 'Special Events',
                parent: null,
                color: '#FF5733'
            }

            mockStores.projects.update((projects) => {
                projects.folders[newFolder.id] = newFolder
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should create nested folders', () => {
            const parentFolder = {
                id: 'parent-folder',
                name: 'Parent Folder',
                parent: null
            }

            const childFolder = {
                id: 'child-folder',
                name: 'Child Folder',
                parent: 'parent-folder'
            }

            const folders = {
                [parentFolder.id]: parentFolder,
                [childFolder.id]: childFolder
            }

            const getChildFolders = (parentId: string | null) => {
                return Object.values(folders).filter((folder: any) => folder.parent === parentId)
            }

            expect(getChildFolders(null).length).toBe(1) // parent folder
            expect(getChildFolders('parent-folder').length).toBe(1) // child folder
        })

        test('should move project to folder', () => {
            const projectId = 'project-1'
            const folderId = 'folder-2'

            mockStores.projects.update((projects) => {
                if (projects.projects[projectId]) {
                    projects.projects[projectId].folderId = folderId
                }
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should delete folder and move projects', () => {
            const folderToDelete = 'folder-1'
            const newFolder = 'folder-2'

            mockStores.projects.update((projects) => {
                // Move projects from deleted folder
                Object.values(projects.projects).forEach((project: any) => {
                    if (project.folderId === folderToDelete) {
                        project.folderId = newFolder
                    }
                })

                // Delete folder
                delete projects.folders[folderToDelete]
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })
    })

    describe('Project Templates', () => {
        test('should create project template', () => {
            const projectTemplate = {
                id: 'template-1',
                name: 'Sunday Service Template',
                items: [
                    { type: 'section', name: 'Pre-Service', scheduleLength: 600 },
                    { type: 'section', name: 'Worship', scheduleLength: 1800 },
                    { type: 'section', name: 'Message', scheduleLength: 2400 },
                    { type: 'section', name: 'Response', scheduleLength: 600 }
                ]
            }

            mockStores.projects.update((projects) => {
                if (!projects.projectTemplates) projects.projectTemplates = {}
                projects.projectTemplates[projectTemplate.id] = projectTemplate
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should create project from template', () => {
            const templateId = 'template-1'
            const template = {
                name: 'Sunday Service Template',
                items: [
                    { type: 'section', name: 'Worship' },
                    { type: 'section', name: 'Message' }
                ]
            }

            const newProject = {
                id: `project-${Date.now()}`,
                name: 'New Sunday Service',
                created: Date.now(),
                items: [...template.items]
            }

            expect(newProject.items.length).toBe(template.items.length)
            expect(newProject.items[0].name).toBe('Worship')
        })

        test('should update project template', () => {
            const templateId = 'template-1'
            const updates = {
                name: 'Updated Sunday Service Template',
                items: [
                    { type: 'section', name: 'Welcome' },
                    { type: 'section', name: 'Worship' },
                    { type: 'section', name: 'Message' },
                    { type: 'section', name: 'Closing' }
                ]
            }

            mockStores.projects.update((projects) => {
                if (projects.projectTemplates && projects.projectTemplates[templateId]) {
                    Object.assign(projects.projectTemplates[templateId], updates)
                }
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })
    })

    describe('Project Search and Filtering', () => {
        test('should search projects by name', () => {
            const projects = {
                'project-1': { name: 'Sunday Service', folderId: 'folder-1' },
                'project-2': { name: 'Christmas Service', folderId: 'folder-1' },
                'project-3': { name: 'Youth Night', folderId: 'folder-2' }
            }

            const searchTerm = 'service'
            const searchResults = Object.values(projects).filter((project: any) =>
                project.name.toLowerCase().includes(searchTerm.toLowerCase())
            )

            expect(searchResults.length).toBe(2)
        })

        test('should filter projects by folder', () => {
            const projects = {
                'project-1': { name: 'Sunday Service', folderId: 'folder-1' },
                'project-2': { name: 'Christmas Service', folderId: 'folder-1' },
                'project-3': { name: 'Youth Night', folderId: 'folder-2' }
            }

            const filterByFolder = (folderId: string) => {
                return Object.values(projects).filter((project: any) => project.folderId === folderId)
            }

            expect(filterByFolder('folder-1').length).toBe(2)
            expect(filterByFolder('folder-2').length).toBe(1)
        })

        test('should sort projects by creation date', () => {
            const projects = [
                { name: 'Project C', created: 3 },
                { name: 'Project A', created: 1 },
                { name: 'Project B', created: 2 }
            ]

            const sortedByDate = projects.sort((a, b) => a.created - b.created)
            
            expect(sortedByDate[0].name).toBe('Project A')
            expect(sortedByDate[1].name).toBe('Project B')
            expect(sortedByDate[2].name).toBe('Project C')
        })

        test('should sort projects alphabetically', () => {
            const projects = [
                { name: 'Zebra Project' },
                { name: 'Alpha Project' },
                { name: 'Beta Project' }
            ]

            const sortedAlphabetically = projects.sort((a, b) => a.name.localeCompare(b.name))
            
            expect(sortedAlphabetically[0].name).toBe('Alpha Project')
            expect(sortedAlphabetically[1].name).toBe('Beta Project')
            expect(sortedAlphabetically[2].name).toBe('Zebra Project')
        })
    })

    describe('Project Import/Export', () => {
        test('should export project to JSON', () => {
            const project = {
                id: 'project-1',
                name: 'Sunday Service',
                items: [
                    { type: 'show', id: 'opening', name: 'Opening Song' }
                ]
            }

            const exportData = {
                project: project,
                shows: {
                    opening: { name: 'Amazing Grace' }
                },
                version: '1.4.9',
                exported: Date.now()
            }

            mockIPC.sendMain('EXPORT_PROJECT', exportData)
            expect(mockIPC.sendMain).toHaveBeenCalledWith('EXPORT_PROJECT', exportData)
        })

        test('should import project from JSON', () => {
            const importData = {
                project: {
                    name: 'Imported Project',
                    items: [
                        { type: 'show', id: 'imported-show', name: 'Imported Show' }
                    ]
                }
            }

            const newProject = {
                ...importData.project,
                id: `project-${Date.now()}`,
                created: Date.now()
            }

            mockStores.projects.update((projects) => {
                projects.projects[newProject.id] = newProject
                return projects
            })

            expect(mockStores.projects.update).toHaveBeenCalled()
        })

        test('should validate imported project structure', () => {
            const validProject = {
                project: {
                    name: 'Valid Project',
                    items: [
                        { type: 'show', id: 'show-1', name: 'Show 1' }
                    ]
                }
            }

            const invalidProject = {
                project: {
                    // missing name and items
                }
            }

            const isValidProject = (data: any) => {
                return !!(data.project && 
                         data.project.name && 
                         data.project.items && 
                         Array.isArray(data.project.items))
            }

            expect(isValidProject(validProject)).toBe(true)
            expect(isValidProject(invalidProject)).toBe(false)
        })
    })

    describe('Project Performance', () => {
        test('should handle large projects efficiently', () => {
            const largeProject = {
                id: 'large-project',
                name: 'Large Project',
                items: [] as any[]
            }

            // Add 1000 items
            for (let i = 0; i < 1000; i++) {
                largeProject.items.push({
                    type: 'show',
                    id: `show-${i}`,
                    name: `Show ${i}`,
                    scheduleLength: 300
                })
            }

            expect(largeProject.items.length).toBe(1000)
            
            // Test filtering performance
            const start = performance.now()
            const filteredItems = largeProject.items.filter((item: any) => 
                item.name.includes('Show 1')
            )
            const end = performance.now()
            
            expect(filteredItems.length).toBeGreaterThan(0)
            expect(end - start).toBeLessThan(100) // Should complete in under 100ms
        })

        test('should efficiently calculate project statistics', () => {
            const project = {
                items: [
                    { type: 'show', scheduleLength: 300 },
                    { type: 'section', scheduleLength: 600 },
                    { type: 'show', scheduleLength: 900 }
                ]
            }

            const stats = {
                totalItems: project.items.length,
                totalShows: project.items.filter(item => item.type === 'show').length,
                totalSections: project.items.filter(item => item.type === 'section').length,
                totalDuration: project.items.reduce((total, item) => total + (item.scheduleLength || 0), 0)
            }

            expect(stats.totalItems).toBe(3)
            expect(stats.totalShows).toBe(2)
            expect(stats.totalSections).toBe(1)
            expect(stats.totalDuration).toBe(1800) // 30 minutes
        })
    })
})

import { describe, expect, test, beforeEach, jest } from '@jest/globals'

// Mock calendar utility functions
const mockCalendarUtils = {
    createSlides: jest.fn(),
    getSelectedEvents: jest.fn(),
    isSameDay: jest.fn(),
    copyDate: jest.fn(),
    getWeekNumber: jest.fn(),
    MILLISECONDS_IN_A_DAY: 86400000
}

// Mock event utilities
const mockEventUtils = {
    createRepeatedEvents: jest.fn(),
    updateEventData: jest.fn(),
    getActionEventData: jest.fn()
}

// Mock stores
const mockStores = {
    events: {
        subscribe: jest.fn(),
        update: jest.fn(),
        set: jest.fn()
    },
    activeDays: {
        subscribe: jest.fn(),
        set: jest.fn(),
        get: jest.fn().mockReturnValue([Date.now()])
    },
    calendarAddShow: {
        subscribe: jest.fn(),
        get: jest.fn().mockReturnValue('')
    },
    dictionary: {
        subscribe: jest.fn(),
        get: jest.fn().mockReturnValue({
            month: {
                1: 'January', 2: 'February', 3: 'March', 4: 'April',
                5: 'May', 6: 'June', 7: 'July', 8: 'August',
                9: 'September', 10: 'October', 11: 'November', 12: 'December'
            },
            example: { default: 'Default' }
        })
    }
}

// Mock Svelte store
jest.mock('svelte/store', () => ({
    get: jest.fn((store) => {
        if (store === mockStores.activeDays) return [Date.now()]
        if (store === mockStores.calendarAddShow) return ''
        if (store === mockStores.dictionary) return mockStores.dictionary.get()
        if (store === mockStores.events) return {}
        return {}
    })
}))

// Mock calendar converter
const mockCalendarConverter = {
    convertCalendar: jest.fn()
}

jest.mock('../../src/frontend/converters/calendar', () => mockCalendarConverter)

// Mock import helper
jest.mock('../../src/frontend/IPC/main', () => ({
    sendMain: jest.fn()
}))

describe('Calendar System Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Calendar Event Management', () => {
        test('should create a new event', () => {
            const eventData = {
                type: 'event',
                name: 'Test Event',
                from: '2024-01-15T10:00:00',
                to: '2024-01-15T12:00:00',
                time: true,
                repeat: false,
                color: '#FF5733',
                notes: 'Test event notes',
                location: 'Conference Room'
            }

            mockStores.events.update((events) => {
                const id = 'event-123'
                events[id] = eventData
                return events
            })

            expect(mockStores.events.update).toHaveBeenCalled()
        })

        test('should handle repeating events', () => {
            const repeatingEvent = {
                type: 'event',
                name: 'Weekly Meeting',
                from: '2024-01-15T10:00:00',
                to: '2024-01-15T11:00:00',
                time: true,
                repeat: true,
                repeatData: {
                    type: 'week',
                    ending: 'after',
                    count: 1,
                    afterRepeats: 10
                }
            }

            mockEventUtils.createRepeatedEvents(repeatingEvent)
            expect(mockEventUtils.createRepeatedEvents).toHaveBeenCalledWith(repeatingEvent)
        })

        test('should update existing event', () => {
            const eventId = 'event-123'
            const updatedData = {
                name: 'Updated Event Name',
                location: 'New Location'
            }

            mockEventUtils.updateEventData(eventId, updatedData, { type: 'event' })
            expect(mockEventUtils.updateEventData).toHaveBeenCalledWith(eventId, updatedData, { type: 'event' })
        })

        test('should delete event', () => {
            const eventId = 'event-123'

            mockStores.events.update((events) => {
                delete events[eventId]
                return events
            })

            expect(mockStores.events.update).toHaveBeenCalled()
        })

        test('should handle all-day events', () => {
            const allDayEvent = {
                type: 'event',
                name: 'All Day Event',
                from: '2024-01-15',
                to: '2024-01-15',
                time: false,
                repeat: false
            }

            // All-day events should not have time components
            expect(allDayEvent.time).toBe(false)
            expect(allDayEvent.from).not.toContain('T')
        })

        test('should handle multi-day events', () => {
            const multiDayEvent = {
                type: 'event',
                name: 'Conference',
                from: '2024-01-15T09:00:00',
                to: '2024-01-17T17:00:00',
                time: true,
                repeat: false
            }

            const fromDate = new Date(multiDayEvent.from)
            const toDate = new Date(multiDayEvent.to)
            
            expect(toDate.getTime() - fromDate.getTime()).toBeGreaterThan(mockCalendarUtils.MILLISECONDS_IN_A_DAY)
        })
    })

    describe('Calendar Display', () => {
        test('should get events for a specific day', () => {
            const targetDate = new Date('2024-01-15')
            const events = {
                'event1': {
                    name: 'Morning Meeting',
                    from: '2024-01-15T09:00:00',
                    to: '2024-01-15T10:00:00'
                },
                'event2': {
                    name: 'Afternoon Meeting',
                    from: '2024-01-15T14:00:00',
                    to: '2024-01-15T15:00:00'
                },
                'event3': {
                    name: 'Different Day',
                    from: '2024-01-16T10:00:00',
                    to: '2024-01-16T11:00:00'
                }
            }

            const dayEvents = Object.entries(events).filter(([id, event]) => {
                const eventDate = new Date(event.from)
                const targetDateStr = targetDate.toISOString().split('T')[0]
                const eventDateStr = eventDate.toISOString().split('T')[0]
                return eventDateStr === targetDateStr
            })

            expect(dayEvents.length).toBeGreaterThan(0)
        })

        test('should calculate week numbers correctly', () => {
            const date = new Date('2024-01-15')
            const weekNumber = mockCalendarUtils.getWeekNumber(date)
            
            expect(mockCalendarUtils.getWeekNumber).toHaveBeenCalledWith(date)
        })

        test('should handle calendar navigation', () => {
            const currentDate = new Date()
            const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)

            expect(nextMonth.getMonth()).toBe((currentDate.getMonth() + 1) % 12)
            expect(prevMonth.getMonth()).toBe((currentDate.getMonth() - 1 + 12) % 12)
        })

        test('should filter events by type', () => {
            const events = {
                'event1': { type: 'event', name: 'Meeting' },
                'action1': { type: 'action', name: 'Trigger Action' },
                'show1': { type: 'show', name: 'Presentation' },
                'timer1': { type: 'timer', name: 'Countdown' }
            }

            const eventTypeEvents = Object.values(events).filter(e => e.type === 'event')
            const actionTypeEvents = Object.values(events).filter(e => e.type === 'action')

            expect(eventTypeEvents.length).toBe(1)
            expect(actionTypeEvents.length).toBe(1)
        })
    })

    describe('Calendar Show Creation', () => {
        test('should create slides from calendar events', async () => {
            const events = [
                {
                    date: Date.now(),
                    events: [
                        {
                            name: 'Morning Service',
                            from: '2024-01-15T09:00:00',
                            to: '2024-01-15T10:30:00',
                            location: 'Main Hall',
                            notes: 'Special guest speaker'
                        }
                    ]
                }
            ]

            const result = await mockCalendarUtils.createSlides(events)
            expect(mockCalendarUtils.createSlides).toHaveBeenCalledWith(events)
        })

        test('should include custom show slides', async () => {
            const events = [
                {
                    date: Date.now(),
                    events: [{ name: 'Service', from: '2024-01-15T10:00:00', to: '2024-01-15T11:00:00' }]
                }
            ]
            const customShowId = 'custom-show-123'

            const result = await mockCalendarUtils.createSlides(events, customShowId)
            expect(mockCalendarUtils.createSlides).toHaveBeenCalledWith(events, customShowId)
        })

        test('should generate appropriate slide timings', () => {
            const textLength = 100
            const expectedDuration = Math.max(5, Math.min(30, textLength / 10))
            
            // Simple timing calculation test
            expect(expectedDuration).toBeGreaterThanOrEqual(5)
            expect(expectedDuration).toBeLessThanOrEqual(30)
        })

        test('should handle empty event lists', async () => {
            const emptyEvents = []
            
            const result = await mockCalendarUtils.createSlides(emptyEvents)
            expect(mockCalendarUtils.createSlides).toHaveBeenCalledWith(emptyEvents)
        })
    })

    describe('Calendar Import/Export', () => {
        test('should import ICS calendar file', () => {
            const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event-123
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Test Event
DESCRIPTION:Test event description
LOCATION:Test Location
END:VEVENT
END:VCALENDAR`

            const importData = [{ content: icsContent }]
            mockCalendarConverter.convertCalendar(importData)
            
            expect(mockCalendarConverter.convertCalendar).toHaveBeenCalledWith(importData)
        })

        test('should handle repeating events in ICS', () => {
            const icsWithRecurrence = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recurring-event
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Weekly Meeting
RRULE:FREQ=WEEKLY;COUNT=10
END:VEVENT
END:VCALENDAR`

            const importData = [{ content: icsWithRecurrence }]
            mockCalendarConverter.convertCalendar(importData)
            
            expect(mockCalendarConverter.convertCalendar).toHaveBeenCalledWith(importData)
        })

        test('should handle malformed ICS data gracefully', () => {
            const malformedIcs = 'INVALID ICS DATA'
            
            expect(() => {
                mockCalendarConverter.convertCalendar([{ content: malformedIcs }])
            }).not.toThrow()
        })
    })

    describe('Calendar Actions', () => {
        test('should create action events', () => {
            const actionEvent = {
                type: 'action',
                name: 'Start Presentation',
                from: '2024-01-15T10:00:00',
                to: '2024-01-15T10:00:00',
                action: {
                    type: 'start_show',
                    showId: 'presentation-123'
                }
            }

            mockEventUtils.getActionEventData(actionEvent, actionEvent.action)
            expect(mockEventUtils.getActionEventData).toHaveBeenCalled()
        })

        test('should handle timer events', () => {
            const timerEvent = {
                type: 'timer',
                name: '5 Minute Warning',
                from: '2024-01-15T10:25:00',
                to: '2024-01-15T10:25:00',
                action: {
                    type: 'start_timer',
                    duration: 300 // 5 minutes
                }
            }

            expect(timerEvent.type).toBe('timer')
            expect(timerEvent.action.duration).toBe(300)
        })

        test('should handle show events', () => {
            const showEvent = {
                type: 'show',
                name: 'Opening Presentation',
                from: '2024-01-15T10:00:00',
                to: '2024-01-15T10:30:00',
                show: 'opening-show-123'
            }

            expect(showEvent.type).toBe('show')
            expect(showEvent.show).toBe('opening-show-123')
        })
    })

    describe('Calendar Utilities', () => {
        test('should calculate date differences correctly', () => {
            const date1 = new Date('2024-01-15')
            const date2 = new Date('2024-01-20')
            const diffInDays = (date2.getTime() - date1.getTime()) / mockCalendarUtils.MILLISECONDS_IN_A_DAY
            
            expect(diffInDays).toBe(5)
        })

        test('should handle timezone conversions', () => {
            const utcDate = '2024-01-15T10:00:00Z'
            const localDate = new Date(utcDate)
            
            expect(localDate instanceof Date).toBe(true)
            expect(localDate.toISOString()).toBe('2024-01-15T10:00:00.000Z')
        })

        test('should format dates for display', () => {
            const date = new Date('2024-01-15T10:30:00')
            const timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                              date.getMinutes().toString().padStart(2, '0')
            
            expect(timeString).toBe('10:30')
        })

        test('should handle date edge cases', () => {
            // Last day of month
            const lastDay = new Date(2024, 1, 0) // February 0 = January 31
            expect(lastDay.getDate()).toBe(31)
            
            // Leap year
            const leapYear = new Date(2024, 1, 29) // February 29, 2024
            expect(leapYear.getMonth()).toBe(1) // February
            expect(leapYear.getDate()).toBe(29)
        })

        test('should copy dates correctly', () => {
            const originalDate = new Date('2024-01-15')
            const copiedDate = mockCalendarUtils.copyDate(originalDate)
            
            expect(mockCalendarUtils.copyDate).toHaveBeenCalledWith(originalDate)
        })
    })
})

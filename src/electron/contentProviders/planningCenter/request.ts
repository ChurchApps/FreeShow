/**
 * WARNING: This file should ONLY be accessed through PlanningCenterProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or PlanningCenterProvider instead.
 */

import path from "path"
import { uid } from "uid"
import { ToMain } from "../../../types/IPC/ToMain"
import type { LessonsData } from "../../../types/Main"
import type { Project } from "../../../types/Projects"
import type { Chords, Show, Slide, SlideData } from "../../../types/Show"
import { downloadLessonsMedia } from "../../data/downloadMedia"
import { sendToMain } from "../../IPC/main"
import { getDataFolderPath } from "../../utils/files"
import { httpsRequest } from "../../utils/requests"
import { PCO_API_URL, pcoConnect, type PCOScopes } from "./connect"

const PCO_API_version = 2

type PCORequestData = {
    scope: PCOScopes
    endpoint: string
    params?: Record<string, string>
}

type SongSection = {
    label: string
    lyrics: string
    breaks_at?: number
}

type ParsedSectionLine = {
    text: string
    chords?: Chords[]
    repeatStartCount?: number
    repeatEndCount?: number
    hidden?: boolean
}

type RepeatConfig = {
    count: number
    startIndex: number
}

type RepeatDelimiterData = {
    cleanLine: string
    repeatStartCount?: number
    repeatEndCount?: number
    markerOnly: boolean
}

type SectionSourceLine = RepeatDelimiterData & {
    line: string
}

const chordTokenRegex = /^[A-G](?:#|b)?(?:m|maj|min|sus|add|aug|dim)?\d*(?:\/[A-G](?:#|b)?)?$/i

function isColumnBreakLine(line: string): boolean {
    return line.trim().toUpperCase() === "COLUMN_BREAK"
}

function isChordProgressionLine(line: string): boolean {
    const trimmed = line.trim()
    if (!trimmed) return false

    const withoutLabel = trimmed.replace(/^[A-ZÁÉÍÓÚÑ_ ]+:\s*/i, "").trim()
    if (!withoutLabel) return false

    const tokens = withoutLabel.split(/\s+/).filter(Boolean)
    if (!tokens.length) return false

    let chordCount = 0
    for (const rawToken of tokens) {
        // Strip trailing punctuation, then strip surrounding parentheses used as grouping markers
        const token = rawToken.replace(/[.,;:]+$/, "").replace(/^\(+/, "").replace(/\)+$/, "")

        // Token was composed entirely of parentheses (grouping markers like a lone "(" or ")")
        if (!token) continue

        if (chordTokenRegex.test(token)) {
            chordCount++
            continue
        }

        if (/^x\d+$/i.test(token) || /^\(x\d+\)$/i.test(token) || /^\|+$/.test(token) || /^-+$/.test(token) || /^\/+$/i.test(token)) {
            continue
        }

        return false
    }

    return chordCount >= 2
}

function parseChordChartIntoSections(chordChart: string): SongSection[] {
    const sections: SongSection[] = []
    const lines = chordChart.split(/\r?\n/)
    let currentSectionLabel = ""
    let currentSectionContent: string[] = []

    for (const line of lines) {
        const trimmed = line.trim()

        if (isColumnBreakLine(trimmed)) continue

        // Detect section headers (VERSE, CHORUS, BRIDGE, etc.)
        // Order matters: longer patterns first (PRECORO before PRE, INSTRUMENTAL before INTRO)
        const sectionMatch = trimmed.match(/^(PRECORO|ESTRIBILLO|INSTRUMENTAL|PUENTE|VERSE|CHORUS|VERSO|CORO|BRIDGE|INTRO|OUTRO|FINAL|PRE|BREAK|TAG|VAMP|INTERLUDE|BREAKDOWN|TURNAROUND|REFRAIN)(\s*\d+)?(?:\s|$)/i)
        if (sectionMatch) {
            // Save previous section if exists (including sections with only chords)
            if (currentSectionLabel) {
                const content = currentSectionContent.filter((l) => l.trim()).join("\n")
                if (content) {
                    sections.push({
                        label: currentSectionLabel,
                        lyrics: content
                    })
                }
            }
            currentSectionLabel = sectionMatch[0].trim()
            currentSectionContent = []
            continue
        }

        // Keep lyric lines (even if empty)
        if (trimmed) {
            currentSectionContent.push(line)
        }
    }

    // Save last section
    if (currentSectionLabel) {
        const content = currentSectionContent.filter((l) => l.trim()).join("\n")
        if (content) {
            sections.push({
                label: currentSectionLabel,
                lyrics: content
            })
        }
    }

    return sections
}

interface ServiceType {
    id: string
    attributes: {
        name: string
    }
}

interface Plan {
    id: string
    attributes: {
        title: string
        sort_date: string
        created_at: string
        items_count: number
    }
}

interface Arrangement {
    id: string
    type: string
}

interface ProjectItem {
    id: string
    attributes: {
        item_type: string
        title?: string
        description?: string
        length?: number
    }
    relationships: {
        arrangement: {
            data: Arrangement | null
        }
    }
    custom_arrangement_sequence?: any[]
}

export async function pcoRequest(data: PCORequestData, attempt = 0): Promise<any> {
    const MAX_RETRIES = 3
    const PCO_ACCESS = await pcoConnect(data.scope)

    if (!PCO_ACCESS) {
        sendToMain(ToMain.ALERT, "Not authorized at Planning Center (try logging out and in again)!")
        return null
    }

    // Build the API path with query parameters if provided
    let apiPath = `/${data.scope || "services"}/v${PCO_API_version}/${data.endpoint}`
    if (data.params) {
        const queryParams = new URLSearchParams(data.params).toString()
        apiPath = `${apiPath}?${queryParams}`
    }

    const headers = { Authorization: `Bearer ${PCO_ACCESS.access_token}` }

    return new Promise((resolve) => {
        httpsRequest(PCO_API_URL, apiPath, "GET", headers, {}, (err, result) => {
            if (err) {
                // Handle rate limiting
                // https://developer.planning.center/docs/#/overview/rate-limiting
                if (err.statusCode === 429) {
                    const retryAfter = parseInt(err?.headers?.["retry-after"], 10) || 2
                    rateLimit(retryAfter)
                    return
                }

                const message = err.message?.includes("401") ? "Make sure you have created some 'services' in your account!" : err.message
                sendToMain(ToMain.ALERT, "Could not get data! " + message)
                return resolve(null)
            }

            let resultData = result.data

            // Convert to array for consistent handling
            if (!Array.isArray(resultData)) resultData = [resultData]

            resolve(resultData)
        })

        function rateLimit(retryAfter: number) {
            if (attempt >= MAX_RETRIES) {
                sendToMain(ToMain.ALERT, "Planning Center rate limit reached! Please try again later")
                resolve(null)
                return
            }

            console.warn(`Rate limited. Retrying after ${retryAfter} seconds... (attempt ${attempt + 1})`)
            sendToMain(ToMain.ALERT, `Planning Center rate limit reached! Trying again in ${retryAfter} seconds`)

            setTimeout(async () => {
                const retryResult = await pcoRequest(data, attempt + 1)
                resolve(retryResult)
            }, retryAfter * 1000)
        }
    })
}

const ONE_WEEK_MS = 604800000

export async function pcoLoadServices() {
    const serviceTypes = await fetchServiceTypes()
    if (!serviceTypes) {
        console.info("No service types found in Planning Center")
        return
    }

    sendToMain(ToMain.TOAST, "Getting schedules from Planning Center")

    const results = await processAllServiceTypes(serviceTypes)

    if (results.downloadableMedia.length > 0) {
        downloadLessonsMedia(results.downloadableMedia)
    }

    sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "planningcenter", categoryName: "Planning Center", shows: results.shows, projects: results.projects })
}

async function fetchServiceTypes() {
    const typesEndpoint = "service_types"
    const serviceTypes = await pcoRequest({
        scope: "services",
        endpoint: typesEndpoint
    })

    if (!serviceTypes || !serviceTypes[0]?.id) {
        sendToMain(ToMain.ALERT, "No service types found in Planning Center! Please create some services first.")
        return null
    }

    return serviceTypes
}

async function processAllServiceTypes(serviceTypes: ServiceType[]): Promise<any> {
    const projects: Project[] = []
    const shows: Show[] = []
    const downloadableMedia: LessonsData[] = []

    await Promise.all(
        serviceTypes.map(async (serviceType) => {
            const servicePlans = await fetchServicePlans(serviceType)
            if (!servicePlans || !servicePlans.length) return

            const results = await processServicePlans(servicePlans, serviceType)

            projects.push(...results.projects)
            shows.push(...results.shows)
            downloadableMedia.push(...results.downloadableMedia)
        })
    )

    return { projects, shows, downloadableMedia }
}

async function fetchServicePlans(serviceType: ServiceType) {
    const typesEndpoint = "service_types"
    const plansEndpoint = `${typesEndpoint}/${serviceType.id}/plans`

    const servicePlans = await pcoRequest({
        scope: "services",
        endpoint: plansEndpoint,
        params: {
            order: "sort_date",
            filter: "future"
        }
    })

    if (!servicePlans || !servicePlans[0]?.id) {
        console.warn(`No plans found for service type ${serviceType.attributes.name} (${serviceType.id})`)
        return null
    }

    const filteredPlans = servicePlans.filter(({ attributes: a }: any) => {
        if (a.items_count === 0) return false
        const date = new Date(a.sort_date).getTime()
        const today = Date.now()
        return date < today + ONE_WEEK_MS
    })

    return filteredPlans
}

async function processServicePlans(plans: Plan[], serviceType: ServiceType) {
    const projects: Project[] = []
    const shows: Show[] = []
    const downloadableMedia: LessonsData[] = []

    await Promise.all(
        plans.map(async (plan: Plan) => {
            const results = await processPlan(plan, serviceType)
            if (results) {
                if (results.project) projects.push(results.project)
                if (results.shows.length) shows.push(...results.shows)
                if (results.downloadableMedia.length) downloadableMedia.push(...results.downloadableMedia)
            }
        })
    )

    return { projects, shows, downloadableMedia }
}

async function processPlan(plan: Plan, serviceType: ServiceType): Promise<any> {
    const typesEndpoint = "service_types"
    const plansEndpoint = `${typesEndpoint}/${serviceType.id}/plans`
    const itemsEndpoint = `${plansEndpoint}/${plan.id}/items`

    const planItems = await pcoRequest({ scope: "services", endpoint: itemsEndpoint, params: { per_page: "100" } })
    if (!planItems[0]?.id) return null

    const projectItems = []
    const shows = []
    const downloadableMedia: LessonsData[] = []

    for (const item of planItems) {
        const type = item.attributes.item_type
        let result: any

        if (type === "song") {
            result = await processSongItem(item, itemsEndpoint)
        } else if (type === "item") {
            result = processRegularItem(item)
        } else if (type === "media") {
            result = await processMediaItem(item, itemsEndpoint, serviceType)
        } else if (type === "header") {
            result = processHeaderItem(item)
        }

        if (result) {
            if (result.projectItem) projectItems.push(result.projectItem)
            if (result.show) shows.push(result.show)
            if (result.downloadableMedia) downloadableMedia.push(result.downloadableMedia)
        }
    }

    if (!projectItems.length) return null

    const project = createProjectData(plan, serviceType, projectItems)

    return { project, shows, downloadableMedia }
}

async function processSongItem(item: ProjectItem, itemsEndpoint: string) {
    const songDataEndpoint = `${itemsEndpoint}/${item.id}/song`
    const songData = (await pcoRequest({ scope: "services", endpoint: songDataEndpoint }))[0]
    if (!songData?.id) return null

    const arrangementEndpoint = `/songs/${songData.id}/arrangements/${item.relationships.arrangement.data?.id}`
    const songArrangement = (await pcoRequest({ scope: "services", endpoint: arrangementEndpoint }))[0]
    if (!songArrangement?.id) return null

    const song = songArrangement.attributes
    const sequence = item.custom_arrangement_sequence || song.sequence || []

    let sections: SongSection[] = []

    // Use chord_chart as primary source since it contains repeat markers (//)
    if (song.chord_chart) {
        sections = parseChordChartIntoSections(song.chord_chart)
    } else {
        // Fallback to sections endpoint if no chord_chart
        sections =
            (
                await pcoRequest({
                    scope: "services",
                    endpoint: `${arrangementEndpoint}/sections`
                })
            )[0]?.attributes.sections || []

        if (!sections.length) {
            sections = sequence.map((id: any) => ({ label: id, lyrics: "" }))
        } else {
            sections = sections.map(normalizeSongSection)
        }
    }

    // Order sections according to the arrangement sequence
    if (sequence.length && sections.length) {
        sections = getOrderedSections(sections, sequence)
    }

    // Debug log if we have a sequence but no sections after ordering
    if (sequence.length && !sections.length) {
        console.warn(`Planning Center: Song "${songData.attributes?.title}" has sequence but no matching sections. Sequence: ${sequence.join(", ")}`)
    }

    const show = getShow(songData, song, sections)
    const showId = `pcosong_${songData.id}`

    return {
        show: { id: showId, ...show },
        projectItem: { type: "show", id: showId, scheduleLength: item.attributes.length }
    }
}

function getOrderedSections(sections: SongSection[], sequence: any[]): SongSection[] {
    // Reorder sections according to the arrangement sequence
    // Create a comprehensive section map with multiple keys for flexible matching
    const sectionMap: { [key: string]: SongSection } = {}
    
    sections.forEach((section) => {
        const lowerLabel = section.label.toLowerCase()
        const normalizedLabel = lowerLabel.replace(/\s+/g, " ").trim()
        const nospaceLabel = normalizedLabel.replace(/\s+/g, "")
        
        // Store by all possible variations
        sectionMap[section.label] = section
        sectionMap[lowerLabel] = section
        sectionMap[normalizedLabel] = section
        sectionMap[nospaceLabel] = section
    })

    const orderedSections: SongSection[] = []
    const notFoundLabels: Set<string> = new Set()
    
    sequence.forEach((label) => {
        const normalizedSeqLabel = String(label).toLowerCase().replace(/\s+/g, " ").trim()
        const nospaceSeqLabel = normalizedSeqLabel.replace(/\s+/g, "")
        
        // Try to find matching section with multiple strategies
        let foundSection = sectionMap[label] ||
                          sectionMap[normalizedSeqLabel] ||
                          sectionMap[nospaceSeqLabel]
        
        // Try flexible matching for variations like "PRECORO 2" vs "PRECORO2"
        if (!foundSection) {
            const matchedKey = Object.keys(sectionMap).find(key => {
                const keyNormalized = key.toLowerCase().replace(/\s+/g, "")
                return keyNormalized === nospaceSeqLabel
            })
            if (matchedKey) {
                foundSection = sectionMap[matchedKey]
            }
        }
        
        // Try partial match (useful for variations)
        if (!foundSection) {
            const matchedKey = Object.keys(sectionMap).find(key => {
                const keyLower = key.toLowerCase()
                const labelLower = label.toLowerCase()
                return keyLower.startsWith(labelLower) || 
                       labelLower.startsWith(keyLower)
            })
            if (matchedKey) {
                foundSection = sectionMap[matchedKey]
            }
        }

        if (foundSection) {
            // Allow same section to appear multiple times in sequence
            orderedSections.push(foundSection)
        } else {
            notFoundLabels.add(label)
        }
    })

    if (notFoundLabels.size > 0) {
        const availableSections = Array.from(new Set(sections.map(s => s.label))).join(", ")
        console.warn(`Planning Center: Could not find sections for sequence labels: ${Array.from(notFoundLabels).join(", ")}. Available sections: ${availableSections}`)
    }

    return orderedSections
}

function normalizeSongSection(section: SongSection): SongSection {
    return {
        ...section,
        lyrics: normalizeLineBreaks(section.lyrics)
    }
}

function normalizeLineBreaks(text: string): string {
    // Normalize different line break formats to consistent \n
    return text.replace(/\n\r/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function getRepeatMarkerCount(value: string): number | undefined {
    if (!/^\/{2,}$/.test(value)) return undefined
    return value.length
}

function extractRepeatDelimiters(line: string): RepeatDelimiterData {
    let cleanLine = line
    let repeatStartCount: number | undefined
    let repeatEndCount: number | undefined

    const startMatch = cleanLine.match(/^(\s*)(\/{2,})/)
    if (startMatch) {
        repeatStartCount = getRepeatMarkerCount(startMatch[2])
        cleanLine = cleanLine.slice(startMatch[0].length)
    }

    const endMatch = cleanLine.match(/(\/{2,})(\s*)$/)
    if (endMatch) {
        repeatEndCount = getRepeatMarkerCount(endMatch[1])
        cleanLine = cleanLine.slice(0, cleanLine.length - endMatch[0].length)
    }

    const markerOnly = Boolean((repeatStartCount || repeatEndCount) && !cleanLine.trim())

    return { cleanLine, repeatStartCount, repeatEndCount, markerOnly }
}

function toSectionSourceLine(line: string): SectionSourceLine {
    const repeatData = extractRepeatDelimiters(line)
    return {
        ...repeatData,
        line: repeatData.cleanLine
    }
}

function toParsedSectionLine(source: SectionSourceLine, overrides: Partial<ParsedSectionLine> = {}): ParsedSectionLine {
    return {
        text: source.line.trim(),
        repeatStartCount: source.repeatStartCount,
        repeatEndCount: source.repeatEndCount,
        hidden: source.markerOnly,
        ...overrides
    }
}

function canAlignChordLineWithLyricLine(line: string): boolean {
    return Boolean(line.trim() && !isChordProgressionLine(line) && !getChordLineData(line) && !parseInlineBracketLine(line))
}

function copyChords(chords?: Chords[], generateIds = false): Chords[] | undefined {
    return chords?.map((chord) => ({ ...chord, ...(generateIds ? { id: uid(5) } : {}) }))
}

function parseInlineBracketLine(line: string): { text: string; chords: Chords[] } | null {
    if (!line.includes("[") || !line.includes("]")) return null

    let text = ""
    const chords: Chords[] = []
    let cursor = 0

    while (cursor < line.length) {
        const start = line.indexOf("[", cursor)
        if (start < 0) {
            text += line.slice(cursor)
            break
        }

        text += line.slice(cursor, start)
        const end = line.indexOf("]", start + 1)
        if (end < 0) {
            text += line.slice(start)
            break
        }

        const chord = line.slice(start + 1, end).trim()
        if (chord) {
            chords.push({ id: uid(5), pos: text.length, key: chord })
        }

        cursor = end + 1
    }

    if (!chords.length) return null
    return { text, chords }
}

function parsePlainChordLine(line: string): Chords[] | null {
    const matches = [...line.matchAll(/\S+/g)]
    if (!matches.length) return null

    const chords: Chords[] = []
    for (const match of matches) {
        // Strip surrounding parentheses used as grouping markers, e.g. "(G)" -> "G", "G)" -> "G"
        const token = match[0].replace(/^\(+/, "").replace(/\)+$/, "")
        const pos = match.index ?? 0

        // Token was just parentheses, or a separator character — skip without rejecting the line
        if (!token || /^\|+$/.test(token) || /^-+$/.test(token) || /^\/+$/i.test(token)) continue

        if (!chordTokenRegex.test(token)) return null
        chords.push({ id: uid(5), pos, key: token })
    }

    return chords.length ? chords : null
}

function getChordLineData(line: string): Chords[] | null {
    const inline = parseInlineBracketLine(line)
    if (inline && !inline.text.trim()) return inline.chords
    return parsePlainChordLine(line)
}

function alignChordsToLyricLine(chords: Chords[], rawLyricLine: string, sectionBaseOffset: number): { text: string; chords: Chords[] } {
    const lyricText = rawLyricLine.trim()
    const leadingWhitespace = rawLyricLine.length - rawLyricLine.trimStart().length
    const alignedChords: Chords[] = []

    chords
        .slice()
        .sort((a, b) => a.pos - b.pos)
        .forEach((chord) => {
            let pos = chord.pos - sectionBaseOffset - leadingWhitespace
            if (!lyricText.length) pos = 0
            else {
                if (pos < 0) pos = 0
                if (pos >= lyricText.length) pos = lyricText.length - 1
            }

            if (alignedChords.some((existingChord) => existingChord.pos === pos)) {
                pos++
            }

            alignedChords.push({ id: chord.id, key: chord.key, pos })
        })

    return { text: lyricText, chords: alignedChords }
}

function parseSectionLines(lyrics: string): ParsedSectionLine[] {
    const sourceLines = normalizeLineBreaks(lyrics)
        .split("\n")
        .filter((line) => !isColumnBreakLine(line))
        .map(toSectionSourceLine)

    // Planning Center often includes a common left indent in chord-only lines.
    // Remove that shared baseline so chord positions match lyric content columns.
    const sectionBaseOffset = sourceLines.reduce((minOffset, entry, i) => {
        const line = entry.line
        const lineChords = getChordLineData(line)
        if (!lineChords?.length || i + 1 >= sourceLines.length) return minOffset

        const nextLine = sourceLines[i + 1].line
        if (!canAlignChordLineWithLyricLine(nextLine)) return minOffset

        const firstChordPos = lineChords[0].pos
        if (minOffset === null) return firstChordPos
        return Math.min(minOffset, firstChordPos)
    }, null as number | null)

    const parsedLines: ParsedSectionLine[] = []

    for (let i = 0; i < sourceLines.length; i++) {
        const currentEntry = sourceLines[i]
        const currentLine = currentEntry.line

        if (!currentLine.trim()) {
            parsedLines.push(toParsedSectionLine(currentEntry, { text: "" }))
            continue
        }

        if (isChordProgressionLine(currentLine)) {
            continue
        }

        const inline = parseInlineBracketLine(currentLine)
        if (inline && inline.text.trim()) {
            parsedLines.push(toParsedSectionLine(currentEntry, { text: inline.text.trim(), chords: inline.chords, hidden: false }))
            continue
        }

        const chordLineData = getChordLineData(currentLine)
        if (chordLineData && i + 1 < sourceLines.length) {
            const nextEntry = sourceLines[i + 1]
            const nextLine = nextEntry.line
            if (canAlignChordLineWithLyricLine(nextLine)) {
                const alignedLine = alignChordsToLyricLine(chordLineData, nextLine, sectionBaseOffset || 0)
                parsedLines.push(toParsedSectionLine(nextEntry, { text: alignedLine.text, chords: alignedLine.chords }))
                i++
                continue
            }
        }

        parsedLines.push(toParsedSectionLine(currentEntry))
    }

    return parsedLines
}

function cloneParsedSectionLine(line: ParsedSectionLine): ParsedSectionLine {
    return {
        text: line.text,
        hidden: line.hidden,
        chords: copyChords(line.chords, true)
    }
}

function appendRepeatedBlock(targetLines: ParsedSectionLine[], repeatConfig: RepeatConfig) {
    const repeatedBlock = targetLines.slice(repeatConfig.startIndex)
    for (let repeatIndex = 1; repeatIndex < repeatConfig.count; repeatIndex++) {
        targetLines.push(...repeatedBlock.map(cloneParsedSectionLine))
    }
}

function getWholeSectionRepeatCount(lines: ParsedSectionLine[]): number {
    let activeRepeatCount: number | null = null
    let wholeSectionRepeatCount = 1
    let hasRepeatMarkers = false
    let hasContentOutsideRepeat = false

    lines.forEach((line) => {
        if (line.repeatStartCount && activeRepeatCount === null) {
            activeRepeatCount = line.repeatStartCount
            wholeSectionRepeatCount = Math.max(wholeSectionRepeatCount, line.repeatStartCount)
            hasRepeatMarkers = true
        }

        if (line.text.trim() && !line.hidden && activeRepeatCount === null) {
            hasContentOutsideRepeat = true
        }

        if (line.repeatEndCount && activeRepeatCount !== null) {
            wholeSectionRepeatCount = Math.max(wholeSectionRepeatCount, activeRepeatCount, line.repeatEndCount)
            activeRepeatCount = null
        }
    })

    if (activeRepeatCount !== null) {
        wholeSectionRepeatCount = Math.max(wholeSectionRepeatCount, activeRepeatCount)
    }

    return hasRepeatMarkers && !hasContentOutsideRepeat ? wholeSectionRepeatCount : 1
}

function expandRepeatedSectionLines(lines: ParsedSectionLine[]): ParsedSectionLine[] {
    const expandedLines: ParsedSectionLine[] = []
    let activeRepeat: RepeatConfig | null = null

    lines.forEach((line) => {
        const cleanLine: ParsedSectionLine = {
            text: line.text,
            hidden: line.hidden,
            chords: copyChords(line.chords)
        }

        if (line.repeatStartCount && !activeRepeat) {
            activeRepeat = {
                count: line.repeatStartCount,
                startIndex: expandedLines.length + (line.hidden ? 1 : 0)
            }
        }

        expandedLines.push(cleanLine)

        if (line.repeatEndCount && activeRepeat) {
            const endIndex = expandedLines.length - (line.hidden ? 1 : 0)
            const repeatedBlock = expandedLines.slice(activeRepeat.startIndex, endIndex)
            const repeatCount = Math.max(activeRepeat.count, line.repeatEndCount)

            for (let repeatIndex = 1; repeatIndex < repeatCount; repeatIndex++) {
                expandedLines.push(...repeatedBlock.map(cloneParsedSectionLine))
            }

            activeRepeat = null
        }
    })

    if (activeRepeat !== null) appendRepeatedBlock(expandedLines, activeRepeat)

    return expandedLines.filter((line) => !line.hidden)
}

function processRegularItem(item: ProjectItem) {
    const showId = `pcosong_${item.id}`
    const show = getShow(item, {}, [])

    return {
        show: { id: showId, ...show },
        projectItem: { type: "show", id: showId, scheduleLength: item.attributes.length }
    }
}

async function processMediaItem(item: ProjectItem, itemsEndpoint: string, serviceType: ServiceType) {
    const mediaEndpoint = `${itemsEndpoint}/${item.id}/media`
    const media = (await pcoRequest({ scope: "services", endpoint: mediaEndpoint }))[0]
    if (!media?.id) return null

    const attachment = (await pcoRequest({ scope: "services", endpoint: `media/${media.id}/attachments` }))[0]
    if (!attachment?.id) return null

    const downloadUrl = await getMediaStreamUrl(`attachments/${attachment.id}/open`)

    const mediaFolderPath = getDataFolderPath("planningcenter", serviceType.attributes.name)
    const filePath = path.join(mediaFolderPath, attachment.attributes.filename)

    return {
        projectItem: {
            name: media.attributes.title,
            scheduleLength: item.attributes.length,
            type: media.attributes.length ? "video" : "image",
            id: filePath
        },
        downloadableMedia: {
            name: serviceType.attributes.name,
            type: "planningcenter",
            files: [{ name: attachment.attributes.filename, url: downloadUrl }]
        } as LessonsData
    }
}

function processHeaderItem(item: ProjectItem) {
    return {
        projectItem: {
            type: "section",
            id: uid(5),
            name: item.attributes.title || "",
            scheduleLength: item.attributes.length,
            notes: item.attributes.description || ""
        }
    }
}

function createProjectData(plan: Plan, serviceType: ServiceType, projectItems: ProjectItem[]) {
    return {
        id: plan.id,
        name: plan.attributes.title || getDateTitle(plan.attributes.sort_date),
        scheduledTo: new Date(plan.attributes.sort_date).getTime(),
        created: new Date(plan.attributes.created_at).getTime(),
        folderId: serviceType.id || "",
        folderName: serviceType.attributes.name || "",
        items: projectItems
    }
}

function getDateTitle(dateString: string) {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 10)
}

const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"

function getShow(SONG_DATA: any, SONG: any, SECTIONS: any[]) {
    const slides: { [key: string]: Slide } = {}
    const layoutSlides: SlideData[] = []
    SECTIONS.forEach((section) => {
        const sectionLines = parseSectionLines(section.lyrics || "")
        const wholeSectionRepeatCount = getWholeSectionRepeatCount(sectionLines)
        const parsedLines =
            wholeSectionRepeatCount > 1
                ? sectionLines.filter((line) => !line.hidden)
                : expandRepeatedSectionLines(sectionLines)

        // Skip sections with no lyrics content
        if (!parsedLines.some((line) => line.text.trim())) return

        for (let repeatIndex = 0; repeatIndex < wholeSectionRepeatCount; repeatIndex++) {
            const slideId = uid()

            const items = [
                {
                    style: itemStyle,
                    lines: parsedLines.map((line) => {
                        const parsedLine: { align: string; text: { style: string; value: string }[]; chords?: Chords[] } = {
                            align: "",
                            text: [{ style: "", value: line.text }]
                        }
                        if (line.chords?.length) parsedLine.chords = line.chords
                        return parsedLine
                    })

                }
            ]

            slides[slideId] = {
                group: section.label,
                globalGroup: section.label.toLowerCase(),
                color: null,
                settings: {},
                notes: "",
                items
            }
            layoutSlides.push({ id: slideId })
        }
    })

    const title = SONG_DATA.attributes.title || ""

    const metadata = {
        title,
        author: SONG_DATA.attributes.author || "",
        publisher: SONG.name || "",
        copyright: SONG_DATA.attributes.copyright || "",
        CCLI: SONG_DATA.attributes.ccli_number || "",
        key: SONG.chord_chart_key || "",
        BPM: SONG.bpm || ""
    }

    const layoutId = uid()

    const show: Show = {
        name: title,
        category: "planning_center",
        timestamps: { created: new Date(SONG.created_at).getTime() || Date.now(), modified: new Date(SONG.updated_at).getTime() || null, used: null },
        meta: metadata,
        settings: {
            activeLayout: layoutId,
            template: null
        },
        layouts: {
            [layoutId]: {
                name: "Default",
                notes: SONG.notes || "",
                slides: layoutSlides
            }
        },
        slides,
        media: {}
    }

    return show
}

async function getMediaStreamUrl(endpoint: string): Promise<string> {
    const PCO_ACCESS = await pcoConnect("services")
    if (!PCO_ACCESS) return ""

    const apiPath = `/services/v${PCO_API_version}/${endpoint}`
    const headers = { Authorization: `Bearer ${PCO_ACCESS.access_token}` }

    return new Promise((resolve) => {
        httpsRequest(PCO_API_URL, apiPath, "POST", headers, {}, (err, result) => {
            if (err) {
                console.error("Could not get media stream URL:", err)
                return resolve("")
            }

            resolve(result.data.attributes.attachment_url)
        })
    })
}

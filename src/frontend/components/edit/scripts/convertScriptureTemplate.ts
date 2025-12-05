import type { Item, Template } from "../../../../types/Show"
import { clone } from "../../helpers/array"
import { getStyles } from "../../helpers/style"

interface ItemAnalysis {
  index: number
  item: Item
  type: "text" | "other"
  position: { top: number; left: number; width: number; height: number }
  hasMultipleLines: boolean
  lineCount: number
  textContent: string
  fontSize: number
  isLargest: boolean
  isSmallest: boolean
  isAtBottom: boolean
  isAtTop: boolean
  guessedRole: "verse" | "reference" | "version" | "unknown"
}

// Conversion strategies - each one tries a different approach
type ConversionStrategy = "position-based" | "size-based" | "content-based" | "combined"

const STRATEGIES: ConversionStrategy[] = ["combined", "position-based", "size-based", "content-based"]

// Store original items and current strategy index per template
const conversionState: Map<string, { originalItems: Item[]; strategyIndex: number }> = new Map()

/**
 * Get or initialize conversion state for a template
 */
function getConversionState(templateId: string, items: Item[]): { originalItems: Item[]; strategyIndex: number } {
  if (!conversionState.has(templateId)) {
    conversionState.set(templateId, {
      originalItems: clone(items),
      strategyIndex: 0
    })
  }
  return conversionState.get(templateId)!
}

/**
 * Clear conversion state for a template (used when undoing)
 */
export function clearConversionState(templateId: string): void {
  conversionState.delete(templateId)
}

/**
 * Get the original items before conversion (for undo)
 */
export function getOriginalItems(templateId: string): Item[] | null {
  const state = conversionState.get(templateId)
  return state ? clone(state.originalItems) : null
}

/**
 * Check if we have stored original items for undo
 */
export function canUndoConversion(templateId: string): boolean {
  return conversionState.has(templateId)
}

/**
 * Parse CSS style string to extract position values
 */
function parsePosition(style: string): { top: number; left: number; width: number; height: number } {
  const styles = getStyles(style)
  return {
    top: parseFloat(styles.top) || 0,
    left: parseFloat(styles.left) || 0,
    width: parseFloat(styles.width) || 0,
    height: parseFloat(styles.height) || 0
  }
}

/**
 * Extract font size from style string
 */
function extractFontSize(style: string): number {
  const match = style.match(/font-size:\s*(\d+)/)
  return match ? parseInt(match[1]) : 50
}

/**
 * Get plain text content from an item
 */
function getItemText(item: Item): string {
  if (!item.lines) return ""
  return item.lines.map(line => line.text?.map(t => t.value).join("") || "").join("\n")
}

/**
 * Analyze all text items in a template
 */
function analyzeItems(items: Item[]): ItemAnalysis[] {
  const textItems = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.type || item.type === "text")

  if (textItems.length === 0) return []

  const analyses: ItemAnalysis[] = textItems.map(({ item, index }) => {
    const position = parsePosition(item.style)
    const textContent = getItemText(item)
    const firstLineStyle = item.lines?.[0]?.text?.[0]?.style || ""
    const fontSize = extractFontSize(firstLineStyle || item.style)

    return {
      index,
      item,
      type: "text" as const,
      position,
      hasMultipleLines: (item.lines?.length || 0) > 1,
      lineCount: item.lines?.length || 0,
      textContent,
      fontSize,
      isLargest: false,
      isSmallest: false,
      isAtBottom: false,
      isAtTop: false,
      guessedRole: "unknown" as const
    }
  })

  // Determine relative positions and sizes
  const fontSizes = analyses.map(a => a.fontSize)
  const maxFontSize = Math.max(...fontSizes)
  const minFontSize = Math.min(...fontSizes)
  const tops = analyses.map(a => a.position.top)
  const maxTop = Math.max(...tops)
  const minTop = Math.min(...tops)

  analyses.forEach(analysis => {
    analysis.isLargest = analysis.fontSize === maxFontSize
    analysis.isSmallest = analysis.fontSize === minFontSize && minFontSize !== maxFontSize
    analysis.isAtBottom = analysis.position.top === maxTop && maxTop !== minTop
    analysis.isAtTop = analysis.position.top === minTop
  })

  return analyses
}

/**
 * Position-based strategy: Items at top = verse, items at bottom = reference
 */
function applyPositionStrategy(analyses: ItemAnalysis[]): ItemAnalysis[] {
  const sorted = [...analyses].sort((a, b) => a.position.top - b.position.top)

  sorted.forEach((analysis, i) => {
    if (i === 0) {
      analysis.guessedRole = "verse"
    } else if (i === sorted.length - 1) {
      analysis.guessedRole = "reference"
    } else {
      // Middle items could be version or additional verse boxes
      analysis.guessedRole = "version"
    }
  })

  return analyses
}

/**
 * Size-based strategy: Largest text = verse, smallest = reference/version
 */
function applySizeStrategy(analyses: ItemAnalysis[]): ItemAnalysis[] {
  const sorted = [...analyses].sort((a, b) => b.fontSize - a.fontSize)

  sorted.forEach((analysis, i) => {
    if (i === 0) {
      analysis.guessedRole = "verse"
    } else if (analyses.length === 2) {
      analysis.guessedRole = "reference"
    } else {
      // For 3+ items, second largest might be reference, smallest is version
      analysis.guessedRole = i === sorted.length - 1 ? "version" : "reference"
    }
  })

  return analyses
}

/**
 * Content-based strategy: Analyze text patterns
 */
function applyContentStrategy(analyses: ItemAnalysis[]): ItemAnalysis[] {
  analyses.forEach(analysis => {
    const text = analysis.textContent.toLowerCase()

    // Check for common patterns
    if (analysis.hasMultipleLines && analysis.lineCount >= 2) {
      // Multiple lines often indicates verse text with numbers
      analysis.guessedRole = "verse"
    } else if (text.includes("verse") || text.includes("chapter") || /\d+:\d+/.test(text)) {
      analysis.guessedRole = "reference"
    } else if (text.includes("niv") || text.includes("kjv") || text.includes("esv") || text.includes("nlt") || text.includes("version") || text.includes("bible")) {
      analysis.guessedRole = "version"
    } else if (analysis.isLargest) {
      analysis.guessedRole = "verse"
    } else {
      analysis.guessedRole = "reference"
    }
  })

  return analyses
}

/**
 * Combined strategy: Use multiple heuristics with weighting
 */
function applyCombinedStrategy(analyses: ItemAnalysis[]): ItemAnalysis[] {
  // Score each item for each role
  const scores: Map<number, { verse: number; reference: number; version: number }> = new Map()

  analyses.forEach(analysis => {
    const s = { verse: 0, reference: 0, version: 0 }

    // Position scoring
    if (analysis.isAtTop) s.verse += 3
    if (analysis.isAtBottom) s.reference += 2

    // Size scoring
    if (analysis.isLargest) s.verse += 4
    if (analysis.isSmallest) {
      s.version += 2
      s.reference += 1
    }

    // Content scoring
    if (analysis.hasMultipleLines) s.verse += 2
    if (analysis.position.height > 400) s.verse += 2
    if (analysis.position.height < 200) {
      s.reference += 1
      s.version += 1
    }

    // Check text patterns
    const text = analysis.textContent.toLowerCase()
    if (/\d+:\d+/.test(text)) s.reference += 3
    if (text.includes("verse") || text.includes("chapter")) s.reference += 2

    scores.set(analysis.index, s)
  })

  // Assign roles based on highest scores
  const assigned = new Set<string>()

  // First pass: assign highest confidence roles
  const sortedByVerseScore = [...analyses].sort((a, b) => (scores.get(b.index)?.verse || 0) - (scores.get(a.index)?.verse || 0))

  sortedByVerseScore.forEach(analysis => {
    const s = scores.get(analysis.index)!

    if (!assigned.has("verse") && s.verse >= s.reference && s.verse >= s.version) {
      analysis.guessedRole = "verse"
      assigned.add("verse")
    } else if (!assigned.has("reference") && s.reference >= s.version) {
      analysis.guessedRole = "reference"
      assigned.add("reference")
    } else if (!assigned.has("version")) {
      analysis.guessedRole = "version"
      assigned.add("version")
    } else {
      // Multiple verse boxes for translations
      analysis.guessedRole = "verse"
    }
  })

  return analyses
}

/**
 * Apply placeholders to item based on guessed role
 */
function applyPlaceholders(item: Item, role: "verse" | "reference" | "version" | "unknown", translationIndex: number = 0): Item {
  const newItem = clone(item)

  if (!newItem.lines || newItem.lines.length === 0) {
    newItem.lines = [{ align: "", text: [] }]
  }

  const prefix = translationIndex > 0 ? `scripture${translationIndex + 1}` : "scripture"

  switch (role) {
    case "verse":
      // Verse items get number + text placeholders
      newItem.lines = [
        {
          align: newItem.lines[0]?.align || "",
          text: [
            {
              value: `{${prefix}_number} `,
              style: getVerseNumberStyle(item)
            },
            {
              value: `{${prefix}_text}`,
              style: getVerseTextStyle(item)
            }
          ]
        }
      ]
      break

    case "reference":
      // Reference items get reference + name placeholders
      const refStyle = newItem.lines[0]?.text?.[0]?.style || "font-size: 55px;"
      const nameStyle = newItem.lines[1]?.text?.[0]?.style || newItem.lines[0]?.text?.[0]?.style || "font-size: 40px;"

      newItem.lines = [
        {
          align: newItem.lines[0]?.align || "",
          text: [{ value: `{${prefix}_reference}`, style: refStyle }]
        },
        {
          align: newItem.lines[1]?.align || newItem.lines[0]?.align || "",
          text: [{ value: `{${prefix}_name}`, style: nameStyle }]
        }
      ]
      break

    case "version":
      // Version-only items
      newItem.lines = [
        {
          align: newItem.lines[0]?.align || "",
          text: [
            {
              value: `{${prefix}_name}`,
              style: newItem.lines[0]?.text?.[0]?.style || "font-size: 40px;"
            }
          ]
        }
      ]
      break

    default:
      // Keep original content for unknown
      break
  }

  return newItem
}

/**
 * Extract style for verse numbers from original item
 */
function getVerseNumberStyle(item: Item): string {
  const baseStyle = item.lines?.[0]?.text?.[0]?.style || ""
  const baseFontSize = extractFontSize(baseStyle)
  const numberFontSize = Math.round(baseFontSize * 0.5) // 50% of text size

  // Keep color properties but adjust size
  let style = baseStyle.replace(/font-size:\s*\d+px;?/g, "")
  style = `font-size: ${numberFontSize}px;color: rgb(255 255 255 / 0.6);${style}`

  return style.replace(/;;/g, ";")
}

/**
 * Extract style for verse text from original item
 */
function getVerseTextStyle(item: Item): string {
  // Try to get style from second text element (verse text) or first
  return item.lines?.[0]?.text?.[1]?.style || item.lines?.[0]?.text?.[0]?.style || "font-size: 80px;"
}

/**
 * Check if template already uses new scripture placeholders
 */
export function hasScripturePlaceholders(template: Template): boolean {
  const text = template.items.map(item => getItemText(item)).join(" ")

  return text.includes("{scripture_")
}

/**
 * Convert an old-style template to new scripture template format
 * @param templateId The template ID (for tracking state)
 * @param template The template to convert
 * @param cycleStrategy If true, will try the next strategy instead of the current one
 * @returns The converted template
 */
export function convertToScriptureTemplate(templateId: string, template: Template, cycleStrategy: boolean = false): Template {
  // Get or initialize conversion state
  // On first conversion, store the original items
  // On retry, we'll use those original items to re-convert with a different strategy
  const state = getConversionState(templateId, template.items)

  // If cycling strategy, increment the index
  if (cycleStrategy) {
    state.strategyIndex = (state.strategyIndex + 1) % STRATEGIES.length
  }

  const strategy = STRATEGIES[state.strategyIndex]

  // Always start from the original items when converting
  const newTemplate = clone(template)
  newTemplate.items = clone(state.originalItems)

  // Ensure scripture mode is set
  if (!newTemplate.settings) {
    newTemplate.settings = {}
  }
  newTemplate.settings.mode = "scripture"

  // Analyze items (from the original, unconverted items)
  let analyses = analyzeItems(newTemplate.items)

  if (analyses.length === 0) {
    // No text items to convert
    return newTemplate
  }

  // Apply strategy
  switch (strategy) {
    case "position-based":
      analyses = applyPositionStrategy(analyses)
      break
    case "size-based":
      analyses = applySizeStrategy(analyses)
      break
    case "content-based":
      analyses = applyContentStrategy(analyses)
      break
    case "combined":
    default:
      analyses = applyCombinedStrategy(analyses)
      break
  }

  // Count verse items for translation numbering
  const verseItems = analyses.filter(a => a.guessedRole === "verse")
  let verseIndex = 0

  // Apply placeholders to items
  analyses.forEach(analysis => {
    const translationIndex = analysis.guessedRole === "verse" ? verseIndex++ : 0
    newTemplate.items[analysis.index] = applyPlaceholders(analysis.item, analysis.guessedRole, verseItems.length > 1 ? translationIndex : 0)
  })

  return newTemplate
}

/**
 * Get the name of the current conversion strategy for a template
 */
export function getCurrentStrategyName(templateId: string): string {
  const state = conversionState.get(templateId)
  const strategyIndex = state?.strategyIndex || 0
  const strategy = STRATEGIES[strategyIndex]

  const names: Record<ConversionStrategy, string> = {
    combined: "Combined (Smart)",
    "position-based": "Position-based",
    "size-based": "Size-based",
    "content-based": "Content-based"
  }

  return names[strategy]
}

/**
 * Get the number of available strategies
 */
export function getStrategyCount(): number {
  return STRATEGIES.length
}

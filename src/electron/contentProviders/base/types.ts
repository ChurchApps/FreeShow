export type ContentProviderId = "planningcenter" | "churchApps" | "amazinglife"

/**
 * Common types and interfaces for content providers
 */

export interface ContentProviderSongData {
    freeShowId: string
    title: string
    artist: string
    lyrics: string
    ccliNumber?: string
}

export interface ContentProviderServicePlan {
    id: string
    title: string
    date: Date
    items: ContentProviderPlanItem[]
}

export interface ContentProviderPlanItem {
    id: string
    title: string
    type: "song" | "media" | "text" | "announcement" | "other"
    data?: any
    lyrics?: string
    arrangement?: string
}

export interface ContentProviderService {
    id: string
    name: string
    plans: ContentProviderServicePlan[]
}

/**
 * Standard error types for content provider operations
 */
export enum ContentProviderErrorType {
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    NETWORK_ERROR = "NETWORK_ERROR",
    INVALID_SCOPE = "INVALID_SCOPE",
    RATE_LIMITED = "RATE_LIMITED",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export class ContentProviderError extends Error {
    constructor(
        public type: ContentProviderErrorType,
        message: string,
        public statusCode?: number,
        public retryAfter?: number
    ) {
        super(message)
        this.name = "ContentProviderError"
    }
}

/**
 * Options for content provider operations
 */
export interface LoadServicesOptions {
    dataPath: string
    limit?: number
    fromDate?: Date
    toDate?: Date
}

export interface ExportDataOptions {
    songs?: ContentProviderSongData[]
    overwrite?: boolean
    validateBeforeExport?: boolean
}

/**
 * Status information for content providers
 */
export interface ContentProviderStatus {
    connected: boolean
    lastSync?: Date
    error?: ContentProviderError
    scope?: string
}

/**
 * Category tree structure for content library
 */
export interface ContentLibraryCategory {
    name: string
    thumbnail?: string
    children?: ContentLibraryCategory[]
    key?: string
}

/**
 * Content file (image or video) with metadata
 */
export interface ContentFile {
    url: string
    thumbnail?: string
    fileSize: number
    type: "image" | "video"
    name?: string
    decryptionKey?: string
    mediaId?: string // Provider-specific media ID for tracking
    pingbackUrl?: string // URL to ping after 30+ seconds of playback
    providerId?: ContentProviderId // ID of the content provider this file came from
}
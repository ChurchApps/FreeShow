import express from "express"
import type { ContentFile, ContentLibraryCategory, ContentProviderId } from "./types"

/**
 * Base types for content provider authentication and requests
 */
export interface BaseAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: string
}

interface BaseRequestData {
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET" | "PUT" | "DELETE"
    data?: any
}

interface ContentProviderConfig {
    providerId: ContentProviderId
    displayName: string
    port: number
    clientId: string
    clientSecret: string
    apiUrl: string
    appUrl?: string
    authPath?: string
    scopes: readonly string[]
}

/**
 * Abstract base class for content providers that handles common functionality
 * like OAuth authentication, API requests, and connection management.
 */
export abstract class ContentProvider<TScope extends string = string, TAuthData extends BaseAuthData = BaseAuthData> {
    protected app = express()
    protected access: TAuthData | null = null
    protected config: ContentProviderConfig

    constructor(config: ContentProviderConfig) {
        this.config = config
        this.setupAuthRoutes()
    }

    /**
     * Establishes connection to the content provider
     */
    abstract connect(scope: TScope): Promise<TAuthData | null>

    /**
     * Disconnects from the content provider
     */
    abstract disconnect(scope?: TScope): void

    /**
     * Makes an authenticated API request
     */
    abstract apiRequest(data: BaseRequestData & { scope: TScope }): Promise<any>

    /**
     * Loads services/plans from the content provider
     */
    abstract loadServices(dataPath?: string): Promise<void>

    /**
     * Handles startup load operations
     */
    abstract startupLoad(scope: TScope, data?: any): Promise<void>

    /**
     * Exports data to the content provider (optional - not all providers support this)
     */
    exportData?(data: any): Promise<void>

    /**
     * Indicates if this provider has a content library
     */
    hasContentLibrary = false

    /**
     * Retrieves the content library category tree (optional - only if hasContentLibrary is true)
     */
    getContentLibrary?(): Promise<ContentLibraryCategory[]>

    /**
     * Retrieves content files for a given category key (optional - only if hasContentLibrary is true)
     */
    getContent?(key: string): Promise<ContentFile[]>

    /**
     * Checks if a media item is licensed and returns its pingback URL (optional)
     */
    checkMediaLicense?(mediaId: string): Promise<string | null>

    /**
     * Determines if a specific URL from this provider should be encrypted (optional)
     * @param url - The media URL to check
     * @param pingbackUrl - Optional pingback URL indicating licensed content
     * @returns true if the URL should be encrypted
     */
    shouldEncrypt?(url: string, pingbackUrl?: string): boolean

    /**
     * Returns the encryption key for this provider's media (optional)
     * @returns The encryption key to use for encrypting/decrypting media
     */
    getEncryptionKey?(): string

    /**
     * Validates if a scope is supported by this provider
     */
    protected validateScope(scope: string): scope is TScope {
        return this.config.scopes.includes(scope)
    }

    /**
     * Checks if the current access token is expired
     */
    protected isTokenExpired(): boolean {
        if (!this.access) return true
        const now = Date.now() / 1000
        return (this.access.created_at + this.access.expires_in) <= now
    }

    /**
     * Sets up common Express routes for OAuth authentication
     */
    protected setupAuthRoutes(): void {
        this.app.get(`${this.config.authPath || '/auth/complete'}`, (req, res) => {
            this.handleAuthCallback(req, res)
        })
    }

    /**
     * Handles the OAuth callback from the provider
     */
    protected abstract handleAuthCallback(req: express.Request, res: express.Response): void

    /**
     * Refreshes the access token if needed
     */
    protected abstract refreshToken(scope: TScope): Promise<TAuthData | null>

    /**
     * Performs the OAuth authentication flow
     */
    protected abstract authenticate(scope: TScope): Promise<TAuthData | null>

    /**
     * Common HTML responses for OAuth flow
     */
    protected get successHtml(): string {
        return `
        <head>
            <title>Success!</title>
        </head>
        <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
            <h1 style="color: #f0008c;">Success!</h1>
            <p>You can close this page</p>
        </body>`
    }

    protected get errorHtml(): string {
        return `
        <head>
            <title>Error!</title>
        </head>
        <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
            <h1>Could not complete authentication!</h1>
            <p>{error_msg}</p>
        </body>`
    }

    /**
     * Gets provider name
     */
    get id(): string {
        return this.config.providerId
    }

    /**
     * Gets provider display name
     */
    get displayName(): string {
        return this.config.displayName
    }

    /**
     * Gets supported scopes
     */
    get supportedScopes(): readonly string[] {
        return this.config.scopes
    }
}

/**
 * Interface for content provider factory registration
 */
export type ContentProviderConstructor<T extends ContentProvider = ContentProvider> = new (...args: any[]) => T

/**
 * Factory for managing content provider instances
 */
export class ContentProviderFactory {
    private static providers = new Map<ContentProviderId, ContentProvider>()
    private static constructors = new Map<ContentProviderId, ContentProviderConstructor>()

    /**
     * Registers a content provider class
     */
    static register<T extends ContentProvider>(providerId: ContentProviderId, constructor: ContentProviderConstructor<T>): void {
        this.constructors.set(providerId, constructor)
    }

    /**
     * Creates or gets an existing content provider instance
     */
    static getProvider<T extends ContentProvider = ContentProvider>(providerId: ContentProviderId, ...args: any[]): T | null {
        if (this.providers.has(providerId)) {
            return this.providers.get(providerId) as T
        }

        const Constructor = this.constructors.get(providerId)
        if (!Constructor) {
            console.error(`Content provider '${providerId}' not registered`)
            return null
        }

        const instance = new Constructor(...args) as T
        this.providers.set(providerId, instance)
        return instance
    }

    /**
     * Gets all registered provider ids
     */
    static getRegisteredProviders(): ContentProviderId[] {
        return Array.from(this.constructors.keys())
    }

    /**
     * Removes a provider instance
     */
    static removeProvider(providerId: ContentProviderId): void {
        this.providers.delete(providerId)
    }
}
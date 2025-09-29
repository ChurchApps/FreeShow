import express from "express"

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

export interface BaseRequestData {
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET" | "PUT" | "DELETE"
    data?: any
}

export interface ContentProviderConfig {
    name: string
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
    get name(): string {
        return this.config.name
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
export interface ContentProviderConstructor<T extends ContentProvider = ContentProvider> {
    new (...args: any[]): T
}

/**
 * Factory for managing content provider instances
 */
export class ContentProviderFactory {
    private static providers = new Map<string, ContentProvider>()
    private static constructors = new Map<string, ContentProviderConstructor>()

    /**
     * Registers a content provider class
     */
    static register<T extends ContentProvider>(name: string, constructor: ContentProviderConstructor<T>): void {
        this.constructors.set(name, constructor)
    }

    /**
     * Creates or gets an existing content provider instance
     */
    static getProvider<T extends ContentProvider = ContentProvider>(name: string, ...args: any[]): T | null {
        if (this.providers.has(name)) {
            return this.providers.get(name) as T
        }

        const Constructor = this.constructors.get(name)
        if (!Constructor) {
            console.error(`Content provider '${name}' not registered`)
            return null
        }

        const instance = new Constructor(...args) as T
        this.providers.set(name, instance)
        return instance
    }

    /**
     * Gets all registered provider names
     */
    static getRegisteredProviders(): string[] {
        return Array.from(this.constructors.keys())
    }

    /**
     * Removes a provider instance
     */
    static removeProvider(name: string): void {
        this.providers.delete(name)
    }
}
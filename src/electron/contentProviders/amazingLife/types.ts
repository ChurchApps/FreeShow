export type AmazingLifeScopes = "openid profile email"

// Non-nullable version for internal use
export interface AmazingLifeAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: AmazingLifeScopes
}

export type AmazingLifeRequestData = {
    scope: AmazingLifeScopes
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET" | "PUT" | "DELETE"
    data?: any
}

export const AMAZING_LIFE_API_URL = "https://api.joinamazing.com"
export const AMAZING_LIFE_APP_URL = "https://app.joinamazing.com"
export const AMAZING_LIFE_OAUTH_BASE = "https://api.joinamazing.com/prod/aims/oauth"
export const AMAZING_LIFE_API_BASE = "https://api-prod.amazingkids.app"

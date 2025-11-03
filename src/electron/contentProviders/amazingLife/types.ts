export type AmazingLifeScopes = "openid profile email"

export type AmazingLifeAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: AmazingLifeScopes
} | null

export type AmazingLifeRequestData = {
    scope: AmazingLifeScopes
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET" | "PUT" | "DELETE"
    data?: any
}

export const AMAZING_LIFE_API_URL = "https://api.joinamazing.dev"
export const AMAZING_LIFE_APP_URL = "https://app.joinamazing.dev"
export const AMAZING_LIFE_OAUTH_BASE = "https://api.joinamazing.dev/dev/aims/oauth"

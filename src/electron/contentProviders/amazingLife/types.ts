export type AmazingLifeScopes = "services"

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

// Prod URLs
export const AMAZING_LIFE_API_URL = "https://api.amazinglife.church"
export const AMAZING_LIFE_APP_URL = "https://app.amazinglife.church"

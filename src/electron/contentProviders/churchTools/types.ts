export type CTScopes = "services"

export type CTAuthData = {
    access_token: string   // CT personal API (Login) token
    refresh_token: string  // unused — CT tokens don't expire by default
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: CTScopes
    domain: string         // hostname only, e.g. "fegmso.church.tools"
    sngFolder?: string              // local SongBeamer .sng folder for lyrics fallback
    sngTranslationMethod?: "multiline" | "textboxes"  // how bilingual .sng files are converted
    weeksAhead?: number             // how many weeks of services to sync (default 2)
} | null

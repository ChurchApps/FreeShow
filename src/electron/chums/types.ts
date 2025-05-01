
export type ChumsScopes = "plans"

export type ChumsAuthData = {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  created_at: number
  expires_in: number
  scope: ChumsScopes
} | null

export type ChumsRequestData = {
  api: "doing" | "content"
  scope: ChumsScopes
  endpoint: string
  authenticated: boolean
  params?: Record<string, string>
  method?: "POST" | "GET"
  data?: any
}

//Prod URLs (commented out for now)
/*
export const MEMBERSHIP_API_URL = "https://membershipapi.churchapps.org"
export const DOING_API_URL = "https://doingapi.churchapps.org"
export const CONTENT_API_URL = "https://contentapi.churchapps.org"
export const CHUMS_API_URL = "https://app.chums.org"
*/

//Dev URLs
export const MEMBERSHIP_API_URL = "https://membershipapi.staging.churchapps.org"
export const DOING_API_URL = "https://doingapi.staging.churchapps.org"
export const CONTENT_API_URL = "https://contentapi.staging.churchapps.org"
export const CHUMS_API_URL = "https://app.staging.chums.org"

export const DEFAULT_CHUMS_DATA: ChumsAuthData = {
  access_token: "",
  refresh_token: "",
  token_type: "Bearer",
  created_at: 0,
  expires_in: 0,
  scope: "plans",
}

export interface ChumsSongData {
  freeShowId: string
  title: string
  artist: string
  lyrics: string
  ccliNumber: string
} 
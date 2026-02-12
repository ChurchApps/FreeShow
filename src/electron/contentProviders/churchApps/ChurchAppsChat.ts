import { ChurchAppsConnect } from "./ChurchAppsConnect"

export class ChurchAppsChat {
    public static async getOrCreateConversation(teamId: string): Promise<string | null> {
        const getResult = await ChurchAppsConnect.apiRequest({ api: "messaging", scope: "plans", endpoint: `/conversations/messages/freeshow/${teamId}`, authenticated: true, method: "GET" })

        if (Array.isArray(getResult) && getResult.length > 0 && getResult[0].id) {
            return getResult[0].id
        }

        const createData = [{ contentType: "freeshow", contentId: teamId, allowAnonymousPosts: true, visibility: "public" }]
        const createResult = await ChurchAppsConnect.apiRequest({ api: "messaging", scope: "plans", endpoint: "/conversations", authenticated: true, method: "POST", data: createData })

        if (Array.isArray(createResult) && createResult.length > 0 && createResult[0].id) {
            return createResult[0].id
        }

        console.error("[ChurchAppsChat] Failed to get or create conversation")
        return null
    }

    public static async sendMessage(data: { churchId: string; conversationId: string; displayName: string; content: string }): Promise<boolean> {
        const message = [{ churchId: data.churchId, content: data.content, conversationId: data.conversationId, displayName: data.displayName }]
        const result = await ChurchAppsConnect.apiRequest({ api: "messaging", scope: "plans", endpoint: "/messages/send", authenticated: false, method: "POST", data: message })
        return result !== null
    }
}

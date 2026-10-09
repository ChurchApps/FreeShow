<script lang="ts">
    import { onMount } from "svelte"
    import { getEditItems } from "../../../components/edit/scripts/itemHelpers"
    import Icon from "../../../components/helpers/Icon.svelte"
    import { getLayoutRef } from "../../../components/helpers/show"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { activeEdit, activeShow, ai, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { chatSessions, getLLMManager } from "../../llm/llmManager"
    import { getSlideChatSystemPrompt } from "../../llm/prompts"
    import { ChatAction, chatActionLabels } from "../../manager/ChatAction"
    import AiRing from "./AiRing.svelte"

    export let sessionKey: string = ""

    $: activeSessionKey = sessionKey || $popupData?.sessionKey || getActiveSlideSessionKey($activeEdit, $activeShow)
    $: targetType = ($popupData?.targetType || ($activeEdit?.type === "overlay" ? "overlay" : $activeEdit?.type === "template" ? "template" : "slide")) as "slide" | "overlay" | "template"

    function getActiveSlideSessionKey(editState: any, showState: any): string {
        if (editState?.type === "overlay" && editState.id) {
            return `overlay_${editState.id}`
        }
        if (editState?.type === "template" && editState.id) {
            return `template_${editState.id}`
        }
        if (editState?.slide !== undefined && editState?.slide !== null) {
            const showId = showState?.id || editState.showId || ""
            const ref = getLayoutRef(showId)
            const slideId = ref[editState.slide]?.id || `slide_${editState.slide}`
            return `show_${showId}_slide_${slideId}`
        }
        return "default"
    }

    let chatInput = ""
    let isSending = false

    $: chatMessages = $chatSessions[activeSessionKey] || []

    onMount(() => {
        scrollToBottomChat()

        // auto focus input
        setTimeout(() => {
            const chatInputElement = document.querySelector(".chat-input") as HTMLInputElement
            if (chatInputElement) chatInputElement.focus()
        }, 50)
    })

    function scrollToBottomChat() {
        const messagesContainer = document.querySelector(".chat-messages")
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
    }

    async function sendChatMessage() {
        const inputPrompt = chatInput.trim()
        if (!inputPrompt || isSending) return

        const llm = getLLMManager()
        chatInput = ""

        if (!llm) return

        isSending = true
        setTimeout(scrollToBottomChat)

        try {
            const currentItems = getEditItems()
            const promptToUse = getSlideChatSystemPrompt(targetType, currentItems)
            const res = await llm.sendMessage(activeSessionKey, inputPrompt, { systemPrompt: promptToUse })
            if (res?.action && res.action.type === "APPLY_TO_SLIDE") {
                ChatAction.handle(res.action)
            }
            setTimeout(scrollToBottomChat)
        } catch (err) {
            console.error("Failed to send message:", err)
        } finally {
            isSending = false
            setTimeout(scrollToBottomChat)
        }
    }

    function handleChatKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendChatMessage()
        }
    }

    // function clearChat() {
    //     clearChatHistory(activeSessionKey)
    // }

    function getActionIcon(actionType: string): string {
        switch (actionType) {
            case "APPLY_TO_SLIDE":
                return "check"
            case "CREATE_TEMPLATE":
                return "template"
            case "CREATE_OVERLAY":
                return "overlay"
            default:
                return "slide"
        }
    }
</script>

<div class="chat-container">
    <!-- {#if chatMessages.length > 0}
        <MaterialButton class="popup-reset" icon="delete" title="Clear" on:click={clearChat} white />
    {/if} -->

    {#if $ai?.llm?.provider && $ai?.llm?.provider !== "none"}
        <div class="chat-messages">
            {#if chatMessages.length === 0}
                <Center faded>
                    <div class="empty-state">
                        <Icon id="ai" size={2.2} gradient />
                        <p class="placeholder"><T id="chat.ask" /></p>
                    </div>
                </Center>
            {:else}
                {#each chatMessages as msg (msg.id)}
                    <div class="chat-message {msg.role}">
                        <p>{msg.content}</p>

                        {#if msg.action}
                            <MaterialButton title="Execute Action" style="margin-top: 10px;padding: 0;border-radius: 50px;" on:click={() => ChatAction.handle(msg.action)}>
                                <AiRing opacity={0.85}>
                                    <div style="display: flex;align-items: center;justify-content: space-between;gap: 8px;padding: 8px 14px;">
                                        <Icon id={getActionIcon(msg.action.type)} size={1.1} white />

                                        <span>{translateText(chatActionLabels[msg.action.type] || "timer.create")}{msg.action.data?.name ? `: ${msg.action.data.name}` : ""}</span>
                                    </div>
                                </AiRing>
                            </MaterialButton>
                        {/if}
                    </div>
                {/each}
                {#if isSending}
                    <div class="chat-message assistant placeholder">
                        <p><T id="ai.processing" /></p>
                    </div>
                {/if}
            {/if}
        </div>
        <div class="chat-input-row">
            <input type="text" class="chat-input" placeholder={translateText("chat.type_message")} bind:value={chatInput} on:keydown={handleChatKeyDown} />
            <MaterialButton icon="send" title="chat.send" on:click={sendChatMessage} disabled={!chatInput.trim() || isSending} />
        </div>
    {:else}
        <Center faded>
            <p class="placeholder">No LLM provider configured in Settings > Smart</p>
        </Center>
    {/if}
</div>

<style>
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        opacity: 0.8;
    }

    .placeholder {
        font-style: italic;
        font-size: 0.95rem;
    }

    .chat-container {
        display: flex;
        flex-direction: column;
        height: 480px;
        max-height: calc(75vh - 80px);
        width: 560px;
        max-width: calc(85vw - 40px);
        overflow: hidden;
    }

    .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        padding: 12px;
        overflow-y: auto;
    }

    .chat-message {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 0.92rem;
        line-height: 1.45;
    }

    .chat-message p {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;

        user-select: text;
    }

    .chat-message.user {
        align-self: flex-end;
        background-color: var(--secondary-opacity);
        border: 1px solid var(--secondary);
        color: #f1f5f9;
        border-bottom-right-radius: 4px;
    }

    .chat-message.assistant,
    .chat-message.ai {
        align-self: flex-start;
        background-color: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e2e8f0;
        border-bottom-left-radius: 4px;
    }

    .chat-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background-color: rgba(0, 0, 0, 0.15);
    }

    .chat-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 8px 12px;
        color: #fff;
        font-size: 0.92rem;
        outline: none;
    }

    .chat-input:focus {
        border-color: var(--secondary);
    }
</style>

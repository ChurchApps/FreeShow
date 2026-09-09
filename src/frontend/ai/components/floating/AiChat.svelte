<script lang="ts">
    import { onMount } from "svelte"
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { ai } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { type ChatMessage, getLLMManager } from "../../llm/llmManager"
    import { ChatAction, chatActionLabels } from "../../manager/ChatAction"
    import AiRing from "./AiRing.svelte"

    // CHAT

    let chatMessages: ChatMessage[] = []
    let chatInput = ""
    let isSending = false

    onMount(() => {
        scrollToBottomChat()

        // highlight input
        const chatInputElement = document.querySelector(".chat-input") as HTMLInputElement
        if (chatInputElement) {
            chatInputElement.focus()
        }

        const llm = getLLMManager()
        if (llm) chatMessages = llm.getHistory()
    })

    function scrollToBottomChat() {
        const messagesContainer = document.querySelector(".chat-messages")
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
    }

    async function sendChatMessage() {
        if (!chatInput.trim() || isSending) return

        const llm = getLLMManager()
        const inputPrompt = chatInput.trim()
        chatInput = ""

        if (!llm) return

        // 1. Immediately append user message to local state so it appears in the UI right away
        const userMsg: ChatMessage = {
            id: `user_${Date.now()}`,
            role: "user",
            content: inputPrompt,
            timestamp: Date.now()
        }
        chatMessages = [...chatMessages, userMsg]
        setTimeout(scrollToBottomChat)

        // 2. Set loading flag to display the pending/thinking state
        isSending = true

        try {
            // 3. Request completion from LLM manager (this adds user & assistant to the manager's history)
            await llm.sendMessage(inputPrompt)

            // 4. Sync view with the manager's synced message history
            chatMessages = llm.getHistory()
            setTimeout(scrollToBottomChat)
        } catch (err) {
            console.error("Failed to send message:", err)
        } finally {
            isSending = false
        }
    }

    function handleChatKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendChatMessage()
        }
    }
</script>

<div class="chat-container">
    {#if $ai?.llm?.provider}
        <div class="chat-messages">
            {#if chatMessages.length === 0}
                <Center faded>
                    <p class="placeholder"><T id="chat.ask" /></p>
                </Center>
            {:else}
                {#each chatMessages as msg (msg.id)}
                    <div class="chat-message {msg.role}">
                        <p>{msg.content}</p>

                        {#if msg.action}
                            <MaterialButton title="Execute Action" style="margin-top: 10px;padding: 0;border-radius: 50px;" on:click={() => ChatAction.handle(msg.action)}>
                                <AiRing opacity={0.85}>
                                    <div style="display: flex;align-items: center;justify-content: space-between;gap: 8px;padding: 8px 14px;">
                                        <Icon id="add" white />

                                        <span>{translateText(chatActionLabels[msg.action.type])}: {msg.action.data.name || "Untitled"}</span>
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
            <MaterialButton icon="send" title="chat.send" on:click={sendChatMessage} />
        </div>
    {:else}
        <Center faded>
            <p class="placeholder">No LLM provider selected</p>
        </Center>
    {/if}
</div>

<style>
    .placeholder {
        font-style: italic;
        font-size: 0.9rem;
    }

    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;

        overflow: hidden;
    }

    .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        padding: 12px;

        overflow-y: auto;
    }

    .chat-message {
        max-width: 80%;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .chat-message p {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .chat-message.user {
        align-self: flex-end;
        /* background-color: rgba(0, 223, 216, 0.15);
        border: 1px solid rgba(0, 223, 216, 0.3); */
        background-color: var(--secondary-opacity);
        border: 1px solid var(--secondary);
        color: #f1f5f9;
    }

    .chat-message.ai {
        align-self: flex-start;
        background-color: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
    }

    .chat-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid #1e293b;
        background-color: rgba(0, 0, 0, 0.15);
    }

    .chat-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 8px 12px;
        color: #fff;
        font-size: 0.9rem;
        outline: none;
    }

    .chat-input:focus {
        border-color: var(--secondary);
    }
</style>

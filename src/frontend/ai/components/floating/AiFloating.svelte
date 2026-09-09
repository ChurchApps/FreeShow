<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { fade } from "svelte/transition"
    import { getShortBibleName } from "../../../components/drawer/bible/scripture"
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Tabs from "../../../components/main/Tabs.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { activePage, ai, aiSmartAction, aiSttStatus, aiSuggestions, language, outLocked, scriptures, settingsTab, sttTranscript } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { type ChatMessage, getLLMManager } from "../../llm/llmManager"
    import { ChatAction, chatActionLabels } from "../../manager/ChatAction"
    import { audioLevelStore, resolveSttEngine, SpeechToText } from "../../stt/stt"
    import { Transcript } from "../../stt/transcript"
    import AiRing from "./AiRing.svelte"
    import ConfidenceMeter from "./ConfidenceMeter.svelte"
    import SmartAction from "./SmartAction.svelte"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    // Active tab state
    let activeTab: "transcription" | "chat" = "transcription"
    $: tabs = {
        transcription: { name: "ai.transcription", icon: "microphone" } // , disabled: !$ai?.stt?.engine
        // chat: { name: "chat.chat", icon: "chat" } // WIP disable for now, I guess more useful to have in the slide/template editor directly
    }

    let isOpen = false
    function toggleExpand() {
        // close any visible actions
        aiSmartAction.set(null)

        setTimeout(() => (isOpen = !isOpen))

        enableListening()
    }

    // the transcript follows the speech while pinned to the bottom - scrolling up to read
    // history stops the auto-jump until the user returns to the bottom
    let transcriptElem: HTMLElement | undefined
    let transcriptPinned = true
    let autoScrollTimer: NodeJS.Timeout | null = null
    $: if (isOpen && activeTab === "transcription" && transcriptPinned && ($sttTranscript.finalized || $sttTranscript.unprocessed) && transcriptElem) scrollToBottom()
    $: if (!isOpen) transcriptPinned = true
    function scrollToBottom() {
        setTimeout(() => {
            if (!transcriptElem) return
            // already at the bottom: no scroll, and crucially no guard window that would swallow
            // a genuine user scroll gesture arriving between updates
            if (transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 2) return
            // the jump is instant (no smooth animation), so its single scroll event stays inside
            // this short guard instead of reading as a user unpin
            if (autoScrollTimer) clearTimeout(autoScrollTimer)
            autoScrollTimer = setTimeout(() => (autoScrollTimer = null), 150)
            transcriptElem.scrollTo(0, transcriptElem.scrollHeight)
        })
    }
    function onTranscriptScroll() {
        if (!transcriptElem || autoScrollTimer) return
        transcriptPinned = transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 40
    }

    // each newly registered word bumps a border confirmation pulse on the floating bubble
    let wordConfirmTick = 0
    let wordConfirmDurationMs = 260
    let previousWordCount = -1
    let burstWords = 0
    let burstTimer: NodeJS.Timeout | null = null
    $: updateWordConfirmation($sttTranscript.finalized, $sttTranscript.unprocessed)

    function updateWordConfirmation(finalizedText: string, unprocessedText: string) {
        const fullText = (finalizedText + (finalizedText && unprocessedText ? " " : "") + unprocessedText).trim()
        const nextCount = countRegisteredWords(fullText)

        // first run sets baseline without emitting confirmation
        if (previousWordCount < 0) {
            previousWordCount = nextCount
            return
        }

        const newWords = nextCount - previousWordCount
        previousWordCount = nextCount
        if (newWords <= 0) return

        burstWords += newWords
        if (!burstTimer) {
            // collect nearby words into one visual confirmation instead of rapid pulse spam
            burstTimer = setTimeout(flushWordPulseBurst, 120)
        }
    }

    function flushWordPulseBurst() {
        const wordsInBurst = burstWords
        burstWords = 0
        burstTimer = null
        if (!wordsInBurst) return

        wordConfirmDurationMs = Math.min(800, 260 + Math.max(0, wordsInBurst - 1) * 120)
        wordConfirmTick += 1
    }

    function countRegisteredWords(text: string) {
        const words = text.match(/\S+/g)
        return words?.length || 0
    }

    // STATE

    $: isEnabled = $ai.enabled
    $: micDeviceId = $ai.stt?.micDeviceId

    // SESSION
    // transcription runs when AI is enabled and a mic is configured

    let sessionMode: "off" | "stt" = "off"
    let lastMic = ""
    let lastEngine = ""

    $: engineId = resolveEngineId($ai.stt?.engine, $language)
    // the locale param only makes the default re-resolve when the UI language changes
    function resolveEngineId(explicit: string | undefined, _locale: string): string {
        return explicit || resolveSttEngine()
    }

    $: syncSession(isEnabled, micDeviceId, engineId)
    async function syncSession(enabled: boolean | undefined, mic: string | undefined, engine: string) {
        const mode = enabled && mic ? "stt" : "off"
        const micChanged = (mic || "") !== lastMic
        const engineChanged = engine !== lastEngine

        if (mode === sessionMode) {
            if (mode === "off" || (!micChanged && !engineChanged)) return

            // switching the input or the engine mid-session only swaps that piece
            lastMic = mic || ""
            lastEngine = engine
            const capture = micChanged ? await SpeechToText.restartCapture() : { ok: true }
            const engineResult = engineChanged ? await SpeechToText.restartEngine() : { ok: true }
            if (sessionMode === mode && (!capture.ok || !engineResult.ok)) state = "error"
            return
        }

        const previousMode = sessionMode
        sessionMode = mode
        lastMic = mic || ""
        lastEngine = engine

        if (previousMode === "stt" && mode !== "stt") SpeechToText.disable()

        if (mode === "stt") {
            const result = await SpeechToText.enable()
            if (sessionMode !== "stt") return
            state = result.ok ? "listening" : "error"
        } else {
            state = "inactive"
        }
    }

    // a runtime engine failure in the electron process ends the plain transcription session
    $: if (sessionMode === "stt" && $aiSttStatus.state === "error" && state === "listening") {
        state = "error"
        SpeechToText.stopCapture()
    }

    $: audioLevel = $audioLevelStore

    onDestroy(() => {
        if (burstTimer) clearTimeout(burstTimer)
        if (sessionMode === "stt") SpeechToText.disable()
        sessionMode = "off"
    })

    // LISTEN TOGGLE
    // the session normally follows the settings toggles - this is the manual pause/resume on top

    $: isListening = state === "listening"
    $: isStarting = state === "processing"
    async function enableListening() {
        if (isStarting || sessionMode === "off") return
        if (isListening) return

        const result = await SpeechToText.enable()
        if (sessionMode === "stt") state = result.ok ? "listening" : "error"
    }

    function openSettings() {
        isOpen = false
        settingsTab.set("ai")
        activePage.set("settings")
    }

    // SUGGESTIONS
    // confident suggestions surface here so the operator can present them with one click

    $: suggestions = $aiSuggestions

    function removeSuggestion(id: string) {
        aiSmartAction.update((cur) => (cur?.id === id ? null : cur))
        aiSuggestions.update((list) => list.filter((item) => item.id !== id))
    }

    // CHAT

    let chatMessages: ChatMessage[] = []
    let chatInput = ""
    let isSending = false

    onMount(() => {
        const llm = getLLMManager()
        if (!llm) return

        chatMessages = llm.getHistory()
    })

    $: if (activeTab === "chat") {
        setTimeout(() => {
            scrollToBottomChat()

            // highlight input
            const chatInputElement = document.querySelector(".chat-input") as HTMLInputElement
            if (chatInputElement) {
                chatInputElement.focus()
            }
        })
    }
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

<svelte:window on:keydown={(e) => isOpen && e.key === "Escape" && toggleExpand()} />

{#if isOpen}
    <div class="backdrop" on:mousedown|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

{#if !isOpen && state !== "inactive"}
    <SmartAction />
{/if}

<div class="speech-widget {isOpen ? 'is-open' : 'is-closed'}">
    <AiRing {state} {audioLevel} borderRadius={isOpen ? "20px" : "50%"} opacity={isOpen ? 0.8 : 0.4} fill {wordConfirmTick} {wordConfirmDurationMs}>
        {#if !isOpen}
            <button class="floating-trigger" on:click={toggleExpand} aria-label="Expand Speech Recognition Modal">
                {#if state === "inactive" || state === "error"}
                    <svg class="mic-icon" class:error={state === "error"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                {:else if state === "listening"}
                    <div class="smoky-audio-visualizer" style="--audio-level: {Math.min(audioLevel * 4, 1)}">
                        <div class="smoke-layer layer-4"></div>
                        <div class="smoke-layer layer-3"></div>
                        <div class="smoke-layer layer-2"></div>
                        <div class="smoke-layer layer-1"></div>
                    </div>
                {:else if state === "processing"}
                    <div class="spinner"></div>
                {/if}
            </button>
        {:else}
            <div class="modal-view">
                <div class="card-header">
                    <Tabs {tabs} bind:active={activeTab} />

                    <div class="headerActions">
                        {#if activeTab === "transcription" && $sttTranscript.finalized}
                            <MaterialButton icon="copy" title="ai.copy_transcript" style="padding: 10px;" on:click={() => Transcript.copy()} />
                        {/if}
                        <MaterialButton icon="settings" title="menu.settings" style="padding: 10px;" on:click={openSettings} />

                        <MaterialButton class="popup-close" icon="close" iconSize={1.2} title="actions.close" style="padding: 8px;" on:click={toggleExpand} />
                    </div>
                </div>

                {#if activeTab === "transcription"}
                    <div class="card-body">
                        {#if state === "error"}
                            <p class="placeholder error">{translateText($aiSttStatus.message || "Something went wrong...")}</p>
                        {:else if state === "processing"}
                            <div class="processing-view">
                                <div class="spinner large"></div>
                                <p><T id="ai.processing" /></p>
                            </div>
                        {:else if $sttTranscript.finalized || $sttTranscript.unprocessed}
                            <div class="transcript-box" bind:this={transcriptElem} on:scroll={onTranscriptScroll}>
                                <p>
                                    {$sttTranscript.finalized}{#if $sttTranscript.unprocessed}{" "}<span class="interim">{$sttTranscript.unprocessed}</span>{/if}
                                </p>
                            </div>
                        {:else}
                            <!-- inactive or listening -->
                            <Center faded>
                                <T id="ai.waiting" />
                            </Center>
                        {/if}
                    </div>

                    {#if suggestions.length}
                        <div class="suggestions-panel">
                            {#each suggestions as suggestion (suggestion.id)}
                                <div class="suggestion compact">
                                    <div class="suggestionHeader">
                                        <span class="reference">
                                            {suggestion.content}

                                            {#if suggestion.scriptureTranslation}
                                                <span class="translation">({getShortBibleName($scriptures[suggestion.scriptureTranslation]?.name)})</span>
                                            {/if}
                                        </span>

                                        {#if suggestion.confidence}
                                            <ConfidenceMeter confidence={suggestion.confidence} />
                                        {/if}

                                        <div class="fill" />

                                        {#if suggestion.action === "presented"}
                                            <Icon id="check" size={0.9} color="var(--primary-lighter)" title="ai.presented" />
                                        {:else if suggestion.trigger}
                                            <MaterialButton
                                                small
                                                icon="play"
                                                disabled={$outLocked}
                                                title="menu._title_display"
                                                on:click={() => {
                                                    suggestion.trigger?.()
                                                    // removeSuggestion(suggestion.id)
                                                }}
                                            />
                                        {/if}
                                        <MaterialButton small icon="close" title="actions.remove" on:click={() => removeSuggestion(suggestion.id)} />
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {:else if activeTab === "chat"}
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
                {/if}
            </div>
        {/if}
    </AiRing>
</div>

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        z-index: 5000;
    }

    .speech-widget {
        position: fixed;
        z-index: 5000;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        transition:
            top 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            left 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            right 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            width 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            height 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .speech-widget.is-closed {
        bottom: 45px;
        right: 45px;
        width: 62px;
        height: 62px;
        transform: translate(0, 0);
    }
    .speech-widget.is-open {
        bottom: 50%;
        right: 50%;
        transform: translate(50%, 50%);
        width: 560px;
        height: 400px;
        max-width: 90vw;
        max-height: 85vh;
    }

    .floating-trigger {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;

        /* Clips all burst and smoke transformations to the bubble's circular bounds */
        border-radius: 50%;
        overflow: hidden;
    }

    .mic-icon {
        width: 24px;
        height: 24px;
        stroke: #94a3b8;
    }
    .mic-icon.error {
        stroke: #ff2626;
    }

    /* Living cloud / crystal audio visualizer */
    .smoky-audio-visualizer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
    }

    /* Slow inner atmosphere: keeps the orb alive even in quiet input. */
    .smoky-audio-visualizer::before {
        content: "";
        position: absolute;
        inset: -22%;
        border-radius: 44% 56% 61% 39% / 46% 42% 58% 54%;
        background: radial-gradient(circle at 30% 35%, rgba(121, 255, 245, 0.24), transparent 34%), radial-gradient(circle at 70% 58%, rgba(132, 112, 255, 0.2), transparent 37%), radial-gradient(circle at 48% 72%, rgba(255, 118, 199, 0.12), transparent 32%);
        filter: blur(10px) saturate(1.15);
        opacity: calc(0.52 + var(--audio-level) * 0.22);
        transform: scale(calc(0.92 + var(--audio-level) * 0.2));
        animation: cloudDrift 8s ease-in-out infinite alternate;
    }

    /* Small glass glint: enough crystal to feel dimensional without becoming a gem icon. */
    .smoky-audio-visualizer::after {
        content: "";
        position: absolute;
        width: 46%;
        height: 28%;
        top: 17%;
        left: 20%;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0));
        filter: blur(2px);
        opacity: calc(0.18 + var(--audio-level) * 0.18);
        transform: rotate(-24deg);
        mix-blend-mode: screen;
    }

    .smoke-layer {
        position: absolute;
        pointer-events: none;
        border-radius: 42% 58% 55% 45% / 48% 43% 57% 52%;
        background: radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.38), transparent 25%), linear-gradient(135deg, rgba(80, 246, 235, 0.48), rgba(119, 105, 255, 0.34) 54%, rgba(246, 118, 200, 0.22));
        box-shadow:
            inset 0 0 8px rgba(255, 255, 255, 0.14),
            0 0 14px rgba(58, 225, 224, 0.15);
        mix-blend-mode: screen;
        will-change: transform, rotate, filter, opacity;
        transition:
            transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
            opacity 120ms ease-out,
            filter 120ms ease-out;
    }

    /* The layers react with different amplitudes so the center feels fluid, not synchronized. */
    .smoke-layer.layer-1 {
        width: 17px;
        height: 17px;
        z-index: 4;
        opacity: calc(0.62 + var(--audio-level) * 0.28);
        border-radius: 38% 62% 48% 52% / 56% 42% 58% 44%;
        clip-path: polygon(50% 0%, 88% 22%, 100% 62%, 72% 100%, 26% 92%, 0% 54%, 16% 18%);
        filter: blur(0.2px) drop-shadow(0 0 5px rgba(212, 255, 252, 0.34));
        transform: translate(-1px, -1px) scale(calc(1 + var(--audio-level) * 1.05));
        animation: crystalTurn 7s ease-in-out infinite;
    }

    .smoke-layer.layer-2 {
        width: 29px;
        height: 25px;
        z-index: 3;
        opacity: calc(0.42 + var(--audio-level) * 0.28);
        filter: blur(1.4px);
        transform: translate(4px, 2px) scale(calc(0.92 + var(--audio-level) * 0.9));
        animation: cloudTurnReverse 9s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-3 {
        width: 40px;
        height: 34px;
        z-index: 2;
        opacity: calc(0.3 + var(--audio-level) * 0.26);
        border-radius: 62% 38% 57% 43% / 42% 58% 40% 60%;
        filter: blur(3.2px);
        transform: translate(-4px, 4px) scale(calc(0.9 + var(--audio-level) * 0.72));
        animation: cloudTurn 11s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-4 {
        width: 52px;
        height: 45px;
        z-index: 1;
        opacity: calc(0.2 + var(--audio-level) * 0.22);
        border-radius: 48% 52% 36% 64% / 62% 38% 58% 42%;
        filter: blur(6px);
        transform: translate(3px, -2px) scale(calc(0.88 + var(--audio-level) * 0.58));
        animation: cloudTurnReverse 14s ease-in-out infinite alternate;
    }

    /* Rotate independently from transform so audio scaling remains active. */
    @keyframes crystalTurn {
        0%,
        100% {
            rotate: -8deg;
        }
        50% {
            rotate: 22deg;
        }
    }

    @keyframes cloudTurn {
        0% {
            rotate: -12deg;
        }
        100% {
            rotate: 18deg;
        }
    }

    @keyframes cloudTurnReverse {
        0% {
            rotate: 16deg;
        }
        100% {
            rotate: -14deg;
        }
    }

    @keyframes cloudDrift {
        0% {
            rotate: -8deg;
            translate: -2px 1px;
        }
        50% {
            rotate: 8deg;
            translate: 2px -1px;
        }
        100% {
            rotate: 15deg;
            translate: -1px 2px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .smoky-audio-visualizer::before,
        .smoke-layer {
            animation: none;
        }
    }

    /* Modal Layout Elements */
    .modal-view {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .card-header {
        padding: 5px 10px 5px 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #1e293b;
        background-color: rgb(0 0 0 / 0.1);
    }

    .card-header :global(.tabs) {
        background-color: transparent;
    }
    .card-header :global(.tabs button) {
        padding: 8px 12px;
    }
    .card-header :global(.tabs button.isActive) {
        background-color: rgb(0 0 0 / 0.15) !important;
    }

    .status-bar {
        padding: 6px 15px;
        background-color: rgb(0 0 0 / 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .ai-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        text-transform: uppercase;
        font-size: 0.75rem;
        font-weight: bold;
    }

    .headerActions {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .card-body {
        flex: 1;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
    }

    .transcript-box {
        width: 100%;
        max-height: 100%;
        overflow-y: auto;
        padding: 15px;
        font-size: 0.95rem;
        line-height: 1.5;
        cursor: text;
    }

    .transcript-box,
    .transcript-box p,
    .transcript-box span {
        user-select: text;
    }

    .transcript-box p {
        white-space: initial;
        overflow-wrap: anywhere;
        margin: 2px 0;
    }

    .interim {
        opacity: 0.45;
    }

    .placeholder {
        font-style: italic;
        font-size: 0.9rem;
    }
    .placeholder.error {
        color: #ff5050;
        font-style: normal;
        white-space: initial;
    }

    .processing-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #00dfd8;
    }

    .suggestion {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
    }

    .suggestions-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 200px;
        overflow-y: auto;
        flex-shrink: 0;

        background-color: rgb(0 0 0 / 0.1);
        border-top: 1px solid rgba(0, 0, 0, 0.3);
    }

    .suggestion.compact {
        gap: 1px;
        padding: 5px 10px;
        box-shadow: none;
    }

    .fill {
        flex: 1;
    }

    .suggestionHeader {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }
    .suggestionHeader .reference {
        font-weight: 600;
        white-space: nowrap;
    }

    /* Animations */
    .spinner {
        width: 22px;
        height: 22px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top-color: #00dfd8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .spinner.large {
        width: 32px;
        height: 32px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Chat Tab Layout */
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

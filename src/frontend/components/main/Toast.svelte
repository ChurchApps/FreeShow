<script lang="ts">
    import { slide } from "svelte/transition"
    import { toastMessages } from "../../stores"
    import T from "../helpers/T.svelte"

    $: messages = $toastMessages
    $: if (messages?.length) startTimer()

    const toastDuration = 4000 // ms
    let currentTimer: NodeJS.Timeout | null = null

    const clearEarly = [
        { if: "$toast.saving", when: "$toast.saved" },
        { if: "$toast.recording_started", when: "$toast.recording_stopped" },
    ]

    function startTimer() {
        // clear some early
        if (clearEarly.find((c) => messages[0] === c.if && messages.find((a) => a === c.when))) {
            if (currentTimer) clearTimeout(currentTimer)
            currentTimer = null
            removeCurrent()
        }

        if (currentTimer) return
        currentTimer = setTimeout(() => {
            currentTimer = null
            if (!messages.length) return

            removeCurrent()
        }, toastDuration)
    }

    function removeCurrent() {
        toastMessages.update((a) => {
            a.shift()
            return a
        })
    }
</script>

{#if messages?.[0]}
    <div class="toast" transition:slide>
        {#if messages[0][0] === "$"}
            {#key messages[0]}
                <T id={messages[0].slice(1)} />
            {/key}
        {:else}
            {messages[0]}
        {/if}
    </div>
{/if}

<style>
    .toast {
        position: absolute;
        bottom: 0;
        inset-inline-end: 0;
        max-width: var(--navigation-width);
        /* bottom: 80px;
        left: 50%;
        transform: translateX(-50%); */
        z-index: 5000;

        background-color: var(--primary-darker);
        color: var(--text);
        /* border: 2px solid var(--primary-lighter); */
        border: 2px solid var(--secondary);
        border-bottom: none;
        border-inline-end: none;
        font-size: 1.2em;

        padding: 8px 16px;

        /* line-break: anywhere; */
        overflow-x: auto;

        border-top-left-radius: 3px;
    }
</style>

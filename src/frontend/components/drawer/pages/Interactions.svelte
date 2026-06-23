<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { activeInteractions, activePopup, activeRename, interactions, labelsDisabled, openedInteractionId, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { formatTimeInteraction, getInteraction, initConnection, startInteraction, stopInteraction } from "./interactions"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    export let searchValue: string
    console.log(searchValue)

    function createNew() {
        const id = uid()
        interactions.update((a) => {
            a[id] = {
                name: "",
                inputs: [],
                lastConnection: initConnection() // init id for qr slide
            }
            return a
        })

        activeRename.set(`interaction_${id}`)
    }

    $: openedId = $openedInteractionId

    $: openedInteraction = $interactions[openedId] || null

    function updateInteractionName(id: string, value: string) {
        if (!value) return

        interactions.update((a) => {
            if (!a[id]) return a

            if (!a[id].name) openedInteractionId.set(id)

            a[id].name = value

            return a
        })
    }

    // OPENED

    function addInput() {
        popupData.set({ id: openedId })
        activePopup.set("interaction_input")
    }

    function rearrangeInputs(direction: "forward" | "backward", index: number) {
        interactions.update((a) => {
            const items = clone(a[openedId]?.inputs)
            if (!items) return a

            const currentItem = items.splice(index, 1)[0]

            if (direction === "forward") index = Math.min(index + 1, items.length)
            else if (direction === "backward") index = Math.max(index - 1, 0)

            a[openedId].inputs = [...items.slice(0, index), currentItem, ...items.slice(index)]

            return a
        })
    }

    const inputTypeIcons = {
        buttons: "grid",
        checkbox: "checkbox",
        radio: "radio_button",
        dropdown: "dropdown",
        input: "keyboard",
        slider: "slider",
        number_range: "ruler"
    }

    let answers: { [key: string]: any }[] = []
    let clients: { [key: string]: any } = {}
    let currentAnswer: any = null
    let inputIndex: number = -1
    let closed: boolean = false

    let seconds = 0
    let startTime = 0
    let startTimes: Record<number, number> = {}

    function hasAnswer(input: any) {
        if (!input) return false
        if (input.type === "text" || input.type === "number") return input.answer !== undefined && input.answer !== ""
        if (input.type === "multi_choice") return input.options?.some((o: any) => o.isAnswer)
        return false
    }

    function isCorrect(input: any, value: any) {
        if (!input) return false
        if (input.type === "text" || input.type === "number") {
            if (input.answer === undefined || input.answer === "") return false
            return String(value).toLowerCase().trim() === String(input.answer).toLowerCase().trim()
        }
        if (input.type === "multi_choice") {
            return input.options?.some((o: any) => o.isAnswer && o.value === value)
        }
        return false
    }

    function setOption(key: string, value: any) {
        interactions.update((a) => {
            if (!a[openedId]) return a
            a[openedId].options = a[openedId].options || {}

            if (key === "scorePoints" && value === defaultScorePoints) {
                delete a[openedId].options[key]
                return a
            }

            a[openedId].options[key] = value
            return a
        })
    }

    async function start() {
        await startInteraction(openedId)
    }

    let unsubscribes: (() => void)[] = []

    function unsubscribeAll() {
        unsubscribes.forEach((unsub) => unsub())
        unsubscribes = []
    }

    onDestroy(unsubscribeAll)

    $: {
        unsubscribeAll()
        if (openedId && $activeInteractions.includes(openedId)) {
            const interaction = getInteraction(openedId)
            if (interaction) {
                unsubscribes = [
                    interaction.onUpdate((data) => {
                        answers = data.answers
                        clients = data.clients
                        currentAnswer = data.currentAnswer
                        inputIndex = data.inputIndex
                        closed = data.closed
                    }),
                    interaction.onTick((data) => {
                        seconds = data.seconds
                        startTime = data.startTime
                        startTimes = data.startTimes || {}
                        closed = data.closed
                    })
                ]
            }
        } else {
            answers = []
            clients = {}
            currentAnswer = null
            inputIndex = -1
            closed = false
            seconds = 0
            startTime = 0
            startTimes = {}
        }
    }

    const scoreSystems = [
        { value: "incremental", label: "Incremental", data: "Points to each player with correct answer." },
        { value: "falloff", label: "Falloff", data: "Max points to first with correct answer, decreasing for subsequent correct answers." },
        { value: "speed", label: "Speed", data: "Points based on response speed, decreasing over time." }
    ]
    $: defaultScorePoints = openedInteraction?.options?.scoreSystem === "falloff" ? 10 : openedInteraction?.options?.scoreSystem === "speed" ? 100 : 1

    let showPlayers = false
    function kick(clientId: string) {
        const interaction = getInteraction(openedId)
        interaction?.kick(clientId)
    }

    let showOptions = false
    let showHistory = false
</script>

{#if openedId}
    <div class="banner">EXPERIMENTAL!</div>

    <div class="header">
        <MaterialButton disabled={showOptions || showHistory || showPlayers} style="padding: 6px;" icon="back" title="actions.back" on:click={() => openedInteractionId.set("")} />

        <p style="flex: 1;{openedInteraction?.name ? '' : 'font-style: italic;opacity: 0.7;'}">
            {openedInteraction?.name || translateText("main.unnamed")}
        </p>

        {#if $activeInteractions.includes(openedId)}
            <!-- game id -->
            {#if getInteraction(openedId)?.dbid}
                <span style="font-family: monospace; opacity: 0.8;">ID: <span style="user-select: text;">{getInteraction(openedId)?.dbid}</span></span>
            {/if}

            <!-- players count -->
            <MaterialButton style="padding: 6px;" icon="people" on:click={() => (showPlayers = !showPlayers)} white={!showPlayers}>
                <span style="font-family: monospace; opacity: 0.8;">{Object.keys(clients).length}</span>
            </MaterialButton>
        {:else if !showOptions && openedInteraction?.history?.length}
            <!-- history -->
            <MaterialButton style="padding: 6px;" icon="history" on:click={() => (showHistory = !showHistory)} white={!showHistory}>
                <span style="font-family: monospace; opacity: 0.8;">{openedInteraction.history.length}</span>
            </MaterialButton>
        {/if}
    </div>

    {#if showOptions}
        <div class="options">
            <MaterialToggleSwitch label="interaction.require_name" checked={openedInteraction?.options?.requireName ?? true} defaultValue={true} on:change={(e) => setOption("requireName", e.detail)} />
            {#if openedInteraction?.options?.requireName === false}
                <MaterialToggleSwitch label="interaction.random_names" checked={openedInteraction?.options?.randomNames ?? false} defaultValue={false} on:change={(e) => setOption("randomNames", e.detail)} />
            {/if}

            <MaterialToggleSwitch label="interaction.all_at_once" checked={openedInteraction?.options?.allAtOnce ?? false} defaultValue={false} disabled={openedInteraction?.inputs?.length <= 1} on:change={(e) => setOption("allAtOnce", e.detail)} />

            {#if !openedInteraction?.options?.allAtOnce}
                <MaterialNumberInput label="interaction.max_time (conditions.seconds)" value={openedInteraction?.options?.maxTime ?? 0} defaultValue={0} on:change={(e) => setOption("maxTime", e.detail)} />

                <InputRow>
                    <MaterialDropdown label="interaction.score_system" value={openedInteraction?.options?.scoreSystem || "incremental"} options={scoreSystems} on:change={(e) => setOption("scoreSystem", e.detail)} />
                    <MaterialNumberInput label="interaction.points" value={openedInteraction?.options?.scorePoints ?? defaultScorePoints} defaultValue={defaultScorePoints} on:change={(e) => setOption("scorePoints", e.detail)} />
                </InputRow>
            {/if}
        </div>
    {:else if showHistory && !$activeInteractions.includes(openedId)}
        <div class="history" style="display: flex;flex-direction: column;gap: 8px;padding: 10px;overflow: auto;">
            {#each clone(openedInteraction?.history || []).reverse() as entry}
                <div style="background-color: var(--primary-darkest);padding: 10px;border-radius: 6px;">
                    <p style="font-size: 0.8em;opacity: 0.7;margin-bottom: 8px;">{new Date(entry.time).toLocaleString()}</p>

                    {#if entry.leaderboard?.length}
                        <div style="margin-bottom: 12px; padding: 8px; background-color: rgba(255, 255, 255, 0.05); border-radius: 4px;">
                            <p style="font-weight: bold; font-size: 0.9em; margin-bottom: 6px; opacity: 0.9;">Leaderboard:</p>
                            <ol style="margin: 0; padding-left: 20px;">
                                {#each entry.leaderboard as player}
                                    <li style="margin-bottom: 4px; font-size: 0.9em;">
                                        <span style="font-weight: bold;">{player.name}</span>: {player.score} pts
                                    </li>
                                {/each}
                            </ol>
                        </div>
                    {/if}

                    <ol style="margin: 0;padding: 0 0 0 24px;">
                        {#each entry.inputs as input}
                            <li style="margin-bottom: 8px;" class="list">
                                <p style="font-weight: bold;margin-bottom: 4px;">{input.question || translateText("main.unnamed")}</p>
                                <ul style="margin: 0;padding: 0 0 0 24px;list-style-type: disc;">
                                    {#each input.answers as answer}
                                        <li style="margin-bottom: 4px;">
                                            <div style="display: flex;gap: 8px;">
                                                <span style="font-weight: bold;opacity: 0.9;">{answer.name}:</span>
                                                <span style="flex: 1;">
                                                    {#each Array.isArray(answer.value) ? answer.value : [answer.value] as value, i}
                                                        {i > 0 ? ", " : ""}
                                                        <span>{value}</span>
                                                    {/each}
                                                </span>
                                            </div>
                                        </li>
                                    {/each}
                                </ul>
                            </li>
                        {/each}
                    </ol>
                </div>
            {/each}
        </div>
    {:else if showPlayers && $activeInteractions.includes(openedId)}
        <div class="players">
            {#key clients}
                {#each getInteraction(openedId)?.getClients() || [] as client, i}
                    <!-- {@const hasScore = (getInteraction(openedId)?.getClients() || []).some((c) => (c.score || 0) > 0)} -->

                    <div class="player">
                        <Icon id="profiles" white />
                        <p style="flex: 1;">{client.name || `User #${i + 1}`}</p>

                        <!-- {#if hasScore} -->
                        <MaterialNumberInput label="interaction.points" value={client.score ?? 0} style="width: 100px;" on:change={(e) => getInteraction(openedId)?.setScore(client.id, e.detail)} />
                        <!-- {/if} -->
                        <MaterialButton style="padding: 4px;" red on:click={() => kick(client.id)}><T id="interaction.kick" /></MaterialButton>
                    </div>
                {/each}
                {#if Object.keys(clients).length === 0}
                    <p style="text-align: center;opacity: 0.5;padding: 10px;font-style: italic;"><T id="settings.connections" /></p>
                {/if}
            {/key}
        </div>
    {:else}
        <div class="inputs">
            {#if $activeInteractions.includes(openedId) && inputIndex === -1 && openedInteraction?.options?.allAtOnce !== true}<div style="border: 1px solid var(--secondary);"></div>{/if}
            <!-- <div style="border: 1px solid {inputIndex === -1 ? 'var(--secondary)' : 'transparent'};"></div> -->

            {#each openedInteraction?.inputs || [] as input, i}
                <InputRow arrow={$activeInteractions.includes(openedId) && Object.keys(answers[i] || {}).length > 0}>
                    <div
                        class="input {$activeInteractions.includes(openedId) ? '' : 'context #interaction_input'}"
                        class:active={$activeInteractions.includes(openedId) && (i === inputIndex || openedInteraction?.options?.allAtOnce)}
                        style="width: 100%;"
                        id="#{i}"
                        data-title={$activeInteractions.includes(openedId) && !openedInteraction?.options?.allAtOnce && i !== inputIndex ? "Go to this input" : ""}
                        on:click={(e) => {
                            if ($activeInteractions.includes(openedId)) {
                                if (openedInteraction?.options?.allAtOnce) return

                                getInteraction(openedId)?.goto(i)
                                return
                            }

                            if (e.target?.closest(".rearrange")) return

                            popupData.set({ id: openedId, inputIndex: i })
                            activePopup.set("interaction_input")
                        }}
                        role="none"
                    >
                        <Icon id={input.type === "heading" ? "info" : input.type} size={1.5} gradient />
                        {#if input.inputType && input.inputType !== "none"}
                            <Icon id={inputTypeIcons[input.inputType]} white />
                        {/if}

                        <p style="flex: 1;{input.question ? '' : 'font-style: italic;opacity: 0.7;'}">
                            {input.question || translateText("main.unnamed")}
                        </p>

                        {#if $activeInteractions.includes(openedId)}
                            {#if input.type === "heading"}
                                <!-- show nothing -->
                            {:else}
                                <!-- timer -->
                                {#if i === inputIndex}
                                    <span style="font-family: monospace; opacity: 0.8; margin-right: 8px;" class:closed>
                                        {#if closed}
                                            CLOSED
                                        {:else if openedInteraction?.options?.maxTime && openedInteraction.options.maxTime > 0}
                                            {formatTimeInteraction(openedInteraction.options.maxTime - seconds)}
                                        {:else}
                                            {formatTimeInteraction(seconds)}
                                        {/if}
                                    </span>
                                {/if}

                                <!-- answers count -->
                                <span style="font-family: monospace; opacity: 0.7;">
                                    {Object.keys(answers[i] || {}).length || 0}
                                </span>
                            {/if}
                        {:else}
                            <span>
                                <MaterialButton class="rearrange" disabled={i === openedInteraction?.inputs.length - 1} icon="down" title="actions.backward" style="padding: 8px;" on:click={() => rearrangeInputs("forward", i)} />
                                <MaterialButton class="rearrange" disabled={i === 0} icon="up" title="actions.forward" style="padding: 8px;border-left: none !important;" on:click={() => rearrangeInputs("backward", i)} />
                            </span>
                        {/if}
                    </div>

                    <div slot="menu">
                        {#each Object.entries(answers[i] || {}).sort((a, b) => (a[1]?.time || 0) - (b[1]?.time || 0)) as [clientId, answerValue]}
                            {@const questionStartTime = startTimes[i] || startTime}
                            <p style="display: flex; gap: 8px;padding: 4px 8px;">
                                <span style="font-weight: bold; opacity: 0.9;">{clients[clientId]?.name || `User #${Object.keys(clients).indexOf(clientId) + 1}`}:</span>
                                <span style="flex: 1;white-space: normal;">
                                    {#each Array.isArray(answerValue?.value) ? answerValue.value : [answerValue?.value] as value, i}
                                        {i > 0 ? ", " : ""}
                                        <span style={isCorrect(input, value) ? "color: #31ed31; font-weight: bold;" : ""}>{value}</span>
                                    {/each}
                                </span>

                                {#if questionStartTime && answerValue?.time}
                                    <span style="font-family: monospace; opacity: 0.7;">
                                        {Math.max(0, (answerValue.time - questionStartTime) / 1000).toFixed(1)}s
                                    </span>
                                {/if}
                            </p>
                        {/each}
                    </div>
                </InputRow>
            {/each}

            {#if !$activeInteractions.includes(openedId)}
                <MaterialButton variant="outlined" icon="add" style="min-height: 45px;" on:click={addInput}>
                    <T id="interaction.add_input" />
                </MaterialButton>
            {/if}
        </div>

        {#if $activeInteractions.includes(openedId)}
            <FloatingInputs side="left">
                <MaterialButton
                    icon="stop"
                    on:click={async () => {
                        await stopInteraction(openedId)
                    }}
                    white
                    red
                >
                    <T id="media.stop" />
                </MaterialButton>
            </FloatingInputs>

            {#if !openedInteraction?.options?.allAtOnce}
                <FloatingInputs side="right">
                    <!-- go to next/previous index -->
                    <MaterialButton disabled={inputIndex < ((openedInteraction?.inputs?.length || 0) < 2 ? 1 : 0)} title="media.previous" on:click={() => getInteraction(openedId)?.previous()}>
                        <Icon size={1.3} id="previous" white />
                    </MaterialButton>

                    {#if hasAnswer(openedInteraction?.inputs[inputIndex]) && (currentAnswer === null || currentAnswer === undefined || currentAnswer === "")}
                        <div class="divider" />
                        <MaterialButton on:click={() => getInteraction(openedId)?.revealAnswer()}>
                            <!-- <Icon size={1.3} id="next" white /> -->
                            <T id="interaction.reveal_answer" />
                        </MaterialButton>
                    {:else}
                        <MaterialButton disabled={inputIndex === (openedInteraction?.inputs?.length || 0) - 1} title="media.next" on:click={() => getInteraction(openedId)?.next()}>
                            <Icon size={1.3} id="next" white />
                        </MaterialButton>
                    {/if}
                </FloatingInputs>
            {/if}
        {:else}
            <FloatingInputs side="left" gradient>
                <MaterialButton icon="play" disabled={!(openedInteraction?.inputs?.length || 0)} on:click={start} white>
                    <T id="inputs.start" />
                </MaterialButton>
            </FloatingInputs>
        {/if}
    {/if}

    {#if !$activeInteractions.includes(openedId) && !showHistory}
        <FloatingInputs round>
            <MaterialButton isActive={showOptions} title="create_show.more_options" on:click={() => (showOptions = !showOptions)}>
                <Icon size={1.1} id="options" white={!showOptions} />
            </MaterialButton>
        </FloatingInputs>
    {/if}
{:else}
    <div class="interactions">
        {#each sortByName(keysToID($interactions)) as interaction}
            <SelectElem id="interaction" data={{ id: interaction.id }}>
                <div
                    class="interaction context #interaction"
                    class:active={$activeInteractions.includes(interaction.id)}
                    on:click={(e) => {
                        if (e.target?.closest(".edit")) return
                        openedInteractionId.set(interaction.id)
                    }}
                    role="none"
                >
                    <p style={interaction.name ? "" : "font-style: italic;opacity: 0.7;"}>
                        <HiddenInput value={interaction.name} id="interaction_{interaction.id}" on:edit={(e) => updateInteractionName(interaction.id, e.detail.value)} />
                    </p>
                </div>
            </SelectElem>
        {/each}
    </div>

    <FloatingInputs onlyOne>
        <MaterialButton
            icon="add"
            title="new.interaction"
            on:click={() => {
                // selected.set({ id: null, data: [] })
                // activePopup.set("interaction")
                createNew()
            }}
        >
            {#if !$labelsDisabled}<T id="new.interaction" />{/if}
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .banner {
        width: 100%;
        background-color: #8b0000;
        color: white;

        text-align: center;
        font-weight: bold;
        font-size: 0.8em;

        padding: 4px 8px;
    }

    .interactions {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }

    .interaction {
        display: flex;
        flex-direction: column;
        gap: 6px;

        padding: 4px 8px;

        cursor: pointer;

        /* custom style */
        margin: 10px;
        padding: 12px 16px;
        background-color: var(--primary-darkest);
        border-radius: 12px;
        font-size: 1.1em;
        font-weight: bold;
    }
    .interaction.active {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    .header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 12px;

        background-color: var(--primary-darkest);
        padding: 4px;

        border-bottom: 1px solid var(--primary);
    }

    .options {
        padding: 10px;

        display: flex;
        flex-direction: column;
    }

    .inputs {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px;
        overflow: auto;

        padding-bottom: 60px;
    }

    .input {
        display: flex;
        align-items: center;
        gap: 8px;

        min-height: 47px;
        padding: 4px 8px;

        background-color: var(--primary-darkest);

        cursor: pointer;
    }
    .input:hover {
        background-color: var(--primary-darker);
    }

    .input.active {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    span.closed {
        color: #ff4444;
        font-weight: bold;
    }

    .players {
        display: flex;
        flex-direction: column;
        gap: 4px;
        background-color: var(--primary-darker);
        padding: 4px;
        margin-bottom: 8px;
    }

    .player {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background-color: var(--primary-darkest);
    }

    .list * {
        user-select: text;
    }
</style>

<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { addCanvaLinkAsShow, parseCanvaLink } from "../../../converters/canvaEmbed"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import CLogo from "./CLogo.svelte"

    // add a public Canva design (Smart embed link) as a live website show, no Canva account needed
    export let showInfo = true

    const dispatch = createEventDispatcher()

    let link = ""
    let name = ""

    $: result = link.trim() ? parseCanvaLink(link) : null
    $: error = result && "error" in result ? result.error : ""
    $: url = result && "url" in result ? result.url : ""

    function add() {
        if (!url) return
        addCanvaLinkAsShow(url, name)
        link = ""
        name = ""
        dispatch("added")
    }
</script>

<div class="canvaLink">
    {#if showInfo}
        <div class="title">
            <CLogo />
            <p><T id="media.canva_link_title" /></p>
        </div>
        <p class="info"><T id="media.canva_link_info" /></p>
    {/if}

    <ol class="steps">
        <li><T id="media.canva_link_step_1" /></li>
        <li><T id="media.canva_link_step_2" /></li>
        <li><T id="media.canva_link_step_3" /></li>
    </ol>

    <MaterialTextInput label="media.canva_link" value={link} placeholder="https://www.canva.com/design/…/view" on:input={(e) => (link = e.detail)} autofocus={!showInfo} pasteBtn />
    {#if error}
        <p class="error"><T id="media.canva_link_{error}" /></p>
    {/if}
    <MaterialTextInput label="inputs.name" value={name} placeholder="Canva presentation" disabled={!url} on:input={(e) => (name = e.detail)} />

    <MaterialButton variant="contained" icon="add" disabled={!url} on:click={add}>
        <T id="media.canva_link_add" />
    </MaterialButton>
</div>

<style>
    .canvaLink {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.1em;
        font-weight: 600;
    }

    .info {
        opacity: 0.8;
        font-size: 0.9em;
        line-height: 1.4;
    }

    .steps {
        margin: 0;
        padding: 8px 10px 8px 28px;
        border-radius: 6px;
        background-color: var(--primary-darker);
        font-size: 0.85em;
        line-height: 1.6;
        opacity: 0.9;
    }

    .error {
        color: var(--error, #ff6b6b);
        font-size: 0.85em;
    }
</style>

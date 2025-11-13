<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { send } from "../../util/socket"

    export let slideNum: number
    export let totalSlides: number
</script>

<div class="controls">
    <Button on:click={() => send("API:previous_slide")} disabled={slideNum <= 0} variant="outlined" center>
        <Icon id="previous" size={1.2} />
    </Button>
    <span class="counter">{slideNum + 1}/{totalSlides}</span>
    <Button on:click={() => send("API:next_slide")} disabled={slideNum + 1 >= totalSlides} variant="outlined" center>
        <Icon id="next" size={1.2} />
    </Button>
</div>

<style>
    .controls {
        display: flex;
        align-items: center;
        justify-content: space-between; /* previous left, next right, counter centered */
        position: relative; /* for absolute positioning of counter */
        gap: 12px;
        padding: 4px 6px;
        background-color: var(--primary-darkest);
        border-radius: 8px;
        margin-top: 8px;
        border: 1px solid rgb(255 255 255 / 0.06);
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.25);
        flex-wrap: nowrap;
    }

    .controls :global(button) {
        min-width: 36px;
        min-height: 36px !important;
        padding: 4px 8px !important;
        flex-shrink: 0;
    }

    .counter {
        /* positioned absolutely in the center */
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        opacity: 0.9;
        font-size: 0.95em;
        font-weight: 700;
        padding: 0 8px;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.3px;
        pointer-events: none; /* don't interfere with clicks */
    }

    /* Remove gap above controls on mobile */
    @media screen and (max-width: 1000px) {
        .controls {
            margin-top: 0;
        }
    }

    /* Compact on very small screens while preserving spacing */
    @media (max-width: 480px) {
        .controls {
            gap: 12px;
            padding: 10px 12px;
            min-height: 56px;
        }
        .controls :global(button) {
            min-width: 48px;
            min-height: 48px;
            padding: 10px 12px;
        }
        .counter {
            font-size: 1em;
            font-weight: 600;
        }
    }
</style>


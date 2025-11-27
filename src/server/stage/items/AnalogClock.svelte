<script lang="ts">
    import { tweened } from "svelte/motion"
    import { linear } from "svelte/easing"

    export let date: Date
    export let h: number
    export let m: number
    export let s: number
    export let seconds: boolean = true

    // define and set the initial tweening function
    let sweep = tweened(parseInt(((date.getTime() / 1000) % 60).toString()), {
        duration: 1000,
        easing: linear // elasticOut
    })

    // for a smooth transition between 59 and 0 seconds
    let start = date.getTime() / 1000 - ((date.getTime() / 1000) % 60)
    // + 0.4
    $: if (date) sweep.set(parseInt((date.getTime() / 1000 - start).toString()))

    // onMount(() => {
    // 	const interval = setInterval(() => {
    // 		sweep.set(parseInt(date.getTime() / 1000 - start));
    // 	}, 1000);

    // 	return () => {
    // 		clearInterval(interval);
    // 	};
    // });
</script>

<svg viewBox="-50 -50 100 100">
    <circle class="clock-face" r="48" />

    <!-- markers -->
    {#each [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as minute}
        <line class="major" y1="36" y2="45" transform="rotate({30 * minute})" />

        <!-- text -->
        <!-- {#if minute}
      <g transform="rotate({(minute / 5 - 6) * 6 * (minute / (minute / 5))})">
        <text
          class="clock-text"
          transform="rotate({(minute / 5 - 6) * 6 * (minute / (minute / 5)) * -1},0,{31 +
            (1 - (Math.abs((minute / 5 - 6) * 6 * (minute / (minute / 5))) * Math.PI) / 180 / Math.PI)})"
          text-anchor="middle"
          y={36 + (Math.abs((minute / 5 - 6) * 6 * (minute / (minute / 5))) * Math.PI) / 180 / Math.PI - 1}
          >{minute / 5}
        </text>
      </g>
    {:else}
      <g transform="rotate(-180)">
        <text class="clock-text" transform="rotate(180,0,31)" text-anchor="middle" y={36 + (Math.abs(180) * Math.PI) / 180 / Math.PI - 1}>12 </text>
      </g>
    {/if} -->

        {#each [1, 2, 3, 4] as offset}
            <line class="minor" y1="42" y2="45" transform="rotate({6 * (minute + offset)})" />
        {/each}
    {/each}

    <!-- hour hand -->
    <line class="hour" y1="6" y2="-28" transform="rotate({30 * h + m / 2})" />

    <!-- minute hand -->
    <line class="minute" y1="6" y2="-42" transform="rotate({6 * m + s / 10})" />

    {#if seconds}
        <!-- second hand -->
        <g transform="rotate({6 * $sweep + 1})">
            <line class="second" y1="10" y2="-36" />
        </g>
    {/if}

    <!-- pivot -->
    <circle class="fulcrum" r="1.25" />
</svg>

<style>
    svg {
        width: 100%;
        height: 100%;
    }

    /* .clock-text {
    font-size: 0.1em;
    fill: currentColor;
  } */

    .clock-face {
        stroke: currentColor;
        fill: none;
        /* stroke-width: 0.5px; */
        stroke-width: 0;
    }

    .fulcrum {
        fill: currentColor;
    }

    .minor {
        stroke: currentColor;
        opacity: 0.5;
        stroke-width: 0.5;
    }

    .major {
        stroke: currentColor;
        opacity: 0.7;
        stroke-width: 1;
    }

    .hour {
        stroke: currentColor;
        /* stroke-linecap: round; */
        stroke-width: 1.5;
    }

    .minute {
        stroke: currentColor;
        /* stroke-linecap: round; */
        stroke-width: 1;
    }

    .second {
        stroke-width: 0.5;
    }

    .second {
        stroke: currentColor;
        opacity: 0.8;
    }
</style>

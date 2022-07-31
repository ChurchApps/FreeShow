<script lang="ts">
  import { draw } from "../../stores"

  export let settings: any = {}

  let drawTimeout: any = null
  let particles: any[] = []

  $: if ($draw) drawParticle()
  function drawParticle() {
    if (drawTimeout) return

    let particle: any = { ...$draw }
    let size = settings.size || 100
    particle.size = Math.floor(Math.random() * 100) + size / 2
    particles = [...particles, particle]

    drawTimeout = setTimeout(() => {
      drawTimeout = null
    }, 20)

    setTimeout(() => {
      particles.shift()
      particles = particles
    }, 500)
  }
</script>

{#each particles as p}
  <div
    class="particle"
    style="--color: {settings.color || '#1e1eb4'};opacity: {settings.opacity ||
      0.8};border-radius: {settings.radius}%;top: {p.y}px;left: {p.x}px;height: {p.size}px;width: {p.size}px;"
    class:glow={settings.glow === true}
    class:hollow={settings.hollow === true}
  />
{/each}

<style>
  .particle {
    --color: #1e1eb4;
    border-radius: 50%;
    opacity: 0;

    position: absolute;
    pointer-events: none;
    background: var(--color);
    border: 2px solid var(--color);
    transform: translate(-50%, -50%);
    animation: fade 0.8s infinite;
  }

  .particle.hollow {
    background: none;
  }

  .particle.glow {
    box-shadow: 10px 10px 20px var(--color);
    animation: fade-glowing 0.8s infinite;
  }

  @keyframes fade {
    0% {
      /* opacity: 1; */
      filter: hue-rotate(0deg);
      box-shadow: 0;
    }
    100% {
      opacity: 0;
      filter: hue-rotate(100deg);
    }
  }

  @keyframes fade-glowing {
    0% {
      filter: hue-rotate(0deg);
      box-shadow: 0;
      box-shadow: 10px 10px 10px var(--color), -10px -10px 10px var(--color);
    }
    100% {
      opacity: 0;
      filter: hue-rotate(100deg);
      box-shadow: 20px 20px 100px var(--color), -20px -20px 100px var(--color);
    }
  }
</style>

<script>
    import { onMount } from "svelte"

    let ParticlesComponent
    onMount(async () => {
        const module = await import("svelte-particles")
        ParticlesComponent = module.default
    })

    // https://www.npmjs.com/package/svelte-particles?activeTab=readme
    // import Particles from "svelte-particles"
    // import { loadFull } from "tsparticles"

    export let particles

    let options = {
        fullScreen: { enable: false, zIndex: 0 },
        fpsLimit: 60,
    }

    $: if (particles) options.particles = particles

    $: console.log(options)

    // component
    // let ParticlesComponent
    // onMount(async () => {
    //     const module = await import("svelte-particles")
    //     ParticlesComponent = module.default
    // })

    // let particlesInit = async (engine) => {
    //     await loadFull(engine)
    // }
</script>

<svelte:component this={ParticlesComponent} {options} />

<!-- <Particles {options} {particlesInit} /> -->

<!-- <svelte:component this={ParticlesComponent} id="tsparticles" class="foo bar" style="" {options} {particlesInit} /> -->

<style>
    :global(#tsparticles) {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    /* :global(#tsparticles canvas) {
        width: 100%;
        height: 100%;
    } */
</style>

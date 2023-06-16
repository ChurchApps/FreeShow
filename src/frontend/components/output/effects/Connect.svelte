<script lang="ts">
    import CustomParticles from "./CustomParticles.svelte"

    let particles = {
        color: {
            value: "#fff",
        },
        links: {
            enable: true,
            color: "#fff",
        },
        move: {
            enable: true,
        },
    }
</script>

<CustomParticles {particles} />

<script lang="ts">
    import type { Scene } from "../../../../types/Show"
    import { outputs } from "../../../stores"
    import { getAllActiveOutputIds, getAllNormalOutputs } from "../../helpers/output"
    import Output from "../../output/Output.svelte"

    export let scene: Scene

    $: enabledOutputIds = ([getAllNormalOutputs(), $outputs][0] as any[]).map((a) => a.id) as string[]
    $: activeOutputIds = [getAllActiveOutputIds(), $outputs][0] as string[]
    $: filteredOutputs = scene?.bindings?.length ? enabledOutputIds.filter((id) => scene.bindings!.includes(id)) : activeOutputIds
    $: firstOutputId = filteredOutputs[0] || activeOutputIds[0] || Object.keys($outputs)[0] || ""

    $: content = scene?.content || {}
    $: sceneData = { ...content, name: scene?.name || "", id: scene?.id || "" }

    $: out = $outputs[firstOutputId]?.out
    $: outOverride = { ...(out || {}), scene: sceneData }

    // $: key = firstOutputId + JSON.stringify(outOverride)
</script>

<!-- {#key key} -->
<Output outputId={firstOutputId} style="width: 100%; height: 100%;" {outOverride} mirror />
<!-- {/key} -->

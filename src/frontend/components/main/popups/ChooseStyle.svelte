<script lang="ts">
    import { popupData, styles } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import Dropdown from "../../inputs/Dropdown.svelte"

    let currentStyleId = $popupData.id
    $: currentStyle = $styles[currentStyleId]

    $: stylesList = getList($styles)
    function getList(styles) {
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        return list.sort((a, b) => a.name.localeCompare(b.name))
    }

    function updateStyle(e: any) {
        let ref = _show().layouts("active").ref()[0]
        let actions = clone(ref[$popupData.indexes[0]]?.data?.actions) || {}

        currentStyleId = e.detail.id
        actions.outputStyle = currentStyleId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: $popupData.indexes }, location: { page: "show", override: "change_style_slide" } })
    }
</script>

<Dropdown value={currentStyle.name} options={stylesList} on:click={updateStyle} />

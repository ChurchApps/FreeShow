<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("calendar")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.calendar?.activeSubTab || ""

    let sections: any[] = []
    $: sections = [
        [
            { id: "event", label: "menu._title_calendar", icon: "calendar" },
            { id: "action", label: "calendar.schedule_action", icon: "actions" }
        ]
    ]

    function importCalendar() {
        sendMain(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } })
    }
</script>

<NavigationSections {sections} active={activeSubTab}>
    <div slot="section_0" style="padding: 8px;padding-top: 12px;">
        <MaterialButton icon="add" style="width: 100%;" title="actions.import_calendar" variant="outlined" disabled={readOnly} on:click={importCalendar} small>
            {#if !$labelsDisabled}<T id="actions.import_calendar" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>

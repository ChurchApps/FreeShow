<script lang="ts">
  import { activeDays, activePopup, dictionary, eventEdit, events } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"

  // onMount(updateEvents)

  const copy = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

  let current = new Date($activeDays[0])

  let currentEvents: any[] = []

  activeDays.subscribe(() => {
    updateEvents()
  })
  events.subscribe(updateEvents)

  function updateEvents() {
    current = new Date($activeDays[0])
    let temp: any[] = []

    // current = new Date(current.toLocaleString("en-US", { timeZone: "Europe/London" }))

    // if ($activeDays[0]) {
    Object.entries($events).forEach(([id, a]) => {
      if (isBetween(new Date(a.from), new Date(a.to), copy(current))) temp.push({ id, ...a })
    })
    // }

    // sort
    // TODO: sort
    currentEvents = temp.sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
    console.log(currentEvents)
  }

  function getTime(date: Date) {
    let h = ("0" + date.getHours()).slice(-2)
    let m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
  }
</script>

{#if $activeDays.length}
  <div class="main">
    <span class="date">
      {current.getDate()}. {$dictionary.month?.[current.getMonth() + 1]}
      {current.getFullYear()}
    </span>
    <div class="scroll">
      {#if currentEvents.length}
        {#each currentEvents as event}
          <div
            class="event context #event"
            style="color: {event.color || 'unset'}"
            id={event.id}
            on:click={() => {
              eventEdit.set(event.id)
              activePopup.set("edit_event")
            }}
          >
            {#if event.time}
              <span class="time">
                {#if sameDay(new Date(event.from), current)}
                  {getTime(new Date(event.from))}
                {/if}
                {#if !sameDay(new Date(event.from), current) || new Date(event.from).getTime() - new Date(event.to).getTime() > 0}
                  {#if sameDay(new Date(event.to), current)}
                    {#if sameDay(new Date(event.from), current)}
                      -
                    {/if}
                    {getTime(new Date(event.to))}
                  {/if}
                {/if}
              </span>
            {/if}
            <div style="display: flex;align-items: center;overflow: hidden;">
              <p>
                <Icon id={event.type === "event" ? "calendar" : event.type} right white />
                {#if event.name}
                  {event.name}
                {:else}
                  <span style="opacity: 0.5;">
                    <T id="main.unnamed" />
                  </span>
                {/if}
              </p>
            </div>
          </div>
        {/each}
      {:else}
        <Center faded>
          <T id="empty.events" />
        </Center>
      {/if}
    </div>
  </div>
  <Button
    on:click={() => {
      eventEdit.set(null)
      activePopup.set("edit_event")
    }}
    dark
    center
  >
    <Icon id="add" right />
    <T id="new.event" />
  </Button>
{/if}

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    padding: 10px;
  }

  .date {
    font-size: 1.6em;
    display: flex;
    justify-content: center;
    font-weight: bold;
    white-space: nowrap;
    margin-bottom: 10px;
  }

  .scroll {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    /* gap: 5px; */
  }

  .event {
    background-color: var(--primary-darker);
    padding: 10px;
    display: flex;
    cursor: pointer;
  }
  .event:hover {
    background-color: var(--hover);
  }

  .time {
    padding-right: 10px;
    color: var(--text);
    opacity: 0.9;
    white-space: nowrap;
  }
</style>

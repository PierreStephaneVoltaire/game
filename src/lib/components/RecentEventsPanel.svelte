<script lang="ts">
  import type { EventViewModel } from '$lib/ui/game-view-model';

  export let events: EventViewModel[] = [];
  export let timezone: string;

  function eventTime(at: number) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(at);
  }
</script>

<aside class="event-panel" aria-label="Recent events" aria-live="polite">
  <h2>Recent events</h2>
  <ol>
    {#each events as event (event.id)}<li>
        <time datetime={new Date(event.at).toISOString()}
          >{eventTime(event.at)}</time
        >
        <span>{event.message}</span>
      </li>{/each}
  </ol>
</aside>

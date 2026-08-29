<script lang="ts">
  import { onDestroy } from 'svelte';

  export let value = 0;
  export let minimum = 0;
  export let maximum = 0;
  export let disabled = false;
  export let label = 'Quantity';
  export let onChange: (quantity: number) => void | Promise<void>;

  let requested = value;
  let pending = 0;
  let repeatTimer: ReturnType<typeof setTimeout> | undefined;
  let repeatInterval: ReturnType<typeof setInterval> | undefined;

  $: if (pending === 0 && requested !== value) requested = value;

  function stopRepeating() {
    if (repeatTimer) clearTimeout(repeatTimer);
    if (repeatInterval) clearInterval(repeatInterval);
    repeatTimer = undefined;
    repeatInterval = undefined;
  }

  function change(direction: -1 | 1) {
    const next = Math.max(minimum, Math.min(maximum, requested + direction));
    if (disabled || next === requested) return;
    requested = next;
    pending += 1;
    void Promise.resolve(onChange(next)).finally(() => {
      pending -= 1;
    });
  }

  function startRepeating(event: PointerEvent, direction: -1 | 1) {
    if (disabled) return;
    event.preventDefault();
    (event.currentTarget as HTMLButtonElement).setPointerCapture(
      event.pointerId,
    );
    change(direction);
    repeatTimer = setTimeout(() => {
      repeatInterval = setInterval(() => change(direction), 90);
    }, 360);
  }

  function keyboardChange(event: MouseEvent, direction: -1 | 1) {
    if (event.detail === 0) change(direction);
  }

  onDestroy(stopRepeating);
</script>

<div class="quantity-stepper" aria-label={`${label} quantity`}>
  <button
    type="button"
    aria-label={`Remove one ${label}`}
    disabled={disabled || requested <= minimum}
    on:pointerdown={(event) => startRepeating(event, -1)}
    on:pointerup={stopRepeating}
    on:pointercancel={stopRepeating}
    on:lostpointercapture={stopRepeating}
    on:click={(event) => keyboardChange(event, -1)}>−</button
  ><output aria-live="polite">{requested}</output><button
    type="button"
    aria-label={`Add one ${label}`}
    disabled={disabled || requested >= maximum}
    on:pointerdown={(event) => startRepeating(event, 1)}
    on:pointerup={stopRepeating}
    on:pointercancel={stopRepeating}
    on:lostpointercapture={stopRepeating}
    on:click={(event) => keyboardChange(event, 1)}>+</button
  >
</div>

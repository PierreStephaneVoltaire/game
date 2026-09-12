<script lang="ts">
  import { onMount } from 'svelte';
  import {
    companionSpeechSession,
    reconcileGameClock,
  } from '$lib/game-session';
  import type { CompanionAppearance } from '$lib/ui/companion';
  import {
    clickSpeech,
    loadQuotes,
    nextSpeechBoundary,
    selectQuote,
    speechAllowed,
    transitionSpeech,
    type QuotePools,
    type SpeechSession,
    type SpeechTrigger,
  } from '$lib/ui/companion-speech';
  import rules from '$lib/data/speech-rules.json';

  export let name: string;
  export let appearance: CompanionAppearance;

  let session: SpeechSession | null = null;
  let pools: QuotePools = {};
  let text = '';
  let previousQuote = '';
  let clickSequence = 0;
  let focused = false;
  let hovered = false;
  let remaining = 0;
  let expiresAt = 0;
  let dismissal: ReturnType<typeof setTimeout> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  $: allowed = session !== null && speechAllowed(session.state);
  $: pause(focused || hovered);

  function pause(held: boolean) {
    if (dismissal !== undefined) {
      remaining = Math.max(0, expiresAt - performance.now());
      clearTimeout(dismissal);
      dismissal = undefined;
    }
    if (!held && text) {
      expiresAt = performance.now() + remaining;
      dismissal = setTimeout(clearSpeech, remaining);
    }
  }

  function clearSpeech() {
    clearTimeout(dismissal);
    dismissal = undefined;
    text = '';
  }

  function speak(trigger: SpeechTrigger) {
    if (
      !session ||
      document.visibilityState !== 'visible' ||
      document.querySelector('dialog[open]')
    )
      return;
    const quote = selectQuote(pools, trigger, session.state, previousQuote);
    clearSpeech();
    if (!quote) return;
    previousQuote = text = quote;
    remaining = rules.displaySeconds * 1000;
    pause(focused || hovered);
  }

  function clicked() {
    clearTimeout(pending);
    if (session) speak(clickSpeech(session.state, ++clickSequence));
  }

  onMount(() => {
    let stopped = false;
    let reconciling = false;
    let clock: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(clock);
      if (
        stopped ||
        reconciling ||
        !session ||
        session.state.mode !== 'realtime' ||
        session.state.ending ||
        document.visibilityState !== 'visible'
      )
        return;
      clock = setTimeout(
        () => {
          reconciling = true;
          void reconcileGameClock()
            .catch(() => {})
            .finally(() => {
              reconciling = false;
              schedule();
            });
        },
        Math.max(
          1000,
          nextSpeechBoundary(session.state, rules.intervalHours) - Date.now(),
        ),
      );
    };
    const unsubscribe = companionSpeechSession.subscribe((next) => {
      const before = session;
      session = next;
      if (!next || !before || next.state.seed !== before.state.seed) {
        clearTimeout(pending);
        clearSpeech();
        previousQuote = '';
        clickSequence = 0;
      } else if (!speechAllowed(next.state)) {
        clearTimeout(pending);
        clearSpeech();
      } else if (document.visibilityState === 'visible') {
        const trigger = transitionSpeech(
          before.state,
          next,
          rules.intervalHours,
        );
        if (trigger) {
          clearTimeout(pending);
          pending = setTimeout(() => speak(trigger), 0);
        }
      }
      schedule();
    });
    const visibility = () => {
      clearTimeout(pending);
      clearSpeech();
      schedule();
    };
    document.addEventListener('visibilitychange', visibility);
    void loadQuotes().then((value) => {
      if (!stopped) pools = value;
    });
    return () => {
      stopped = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      clearTimeout(clock);
      clearTimeout(pending);
      clearSpeech();
    };
  });
</script>

<button
  type="button"
  class="companion-avatar"
  disabled={!allowed}
  aria-label={`Talk to ${name}`}
  on:click={clicked}
  on:focus={() => (focused = true)}
  on:blur={() => (focused = false)}
>
  <img
    class="companion"
    src={appearance.assetPath}
    alt={name}
    data-appearance-id={appearance.id}
    width="176"
    height="176"
    decoding="async"
  />
</button>
<div
  class="speech-position"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {#if text}
    <div
      class="speech-bubble"
      on:mouseenter={() => (hovered = true)}
      on:mouseleave={() => (hovered = false)}
      role="presentation"
    >
      {text}
    </div>
  {/if}
</div>

<style>
  .companion-avatar {
    position: absolute;
    z-index: 2;
    bottom: -10px;
    left: 57%;
    width: min(274.56px, 42.12%);
    padding: 0;
    border: 0;
    background: transparent;
    transform: translateX(-50%);
    cursor: pointer;
    pointer-events: none;
  }
  .companion-avatar::after {
    position: absolute;
    inset: 0 25%;
    pointer-events: auto;
    content: '';
  }
  .companion-avatar:disabled::after {
    pointer-events: none;
  }
  .companion-avatar:disabled {
    opacity: 1;
    cursor: default;
  }
  .companion-avatar img {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }
  .speech-position {
    position: absolute;
    z-index: 3;
    bottom: min(264.56px, calc(42.12cqw - 10px));
    left: 8%;
    width: 84%;
    pointer-events: none;
  }
  .speech-bubble {
    position: relative;
    max-height: 34cqh;
    overflow-y: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    padding: 10px 12px;
    border: 3px solid var(--theme-ink);
    background: var(--theme-white);
    color: var(--theme-ink);
    box-shadow: 4px 4px 0 var(--theme-pink);
    font-size: clamp(0.75rem, 2.5cqw, 0.95rem);
    line-height: 1.4;
    pointer-events: auto;
  }
  .speech-position:has(.speech-bubble)::after {
    position: absolute;
    bottom: -9px;
    left: 56%;
    width: 14px;
    height: 14px;
    border-right: 3px solid var(--theme-ink);
    border-bottom: 3px solid var(--theme-ink);
    background: var(--theme-white);
    transform: rotate(45deg);
    content: '';
  }
</style>

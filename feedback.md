# Companion-Care Game — Design & Faithfulness Review

I researched the inspirations (Tamagotchi P1/Connection care rules, Neopets hunger/sickness/economy) and Bri herself (Wikitubia/Fandom profile, her Otakuthon 2025 guest bio, her own posts). Quick grounding facts I'm reviewing against:

- **Bri (BriAtCookieBox):** British-American bunny(→pixie) VTuber and full-time Live2D rigger (350+ models), Twitch partner, autistic, ADHD, ARFID, pittakionophobia (fear of stickers). Cat named **Socks**. Favorite "food" is sugar, favorite drink Dr Pepper, drinks coffee, dislikes tea, chicken, spicy food; eats pizza _without cheese or toppings_; comfort foods are oatmeal, jaffa cakes, pasta. Self-described as historically terrible with money ("2 dollars in her bank account"). Famously ate a concoction of jello, soda, peanut butter cookies, taco seasoning, and **three cups of pickle juice**.
- **POTS reality check:** standard POTS management is a **high-salt, high-water** diet — salt tablets (e.g., Vitassium) and pickle juice are _treatments_, not vices. Salt is only dangerous in this context when fluid intake doesn't keep up.

That last point matters a lot, because your current design gets it backwards. Full review below.

---

## Verdict up front

The simulation core is unusually rigorous — hysteresis on statuses, protected activity clocks, deterministic replays, a clean death-attribution system. The **character layer is genuinely well-observed** (cravings, preparation-sensitivity, overstimulation, autonomous streaming). But there are **three structural problems** that will sink runs before the charm lands:

1. **The economy is a death spiral** (income is luck-gated _and_ blocked by the very states poverty causes, and Hospital is a $10,000 run-ender).
2. **"Autonomous" events only fire on player actions**, which quietly breaks streaming, income, and the whole idle-pet fantasy in Realtime mode.
3. **POTS is modeled as its opposite** — salt is purely punitive, and there is no anxiety/stress system at all despite it being central to the character.

---

## 1. What works (keep these)

- **Status hysteresis everywhere** (Starving ends at 5, not 3; Full clears at ≤7, not 8). This prevents status flicker and is quietly excellent. Tamagotchi and Neopets both use banded states (Neopets' _Dying → Starving → … → Very Bloated_ ladder is exactly your Starving/Hungry/Full family), so it's faithful too.
- **Craving system.** A persistent fixation on one specific liked food that grants Bond when honored is the single most ARFID/autism-accurate mechanic in the doc. Clinically, "glut eating" one preferred food until tiring of it is textbook. Consider leaning in harder (see §5).
- **Specific-preparation foods.** "35–85% chance of acceptable preparation" is the pizza-without-cheese rule as a mechanic. This is characterful, absurd, and mechanically interesting. It is also very Neopets — Neopets famously refused foods for arbitrary reasons (pets used to refuse any food whose letter count matched their name length!). Your absurdity has genre precedent.
- **Overstimulated.** Punishing _interaction while happy_ is counterintuitive as generic pet design but is exactly right for this character, and the clearance conditions (leave her alone, Rest, or Headphones) are respectful, accurate autism representation.
- **The companion cannot be told to stream.** Unfaithful to Tamagotchi (mini-games are player-initiated) but deeply faithful to the subject: you cannot make a streamer with executive-function struggles go live. This is your game's thesis statement — protect it, but pay for it elsewhere (see §3.1).
- **Socks as a random-valence event** (Mood −1/0/+1, cat behaves like a cat) and **Socks Plushie as the Annoyed apology** — good lore integration.
- **Sugar Crash.** "Her favorite food is sugar" is canon; a rolling-window serving counter with a delayed crash that protein or rest clears is a genuinely good, learnable mini-system.
- **Death attribution** (graveyard names only the sources in the final lethal resolution) is cleaner than either inspiration and will make deaths feel fair.
- **No Bond from purchases** — stated twice, correctly. Anti-pay-to-love is good design and good ethics.
- **Room removal reverses the applied (post-clamp) delta** rather than the listed effect — this closes the classic clamp-exploit. Well done.

---

## 2. Critical logic conflicts (fix before release)

These are contradictions or softlocks, not taste issues.

### 2.1 "The run is not saved" contradicts Realtime mode

Realtime mode says _"returning to the page or performing an action catches the simulation up"_ — which requires the run to persist across sessions. Then "Core terms" says a run _"is one play session. The run is not saved."_ Both cannot be true. You almost certainly mean _"there is one save slot; a run cannot be resumed after death and cannot be rolled back."_ Say that.

### 2.2 Autonomous events are not autonomous

Event opportunities are only owned by player actions (Feed, items, Rest, Socialize, Play). Nothing in "Order of time-based rules" draws events on elapsed time. Consequences:

- In Realtime mode, a player who leaves overnight gets **zero streams, zero income, zero cravings, zero Socks moments** — the pet just decays.
- The daypart multipliers (×0.5 at hours 4–8, ×1.5 at 13–19) are nearly meaningless, because streams occur at _player-action_ times, not clock times.
- "Autonomous streaming" is actually "streaming triggered by being poked," which is thematically the opposite of your intent.

**Fix:** add one event opportunity per elapsed 2-hour boundary (or per N hours) to the time-based rules, resolved in chronological order during catch-up. Then the daypart windows, the midnight duration cap, and the word "autonomous" all become true.

### 2.3 Hospital is a disguised game-over

Hospital costs $10,000. The only income is streaming at $5–15/hour times $0.5 + \text{Creativity}/10$. Best case (12h, $15/h, Creativity 10) is $270 per stream; a realistic stream is worth $20–40. Meanwhile **negative balance blocks all purchases**, and food only comes from the shop. So:

$$\text{Hospital} \Rightarrow \text{debt} \approx \$10{,}000 \Rightarrow \text{no food purchases for } \sim\!100+ \text{ days} \Rightarrow \text{starvation death}$$

Worse: Kidney Stone is _only_ cured by Hospital, so one stone before you're rich is a guaranteed doomed run. If the $10k bill is deliberate healthcare satire, fine — but then debt must not block _food_:

- Let debt block durables/decor but allow food and medicine ("she puts groceries on the credit card" — realistic _and_ characterful), with debt instead feeding a stress system (§4.1), **or**
- Scale the bill to the economy (e.g., $250), **or**
- Convert debt into a garnishment (streams pay 50% to debt) instead of a purchase freeze.

Right now the doc's own words — "may create a negative balance" + "a negative balance blocks all ordinary purchases" — chain into an undocumented death sentence.

### 2.4 Advance Time's safety promise is broken by Kidney Stone

The grace rule prevents _"ordinary periodic Health damage"_ from making the first critical crossing lethal — but Kidney Stone recurrence (step 7) is direct damage that ignores the periodic check. A player who selects a "safe" 12-hour advance can be killed by a rule the safety clause doesn't cover. Either extend the grace to all damage at the first crossing, or have Advance Time stop _before_ a due Kidney Stone tick, or document the exception loudly.

### 2.5 Craving softlock

A craving can target a food that is merely _stocked_. Shop stock refreshes at midnight. If the player never buys it, the craving persists for an item that may never be stocked again — an unfulfillable craving permanently occupying the "no active craving" slot (blocking future craving events and their Bond +1). Fix: craving expires/re-rolls at shop refresh, or only owned foods are cravable.

### 2.6 Ambiguities the doc leaves open

<details>
<summary>Expand: five smaller ambiguities to pin down</summary>

- **Annoyed re-onset:** rejected attempts while Annoyed "continue accumulating in the background" — does reaching the threshold again fire another Mood −2 while the status persists? Define it.
- **Auto-snack refusals and the Annoyed streak:** auto-snacks aren't companion attempts, so presumably refused auto-snacks don't count toward the refusal streak — but the doc never says so. Say so.
- **Overstimulated during a running stream:** an auto-snack that is Liked while Mood is 9–10 triggers Overstimulated (−4). Overstimulated zeroes stream _eligibility_ but early-ending is metric-based, so the stream continues while Overstimulated. Legal per the rules, but state it, because it looks like a bug.
- **Durable multi-buy loophole:** the doc itself admits the first purchase can request several copies "before the owned-copy check begins to block later purchases." That's a bug confession inside a rules document. Fix it or canonize it.
- **Bond-clock furniture exploit:** placing a Bond +1 item resets the 48-hour decay clock; removal reverses the Bond but not the clock. Place→remove→re-place cycles a durable into infinite Bond-decay immunity at net-zero Bond cost. Cheap fix: only the _first_ placement of a given copy per 48h window resets the clock.

</details>

---

## 3. Balance risks (legal rules, bad outcomes)

### 3.1 The poverty spiral is the real final boss

Follow the loop: Food decays an expected $9 \times 0.75 = 6.75$ points/day; most foods restore +1 at $1–8, so upkeep is roughly $7–20/day against a starting $20. Income requires winning an event draw where the stream weight

$$w = 50u + 5(\text{Mood}-5) + 5(\text{Creativity}-5), \quad u \sim [0,1)$$

competes against a no-event weight of 100 plus everything else — call it a ~10% win rate per opportunity at starting stats. Then duration subtracts $(10 - \text{Rest})$ hours, so at starting Rest 7 the three most common durations (1–3h, 45% of draws) fizzle into "too tired to stream." And **Hungry (Food ≤ 4) zeroes stream weight entirely** — so being poor makes her hungry, and being hungry makes her unable to earn.

Individually every rule is defensible and even characterful. Together they mean most runs starve out in a few days with the player unable to do anything about it. Recommendations:

- **Add a second, small, reliable income: rigging commissions.** Bri is canonically a full-time rigger with 350+ models — this is the most lore-accurate fix available. Make it a timed activity or an event candidate ($15–40, Creativity-scaled, costs Rest and Creativity). It gives the player _agency_ over solvency without touching the sacred "you can't force streams" rule.
- Soften the Hungry stream-block to a weight penalty (streamers absolutely go live hungry; it's the _Starving/Depressed/Sick_ tier that should hard-block).
- The shop's affordability guarantee already fails below the cheapest food; a "care package from chat" pity event at prolonged Food ≤ 2 + balance ≈ 0 would be both merciful and thematically perfect.

### 3.2 Refusal → Annoyed is a positive feedback loop with traps

Disliked foods refuse at 35–65%, Rest at 8–9 refuses at 80–90%, Rest 10 _always_ refuses — and every refusal feeds a secret Annoyed threshold that can be as low as **2**. A player can trigger Annoyed with two entirely reasonable actions, eat Mood −2, and then face +50 refusal on Socialize/Play, generating more refusals. Suggestions: exclude _blocked/invalid_ attempts (like Rest-at-10) from the streak, or floor the threshold at 3, or telegraph irritation one step before onset ("she seems a bit short with you"). Anxiety-accurate ≠ unreadable.

### 3.3 The Full + Liked Mood pump

While Full, a Liked food's Food gain is suppressed but "other effects still apply," and Liked guarantees Mood ≥ +1. So cheap Liked foods are a Mood battery at 35% Sick risk per use. Honestly? Comfort-eating-past-fullness with a health cost is _extremely_ on-theme — I'd keep it but cap it (e.g., only the first Full-suppressed feed per 2 hours can grant Mood), so it's a characterful vice rather than the dominant strategy.

<details>
<summary>Expand: smaller balance notes</summary>

- **Liked food at Mood 9–10 becomes Overstimulated −4.** The Liked guarantee ("total Mood at least +1") converts into a −4 trap with no warning. Consider exempting food (overstimulation from _eating_ a jaffa cake is a stretch) and keeping the rule for Socialize/Play/events.
- **Sick clearance** (Rest ends with Food ≤ 5 and Health ≥ 5) is a nice implicit puzzle — starve gently, then sleep — but nothing teaches it. One Journey hint on Sick onset ("she probably needs an empty-ish stomach and a proper sleep") saves the wiki trip.
- **Hospital gives no Mood benefit** — great, hospitals are miserable, keep it.
- **Terminology collision:** "Streaming mode" (a _time_ mode) vs. autonomous "streams" (an activity) will confuse every playtester. Rename the time mode ("Session mode," "Manual time").
- **Beanbag Chair's Creativity −1** is a fun lone exception; more one-off cursed items like this is exactly the right kind of absurd.

</details>

---

## 4. Faithfulness to _Bri_ — the gaps that matter most

### 4.1 POTS is modeled backwards (highest-priority character fix)

Current rules: salt only ever contributes to Kidney Stone risk, the Salt Tablet is an item whose _only systemic effect is to hurt you_, and water only matters as stone prevention. For a POTS character this is inverted — high salt _plus_ high water is the treatment (Dr Pepper–flavored electrolytes are literally a POTS-community meme, and her pickle-juice concoction reads differently once you know this). Suggested restructure using the nutrition tracker you already built:

| 48h window state               | Effect                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| Salt high **and** water high   | Healthy: suppresses POTS flares; small stream-weight bonus             |
| Salt low (regardless of water) | Risk of **Dizzy Spell** flare: Rest −1/Mood −1, briefly blocks streams |
| Salt high **and** water low    | Keep your existing 35% Kidney Stone roll                               |

This keeps your Kidney Stone system intact (it's medically fair!), makes the Salt Tablet _useful_ (faithful — salt supplements are real POTS management), and adds the missing _positive_ half of "the health and salt aspect" you told me the game needed. Right now the game punishes her for the thing her body requires.

### 4.2 There is no anxiety system

You explicitly want debt → stress → health-over-time. The current implementation is Money Stress: **Mood −1, once per day, only below $10**. That's not a stress system, it's a sticky note. Options, cheapest first:

- **Minimal:** while balance is negative, run a daily $-1$ Health tick with cause "Stress," and Money Stress fires per-date without the once-only cap. Debt now kills slowly — exactly your stated design goal — and the graveyard can say she died of financial stress, which is bleak, absurd, and honest.
- **Fuller:** a hidden Stress meter fed by debt, refusals, Overstimulated/Annoyed onsets, and Hospital; drained by Rest, Socks, comfort foods; at high levels it raises all refusal chances and chips Health at the periodic check. This also gives ARFID its anxiety dimension (fear-of-consequences eating), which the current model reduces to preference percentages.

### 4.3 Auto-snacks violate ARFID logic

During streams she "uniformly chooses an owned, usable food" — including Disliked ones, which she then refuses and 50% wastes, burning the player's inventory. A person with ARFID reaching for a self-chosen snack reaches for a **safe food**. Restrict auto-snacks to Liked/Variable items. This is simultaneously more faithful, less player-hostile, and creates a real strategic layer: _stock her safe foods before streams_, which is exactly the caretaking fantasy this game is about.

### 4.4 The repeat-penalty contradicts the character

+10% refusal per consecutive repeat of the same Socialize/Play choice is a generic anti-grind rule — but for an autistic character, **repetition is comfort**, not annoyance. Sameness-seeking is the trait; your rule punishes the player for honoring it. Better: repeats stay _accepted_ but yield diminishing returns (Mood +1 → +0), or designate 1–2 "comfort activities" per run that are immune. You keep grind protection, you lose the mischaracterization.

<details>
<summary>Expand: smaller faithfulness opportunities (all optional flavor)</summary>

- **Caffeine has no rule**, yet Dr Pepper and coffee are core lore. Easy win: caffeine ≥ 2 delays the next Rest decay tick by 2h, then applies Rest −1 late. (Also: her disliking tea means a tea item should be Disliked even though it's "healthy" — you said you have that list; make sure "healthy but disliked" items exist in numbers, because that's the ARFID point.)
- **Pittakionophobia:** one cursed shop item ("Sheet of Cute Stickers") that triggers Mood −2 on interaction would be a perfect deep-cut absurd trap, in the proud Neopets tradition of items that just hurt you.
- **Mystery Snack** with random nutrition profiles is good — consider renaming it after the canonical jello/soda/taco-seasoning/pickle-juice concoction.
- **Rest ≤ some threshold** could occasionally narrate her snoring (canon: she snores very loudly). Zero mechanics, pure Journey flavor.

</details>

---

## 5. Faithfulness to the inspirations

Not all deviations are bad — but you should know which side of each inheritance you're on.

| Mechanic             | Tamagotchi                                    | Neopets                                                    | Your game                       | Read                                                                                                                                                          |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Death                | Permanent; neglect _and_ old age              | Pets cannot die                                            | Permadeath from neglect only    | Hybrid. Fine — but see "no progression" below                                                                                                                 |
| Growth/evolution     | **Core loop** (care mistakes shape evolution) | Levels, training                                           | **None**                        | Biggest departure from _both_                                                                                                                                 |
| Attention calls      | Beeping + 15-min care-mistake window          | Sidebar status titles                                      | Statuses, no call system        | Deviation; consider a gentle "attention" ping — it's the most iconic Tamagotchi feature you dropped                                                           |
| Discipline/scold     | Scold misbehavior to build Discipline         | —                                                          | Annoyed + _apology_             | Lovely inversion: you can't scold this companion, you apologize to her. Keep; it's the right power dynamic for the character                                  |
| Food refusal         | Refuses when full; refusal = misbehavior      | Arbitrary refusal rules (letter-count!), species allergies | Preference/preparation refusals | Faithful in spirit to Neopets' absurdism, elevated with real meaning                                                                                          |
| Economy/shops        | None (P1)                                     | Daily-stocked shops, NP economy, no debt                   | Daily shop + **debt**           | Debt is novel to both; thematically justified (streamer precarity), mechanically broken as written (§2.3)                                                     |
| Sickness             | Cheap instant medicine; death if ignored      | Specific cures, free Healing Springs gamble                | $10,000 Hospital, no cheap tier | Both inspirations offer a _cheap or free_ recovery path; you offer none. Add a budget tier (your $7 Medicine item — what does it even do? The doc never says) |
| Snack overindulgence | Snacks → cavities/death in re-releases        | Bloated lockout                                            | Full → Sick, Sugar Crash        | Faithful lineage, well modernized                                                                                                                             |

**The progression gap deserves emphasis.** Tamagotchi's emotional engine is _watching care shape who your pet becomes_; Neopets' is accumulation. Your game is pure homeostasis — a perfectly-played run looks identical on day 1 and day 30, and literally _only ends when she dies_, meaning skilled players never reach an ending. The lore hands you the fix: **streamer career milestones as the evolution analog** (Affiliate → Partner → convention guest → tournament host, driven by completed streams, Creativity, and Bond). Milestones can gate cosmetic model upgrades — canonically accurate, since spending too much on new models is her stated vice.

---

## 6. On absurdity: where inconsistency helps and where it hurts

You said Bri isn't very logical and the game should carry absurdity and inconsistency. Agreed — but draw the line here:

- **Absurdity in content = good.** Item-specific refusal odds, a food that's only acceptable 35% of the time depending on preparation, a Mystery Snack with random nutrition, a stream fueled by pickle juice, a plushie you apologize through, a hospital that charges $10,000 for a 12-hour nap. Players _see_ these, laugh, and learn them. This is the Neopets tradition (a site where feeding a Kau milk instantly bloats it).
- **Inconsistency in bookkeeping = bad.** Things like "onset penalties apply on the elapsed-time path but not the direct-effect path," "room placement doesn't align statuses until the next reconciliation," and the Hospital-while-busy exception that _uniquely_ generates an event and Annoyed progress — players can't see these, can't learn them, and will experience them as bugs. Every hour you spend documenting an exception is evidence the exception shouldn't exist. Normalize the plumbing; spend the weirdness budget where it's visible.

The doc currently has its absurdity distributed backwards: the _rules engine_ is quirky in hidden ways while much of the _content_ (61 foods that are just "+1 Food") is flat.

---

## 7. Prioritized fix list

1. **(Blocker)** Add elapsed-time event opportunities — nothing autonomous currently happens without player input (§2.2).
2. **(Blocker)** Defuse the Hospital/debt death sentence — allow food purchases in debt, and route debt into stress instead (§2.3, §4.2).
3. **(Blocker)** Resolve the "run is not saved" vs. Realtime persistence contradiction (§2.1).
4. **(High)** Invert POTS: salt+water beneficial, salt-without-water risky, Salt Tablet useful (§4.1).
5. **(High)** Add a stress/anxiety pathway from money to Health — your own stated requirement, currently absent (§4.2).
6. **(High)** Restrict auto-snacks to safe foods; stop refusal-wasting player inventory autonomously (§4.3).
7. **(High)** Add a controllable secondary income (rigging commissions) to break the poverty spiral (§3.1).
8. **(Medium)** Fix Advance Time's Kidney Stone grace gap, the craving softlock, the durable multi-buy loophole, and the Annoyed re-onset ambiguity (§2.4–2.6).
9. **(Medium)** Replace the repeat-refusal rule with diminishing returns / comfort activities (§4.4).
10. **(Medium)** Add a progression spine (career milestones) so good play has a destination (§5).
11. **(Low)** Caffeine rule, sticker item, terminology rename ("Streaming mode" → "Manual time"), Annoyed telegraphing, Sick-clearance hint, snoring narration.

The bones here are better than most released pet games — the failure mode you're at risk of isn't "incoherent," it's "coherent but cruel in ways the player can't read or counter." Fix the three blockers and the salt inversion, and this stops being a generic tamagotchi with a skin and becomes what you're actually building: a care game where the care has to be _on her terms_.

---

me:
correct, intend to savce the state to save the state of the game. run cannot be resumed after death and cannot be rolled back.
my intent for Realtime is to not run thing in the background and evaluat past events once the user comes back. per example if the user doesn't do anything for 6 hours, the game would have simulated from the last timed event up to now the passage of time, this would include the random stream events or any other event that may have occured and they would simply get it as a list of events happening in the logs. i'm basically trying to lazy load the events and not have an actual timer. the day parts events would techincally be evaluated tehn. stuff like login (i can just have their creds have a session duration so if they leave the device too long it'd be invalid) and any atthempt to do an action after a big elapsed time would catchup the clock and simulate anything that may have happened.
so this is supposed to be a debt friendly mechnic ssince streams don't just get income for add view there are tiemn where they can get multiple donations from a stream ranging for 100s to 10s of thousands. rigth? a stream in on birthday stream or super creative stream could have a small chance to make a bid donation. this oportunity could reocure for every stream hour so 10 while large is possible to clear. the hard part is to no let mood decrease health to a lethal amount and this can be mitigated with things like gifts food and interactions. debt is debt, real people deal with it. i even picked the event and number because its a canonical thing that happened to bri and she lived it. clearly the 10k didn't kill her right? for 2.4 you are free to propose something but to me if a player is ingoring something like a sever medical emergency for a long period of time it's kinda on them. hospital purposively lets you take on the debt because it's an emergency. we could add duration limits for negative statius elements and allow them to pass naturally if the player can keep the per alive if that helps. same for craving a time based duration limit solves that and lets it reset until another craving opportunity shows up. so even if she craves something that's not in stock it'll clear. it encitividse the player to buy diverse items and be conservative to min max opportunities. preferably i would want something like a proper tamagotchi where it can be run indefinetly . it should be fair and only trully punish mistakes and neglect. you are right about growth an evolution. i need logic for it. attention call is risky for a web browser game, this is meant to be more casual. now for scold, it's a game about a real person there is a personal line as a fan i can't cross. we could add health insurance as a shop item to reduce hospital bill we can also add items that instantly max creativty and then make a rule where max creativty boosts super big donation probabilitiies. for snack again, salt sugar and other negative things ouht to impact health.
this is list of feedback you can disagree with or use to edit your response. like you mentioned, there are aspects i haven't included and might be genuienly good to have, other item types, mechanics, progression schemes are very much welcomed, you can even provide items you think would be useful. i'm not a game desinger so i'm open to ideas as long as it's not over complicated. the target audience will be her community and knowing her there is a small chance she will paly it in streamer mode. note for the personal line you don't need to worry about offending her it's just we need to not come out as too preachy. most of the content you currently gave me is in the format i expected so give me the full response again based on your opionion of my response

---

Confirmed some extra lore while revising (useful for the new systems): birthday **June 29**, debut **November 14, 2020**, the 3.0 overhaul in 2022 and the bunny→pixie re-debut on **October 6, 2024** — she is famously "always about to debut another one" (gremlin, goth, oni models…). Her fanbase is the **"Bridiots"**, her mom is also a VTuber (**MomAtCookiebox**), she hosted tournaments (The Balls Cup, The Wish Cup), and her actual rigging rates run up to **$2,750 for a full-body model**. That last number quietly solves half your economy problem, as you'll see.

Here is the full revised review with your decisions locked in.

---

# Companion-Care Game — Design Review v2

## Verdict up front

Your responses resolved two of my three blockers outright (save semantics, lazy-loaded autonomy) and reframed the third (debt) as an intentional survivable arc — which I now agree with, _provided_ the donation system is added, because the doc as written still has no way to earn $10,000. The remaining work is: **spec the lazy-load simulation precisely, spec the donation economy with real numbers, design the progression spine, and close the food-lockout hole in debt** — plus a short list of exploits and one respectful disagreement about salt.

---

## 1. Resolved by your decisions — here's the spec language to paste in

These were open issues; your intent settles them. I've written them as rules so you can drop them into the doc.

### 1.1 Save semantics

> _The run's state is saved continuously. A run cannot be rolled back and cannot be resumed after death. Ending the session does not end the run._

Delete "A run is one play session. The run is not saved." It contradicted everything else.

### 1.2 Realtime catch-up simulation (the lazy-load model)

Your design — no background timer, simulate elapsed time on return — is the right architecture for a web game and is exactly how modern idle games work. But the doc must grant **elapsed time its own event opportunities**, or nothing autonomous happens while away. Spec:

> _During elapsed-time catch-up, every two-game-hour boundary owns one event opportunity, resolved in chronological order at its boundary's clock time. Daypart multipliers, cooldowns, and eligibility use that boundary's time and state, not the return time. A stream that starts during catch-up resolves fully if it completes before the present; otherwise the player returns to find it in progress._

That last clause is free delight: logging in to discover she's mid-stream and three hours into a Dr Pepper–fueled bit is the fantasy of the whole game. Insert this as step 5½ in your "Order of time-based rules" (after automatic snacks, before shop refresh), and your daypart windows, midnight duration cap, and the word "autonomous" all become true with no timer running anywhere.

One addition to make indefinite offline survival _possible_ without removing neglect punishment:

> _Autonomous nap: when Rest is 0–2 and no activity is active, an elapsed-time event opportunity includes a high-weight (40) nap candidate. A nap is an ordinary Rest activity she starts herself._

Real Tamagotchis sleep on their own; adults do too. She still **starves** if the fridge is empty — neglect stays lethal, but "I slept 9 hours and she died of sleepiness" stops being a failure mode. This is the single cheapest change toward your "fair, indefinite, punish only mistakes" goal.

### 1.3 Craving expiry — accepted, spec:

> _An unfulfilled craving expires 24 game-hours after onset or at the second shop refresh, whichever comes first. Expiry is narrated wistfully and frees the craving slot._

Your reasoning is right: it incentivizes stocking diverse liked foods speculatively, which is the ARFID-caretaker fantasy anyway.

### 1.4 Kidney Stone passes naturally — your suggestion, and it's the correct one

> _At onset, the stone secretly draws a natural passing time of 36, 48, 60, or 72 game-hours with equal chances. If the companion survives that long, the stone passes: clears the status, Mood +1, narrated with exactly as much dignity as you'd expect. Hospital remains the instant, expensive route._

Worst case is six recurrence ticks: Health −6 and Rest −6 spread over 72 hours — brutal but survivable with active care. This converts Hospital from "mandatory ruin" into a genuine _choice_ (pay $10k to skip a miserable three days), which is much better design, keeps your "ignoring an emergency is on the player" stance, and is also just… how kidney stones work. Apply the same pattern to Sick if you want (say, self-clears after 48h _only if_ its Rest-based clearance was never earned — a slow-lane fallback).

### 1.5 Advance Time grace — minimal fix given the above

With stones passing naturally, the loophole shrinks, but one sentence still closes it cleanly:

> _In the non-critical Advance Time mode, the safety stop triggers on any Health change — periodic or direct — that would be lethal. The already-critical mode retains no protection._

Player-facing promise kept ("safe advance is safe"), your philosophy kept (once you're ignoring a critical companion, the gloves are off).

---

## 2. The debt economy — I'm now on your side, with conditions

You're right that I under-weighted donations: streamer income is _spiky_, not hourly, and "she took a $10k hit and lived" being canonical makes it thematically load-bearing rather than cruel. The debt arc can be the game's best story — **if** the following three pieces exist. Right now none of them are in the doc.

### 2.1 Donation system (new)

> _Each completed stream hour owns one donation roll (interrupted streams keep rolls for completed whole hours). The roll chance is $2\% + 0.5\% \times \text{Creativity}$, doubled while Creativity is 10. On a hit, draw a tier:_

| Tier            | Amount        | Weight | Condition                             |
| --------------- | ------------- | -----: | ------------------------------------- |
| Kind Bridiot    | $20–$60       |     55 | —                                     |
| Raid windfall   | $100–$400     |     27 | —                                     |
| Whale           | $1,000–$3,000 |     14 | —                                     |
| Legendary whale | $10,000       |      4 | Only while Creativity is 10 that hour |

> _Special dates: on June 29 (birthday) and November 14 (debut anniversary), stream weight ×2 and donation roll chance ×3 for the local date. Donations are always narrated. Donation income, like all income, pays down a negative balance first._

Sanity math: at Creativity 10 the roll is 7% and the expected value per hit is roughly $640, so about **$45/stream-hour** in expectation on top of the base rate — meaning an attentive, creative player clears an uninsured $10k in roughly three to five weeks of play, an anniversary stream can accelerate it dramatically, and a legendary whale (~1-in-370 stream hours at max Creativity) can erase it in one glorious Journey entry. Tune the weights, but hold this target: **uninsured debt should be a multi-week saga, not a coinflip and not a death sentence.** At starting Creativity 3 the roll is 3.5% — poverty is _supposed_ to be grindy.

### 2.2 Health Insurance (your idea — accepted, keep it dumb-simple)

> _Insurance Card — Care item, $150, durable, one claim. If owned when Hospital completes, the bill is reduced from $10,000 to $500 and the card is consumed._

One card, one claim, repurchase to re-cover. No premiums, no tiers — premiums are bookkeeping the player can't feel. The strategic texture is entirely in "do I spend $150 _now_ against a stone that _might_ happen," which is the whole comedy of American insurance in one shop entry. Not preachy; just a price tag.

### 2.3 The food lockout — the one place I'll still push

Here's the internal-logic problem with "negative balance blocks all purchases," using only your own words: your stated debt-survival plan is _"mitigated with things like gifts, food and interactions"_ — but gifts and food are **purchases**, and debt blocks purchases. Your mitigation strategy is disabled by the mechanic it's supposed to mitigate. Interactions alone can't hold Food up; only the shop can. So the surgical fix, keeping your "debt is debt" stance fully intact:

> _While the balance is negative, food and medicine may still be bought; each such purchase deepens the debt and triggers Money Stress (Mood −1, no daily cap while in debt). Reusables, upgrades, and decorations remain blocked._

Groceries on the credit card: realistic, characterful, still punished (every meal in debt costs Mood, which pressures Health), but never a starvation lock. Debt stays scary through this companion rule, which also delivers the stress→health pipeline you asked for in your very first message using machinery you already have:

> _Debt Stress: while the balance is negative, each unprotected periodic Health check reduces its recovery score by 1 per $2,500 of debt, up to −3._

No new meter, no new status — debt just quietly erodes her ability to bounce back, and the player counters it exactly how you said they should: food, gifts, interactions keeping Mood/Food/Rest above 5. Deaths in deep debt get attributed through reduced recovery plus Depression, and the graveyard tells the true story.

### 2.4 Rigging commissions (recommended, now with canonical pricing)

Donations are luck; players in a hole need one _agentive_ lever. Her actual job charges up to $2,750 per full-body model — this isn't a gameplay concession, it's the most canonical mechanic available:

> _Commission Work — a timed activity (available when Creativity ≥ 4, not Sleep Deprived/Depressed). Lasts 6 hours; pays $40 + $15 × Creativity on completion; Rest −2, Creativity −1, Mood equal chance of −1/0. Cannot start while any activity is active. Once per local date. Rare event variant: "a full-body commission comes in" — a 3-local-date project paying $400–800._

Note the shape: commissions trade Rest and Creativity for guaranteed money, streams trade nothing but _chance_ at money — so the player choosing between them is choosing between her health and her rent, which is the most honest streamer-economy loop I can imagine. If you only add one thing from this section beyond donations, add this.

---

## 3. Progression and evolution — the logic you asked for

You wanted evolution but casual and web-friendly, no attention calls. The lore hands you a perfect Tamagotchi-evolution analog because **Bri canonically evolves**: 2020 bunny → 2022 3.0 overhaul → 2024 pixie, plus goth/oni/gremlin alt models, and she's "always about to debut another one." Model debuts _are_ her evolution mechanic in real life. Spec:

### 3.1 Followers (the one new visible stat)

> _Followers start at 100 and never decrease. A completed stream adds its completed hours × (1 + Creativity ÷ 10), rounded, doubled during the boosted daypart. Each donation adds +5; whale tiers add +25. Interrupted streams add nothing._

One number, only goes up, fed entirely by systems that already exist. Casual players watch it climb; optimizers chase boosted-window streams.

### 3.2 Milestones

| Followers | Milestone            | Reward                                                          |
| --------: | -------------------- | --------------------------------------------------------------- |
|       250 | **Affiliate**        | Hourly stream rate becomes $8–$18; Journey celebration; Mood +2 |
|       600 | **Partner**          | Rate $10–$22; unlocks _New Model Commission_ in the shop        |
|     1,200 | **Convention Guest** | One-time $500 appearance fee; unlocks a wearable/decor set      |
|     2,000 | **Tournament Host**  | "The Balls Cup" event stream: guaranteed 8h, donation chance ×3 |
|     3,500 | **3D Debut**         | Final cosmetic tier; permanent +1% donation roll chance         |

### 3.3 New Model Commission — evolution as a purchase

> _New Model Commission — Upgrade, $300, available per unlocked tier. Takes 3 local dates to "finish rigging," then debuts: companion sprite changes permanently, Mood +3, Creativity +2, Followers +50, and the debut is a guaranteed stream event that night._

This is the emotional payoff loop: save up → commission → debut hype stream → donation spike. It's her actual career rendered as a game loop, it gives good play a _destination_ (my biggest v1 criticism), and it's canonically her stated financial vice, so overspending on models while in debt is a legitimate player roleplay choice. Which is beautiful.

### 3.4 Generational keepsake (Tamagotchi nod, optional)

> _At death, the graveyard offers to enshrine one owned durable. The next run starts with it, narrated: "Socks kept this safe."_

Five minutes of code, closes the permadeath loop with tenderness instead of nihilism, and gives the graveyard a function beyond autopsy.

---

## 4. Where I still disagree (briefly, mechanically, not morally)

<details>
<summary><strong>4.1 Salt — you're right that negatives should hurt Health; I'm proposing a band, not a buff</strong></summary>

Your position: salt/sugar excess ought to damage health. **Agreed, and the doc already does it** — Kidney Stone (excess salt + low water) and Sugar Crash both stay untouched. My proposal was never "salt is good, remove the punishment"; it's that for POTS specifically, _too little_ salt is **also** a mistake, so salt should be a band with punishment on both sides:

| 48h window          | Result                                                             |
| ------------------- | ------------------------------------------------------------------ |
| Salt ≥ 8, water ≤ 2 | Kidney Stone roll — **unchanged, your rule**                       |
| Salt ≥ 5, water ≥ 4 | Managed: no flares, stream weight +5                               |
| Salt ≤ 3            | _Dizzy Spell_ risk each check: Rest −1, Mood −1, blocks streams 4h |

This is strictly _more_ punishing than the current doc (a new way to fail), it just punishes a different mistake — undersalting a POTS body — alongside the existing one. It also makes the Salt Tablet and pickle juice _items with a purpose_ instead of pure traps. Two rows of rules, zero preaching, and the community members who know why she drinks pickle juice will notice you got it right.

</details>

<details>
<summary><strong>4.2 Auto-snacks should draw from safe foods only</strong></summary>

Unchallenged in your reply, so restating once: during streams she currently picks _uniformly_ from all owned food, including Disliked items she then refuses and 50%-wastes — the game destroying the player's inventory via her own hand. Restrict autonomous snack selection to Liked/Variable. More faithful (ARFID self-selection is safe-food selection), less hostile, and it creates the "stock her safe snacks before stream hours" prep loop, which is good strategy texture for free. Salt/sugar consequences still fully apply to what she grabs — your health-impact requirement is untouched.

</details>

<details>
<summary><strong>4.3 The repeat-refusal penalty still mischaracterizes her</strong></summary>

+10%/repeat refusal on identical Socialize/Play punishes sameness — but sameness is the comfort. Swap to diminishing returns (repeats accepted, rewards decay to +0) and the anti-grind protection survives while the character does too.

</details>

<details>
<summary><strong>4.4 Instant-max-Creativity item — yes, but as a status, not a permanent</strong></summary>

Your idea (item that maxes Creativity, and Creativity 10 unlocks the legendary donation tier) is good — the risk is only that a _permanent_ max trivializes the Creativity loop and turns the item into a mandatory pre-stream ritual. Bounded version:

> _Limited-Edition Dr Pepper — Food, $12, rare stock (1–2). Grants **Hyperfocus**: Creativity is pinned at 10 for 6 game-hours. When it ends: Creativity −2, Rest −2. Counts as 2 sugar servings and caffeine 3._

Same fantasy — chug the forbidden flavor, enter the zone, chase the whale — but it's a gamble with a comedown (which is also just an accurate depiction of hyperfocus). The legendary-tier gate at Creativity 10 from §2.1 already implements your "max creativity boosts super big donations" rule.

</details>

---

## 5. Remaining bugs and ambiguities (carry-over, unaddressed)

These weren't in your reply, so they're still open:

1. **Durable multi-buy loophole** — the doc _documents its own exploit_ ("the first purchase can currently request several copies… before the owned-copy check begins"). Fix or canonize; don't ship a confession.
2. **Bond-clock furniture exploit** — place/remove/re-place a Bond+1 item resets the 48h decay clock forever at zero net cost. Fix: only the first placement of a given copy per 48h window resets the clock.
3. **Annoyed re-onset** — background accumulation while Annoyed: does re-reaching the threshold fire another Mood −2? Pick one and write it. Also: exclude _blocked/invalid_ attempts (Rest at 10) from the streak, and consider flooring the secret threshold at 3 — a threshold of 2 means two reasonable actions can trigger it, which fails your own "only punish mistakes" standard.
4. **Auto-snack + Annoyed interaction** — state explicitly that refused auto-snacks don't feed the refusal streak (currently implied, never said).
5. **Terminology** — "Streaming mode" (time mode) vs. autonomous "streams" (activity) will confuse every single Bridiot who touches this. Rename the mode "Manual Time" — especially since there's now a real chance _she_ plays it on stream and reads the mode names aloud.
6. **The $7 Medicine item has no described effect anywhere in the doc.** With naturally-passing stones and a $500-insured Hospital, the obvious role: _Painkillers — suppresses Kidney Stone's recurring Health/Rest damage for 12 game-hours; does not shorten the stone._ Cheap comfort tier between "tough it out" and "hospital," completing a three-lane medical economy.

---

## 6. Item ideas (lore-verified, plug into existing systems)

| Item                             | Category                   | Behavior                                                                                                                                                                                                                               |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mini Tacos**                   | Food, Liked                | Canonical passion food; salt 2 — a _tempting_ salt source, feeding the salt-band tension                                                                                                                                               |
| **Dr Pepper**                    | Food, Liked                | Sugar 3, caffeine 3; caffeine rule: delays the next Rest decay tick 2h, then charges it late                                                                                                                                           |
| **Electrolyte Sachet**           | Care                       | Salt +2 _and_ water +2 to the window — the "correct" POTS item, priced above tastier options                                                                                                                                           |
| **Jar of Pickle Juice**          | Food, Liked (absurdly)     | Salt 3, water 2; Variable-narration horror for the Journey                                                                                                                                                                             |
| **Cheeseless Toppingless Pizza** | Food, Specific preparation | The flagship preparation item, 85% acceptable — _her_ order is the safe one                                                                                                                                                            |
| **The Concoction**               | Rename of Mystery Snack    | Jello, soda, peanut butter cookies, taco seasoning, three cups of pickle juice — canonical menace                                                                                                                                      |
| **Sheet of Cute Stickers**       | Decoration, cursed         | Interaction: Mood −2 (pittakionophobia); pure Neopets-style trap item, community in-joke                                                                                                                                               |
| **Rigging Tablet**               | Upgrade                    | Required to unlock Commission Work; the "get her tools" beat                                                                                                                                                                           |
| **Mom's Care Package**           | Event, not item            | Rare event candidate (weight 5, 72h cooldown, eligible when balance < $0 or Food ≤ 2): 2 random liked foods + Mood +1 — MomAtCookiebox is canon, and this is your pity-mechanic wearing a lore costume instead of a "mercy rule" label |
| **Cat Tree**                     | Decoration, Cat Corner     | Socks event weight +3; Socks outcomes shift to −1/+1/+1                                                                                                                                                                                |

---

## 7. Updated priority list

1. **(Blocker)** Write the elapsed-time event-opportunity rule into the time-order list — everything "autonomous" depends on it (§1.2).
2. **(Blocker)** Add the donation system — the $10k debt arc is only defensible once income spikes exist (§2.1).
3. **(Blocker)** Food/medicine purchasable in debt with Mood cost + Debt Stress recovery penalty — your own mitigation plan requires it (§2.3).
4. **(High)** Kidney Stone natural passing + Medicine-as-painkillers + Insurance Card — the three-lane medical economy (§1.4, §2.2, §5.6).
5. **(High)** Followers + milestones + New Model Commission — the progression spine (§3).
6. **(High)** Autonomous naps + craving expiry — the "fair indefinite Tamagotchi" pair (§1.2, §1.3).
7. **(Medium)** Auto-snacks from safe foods only; Annoyed floor/telegraph; the two exploit fixes (§4.2, §5).
8. **(Medium)** Salt band with Dizzy Spell — punishes mistakes in both directions, redeems the Salt Tablet (§4.1).
9. **(Low)** Hyperfocus Dr Pepper, Commission Work, keepsake inheritance, caffeine rule, mode rename, item flavor list.

One closing observation: your instinct that "the 10k didn't kill her" is the right design compass. The v1 doc simulated the _bill_ but not the _survival_ — no donations, no insurance, no groceries-on-credit, no passing the stone at home. Everything in this revision is just adding the parts of the true story where she lived.

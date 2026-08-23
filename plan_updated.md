# Virtual Pet Plan

## Current milestone

Deliver a responsive, static Svelte landing page that establishes the project’s colorful pixel-pet visual direction. It uses a CSS-only placeholder and care-stat preview. This milestone contains no gameplay, save state, API, Azure configuration, generated artwork, or third-party visual assets.

## Settled technical decisions

- Frontend: SvelteKit with Svelte and strict TypeScript.
- Delivery: static-site output suitable for later Azure Static Web Apps hosting.
- Runtime footprint: no component library, state library, image optimizer, analytics SDK, or external font request.
- Persistence: Azure Table Storage will be the canonical future database.
- Server boundary: a future Azure Functions API will own Azure credentials, recovery credentials, version validation, idempotency, and timestamps. The browser will not access Table Storage directly.
- Save model: a username and 8-digit recovery code identify a save; state writes carry a monotonically increasing version and an idempotency identifier.

## Delivery roadmap

### 1. Local starter site

- Establish the SvelteKit workspace, static build, formatting, linting, type checks, and local-development documentation.
- Create an original colorful CSS-only virtual-pet landing page that works on mobile and desktop.

### 2. Local persistence proof

- Add a separate Azure Functions app and Azurite Table Storage configuration for local development.
- Define server-side save entities for the current pet, recovery lookup, version, timestamps, graveyard records, and recent idempotency keys.
- Implement save creation, recovery, load, and versioned update endpoints before connecting the UI to them.

### 3. Playable first release

- Add local pet state, elapsed-time need decay, food interaction, death state, and graveyard presentation.
- Keep simulation client-side while sending bundled, idempotent state updates to the server.

### 4. Personality and polish

- Add food preferences, inventory, shopping, random events, variable attention, refused interactions, and pet-specific dialogue.
- Replace temporary art with original commissioned assets when available, then add animation, mobile refinements, and optional sound.

### 5. Deployment and release

- Provision Azure resources with Terraform and deploy through GitHub Actions using Azure OIDC.
- Add static hosting, Azure Functions, Table Storage, logging, cost alerts, basic rate limiting, and community testing.

## Acceptance checks for this milestone

- `pnpm check`, `pnpm lint`, `pnpm format`, and `pnpm build` pass.
- The page remains readable and free of horizontal overflow at 320px and 1440px widths.
- The page makes no API or third-party asset requests.
- The original source brief remains unchanged.

---

## Expanded game-design direction

This section is the master planning area for the post-landing-page game. It is intentionally broader than the current milestone and should not be treated as immediate implementation scope.

### Core premise

- The normal save should feel like a real-time Tamagotchi: Bri continues to exist while the player is away.
- The game is also a gift that Bri may want to play on stream, so it needs a second, event-driven mode that can complete days during one broadcast.
- Both modes must use the same actions, events, rules, statuses, items, and seeded randomness. Only the source of game time changes.
- The player should learn Bri's preferences through stream knowledge, deliberately incomplete descriptions, and trial and error.
- Item descriptions may hint at texture, salt, sugar, hydration, caffeine, protein, or preparation without revealing the exact stat result.
- Obvious public favorites such as Dr Pepper and Uncrustables may be obvious exceptions.

### Six visible metrics

| Metric | Meaning |
|---|---|
| Food | Current satiety/need to eat. It is not a direct nutrition score. |
| Health | General physical condition and accumulated consequences. |
| Mood | Immediate emotional state and tolerance for interactions. |
| Rest | Sleep debt and current capacity for long activities. |
| Bond | Relationship built through successful time spent together. |
| Creativity | Capacity and inspiration for streaming, rigging, art, games, and projects. |

### Hidden and derived simulation facts

The six visible metrics are not sufficient for contextual outcomes. Keep additional facts hidden from the player and expose them only through dialogue, status presentation, or item descriptions.

Candidate facts include:

- rolling salt load;
- rolling water/hydration intake;
- rolling protein intake;
- rolling sugar intake;
- rolling caffeine intake;
- calories/portion load;
- repeated-item and repeated-tag counts;
- recent sleep and stream duration;
- recent social/attention actions;
- time of day and day boundary;
- owned room upgrades and interaction unlocks;
- active blocking activity;
- active persistent statuses;
- recent refused actions and annoyance streaks.

A food can therefore be liked but unhealthy in the current context, disliked but nutritionally useful, or normally safe but harmful after repetition.

### Item behavior principles

- Do not make every item a static stat stick.
- An item may provide direct effect ranges, contribute hidden properties, unlock an interaction, alter an event pool, improve another action, clear a status, or do almost nothing useful.
- Buying an item should not automatically increase Bond. The purchase should create an opportunity; Bond comes from completing the related interaction.
- Permanent room items should usually modify future actions rather than immediately filling a metric.
- Games, books, shows, and toys can be reusable but should support novelty/repetition rules.
- Some expensive items should be worse than cheap items. The shop should not collapse into a linear upgrade tree.
- Truly unique lore items may target a rule by item ID, but most interactions should emerge from shared tags and properties.

## Data-driven simulation and rule engine

### Separation of responsibilities

Use the following boundary:

1. **Items describe facts**: price, category, description, tags, nutrition/property contributions, direct effect ranges, and reusable/consumable behavior.
2. **Rules describe consequences**: conditions over current state, rolling history, time, item tags, and active statuses.
3. **Statuses describe persistent consequences**: metric penalties, blocked options, and documented clearance conditions.
4. **Events record what happened**: action IDs, timestamps, inputs, rolls, outcomes, and blocking activity windows.

Do not put kidney-stone logic separately on chips, fries, pretzels, Doritos, and salt tablets. Those items contribute salt and water-related facts; one shared rule evaluates the accumulated context.

### Candidate item data shape

```json
{
  "id": "bbq-chips",
  "name": "BBQ chips",
  "category": "food",
  "description": "Smoky crunch with a heavy salt coat.",
  "edible": true,
  "consumable": true,
  "tags": ["food", "snack", "salty", "fried"],
  "properties": {
    "salt": 3,
    "water": -1,
    "protein": 0,
    "sugar": 1,
    "portion": 2
  },
  "effects": {
    "food": { "min": 2, "max": 4 },
    "mood": { "min": 0, "max": 2 }
  }
}
```

The exact values remain configurable JSON data. The frontend must not infer behavior from the description string.

### Candidate rule data shape

```json
{
  "id": "kidney-stone-risk",
  "trigger": "item_consumed",
  "priority": 200,
  "when": {
    "all": [
      { "fact": "rolling.salt", "window": "24h", "operator": ">=", "value": 8 },
      { "fact": "rolling.water", "window": "24h", "operator": "<=", "value": 2 },
      { "fact": "statuses", "operator": "lacks", "value": "kidney_stone" }
    ]
  },
  "chance": { "value": 0.35 },
  "effects": [
    { "type": "add_status", "status": "kidney_stone" },
    { "type": "emit_message", "messageId": "kidney-stone-start" }
  ]
}
```

The JSON provides configurable conditions and values. `src/lib/status-rules.ts` owns the allowed status names, status application/clearance behavior, and the evaluator integration. Items must not invent status behavior inside the item resolver.

### Initial rule vocabulary

Conditions:

- `stat_gt`, `stat_gte`, `stat_lt`, and `stat_lte`;
- `rolling_sum`, `rolling_count`, and `rolling_distinct_count` over a game-time window;
- item/tag/property checks;
- `has_status` and `lacks_status`;
- owned-item and unlocked-interaction checks;
- active blocking-activity checks;
- time-of-day/day-boundary checks;
- consecutive/repetition checks;
- deterministic probability checks.

Effects:

- modify one or more visible metrics;
- update a hidden aggregate;
- add or clear a persistent status;
- create or complete a blocking activity;
- schedule a future event;
- unlock an interaction;
- consume or add inventory;
- emit dialogue or an offline-recap entry;
- add an event-pool modifier.

### Deterministic evaluation order

For each accepted action:

1. Load canonical save and validate version/idempotency.
2. Determine effective game time.
3. Resolve due events in chronological order.
4. Reject the new action if a blocking activity is still active.
5. Apply the action's direct effects and inventory changes.
6. Append/update hidden history facts.
7. Evaluate eligible rules by deterministic priority and ID.
8. Apply status reconciliation and metric clamps.
9. Append immutable outcome events and increment the save version.

All random rolls must derive from the save seed, state version, action ID, and rule/event ID. Gameplay code must never call `Math.random()`.

### Example shared rules to support

- High salt over a rolling window plus too little water can roll a kidney-stone status.
- Too little salt over a rolling window can create a different low-salt/low-energy consequence without exposing the medical explanation in item text.
- Repeated sugary items can create an immediate mood benefit followed by a later crash.
- Repeated favorite foods should have diminishing mood returns.
- A high-protein disliked food may improve Health while reducing Mood or being refused.
- Dr Pepper can improve Mood while contributing sugar/caffeine and interacting with low Rest.
- Reading at low Mood can help, while reading at critically low Rest can trigger a stay-up-too-late event.
- Repeating the same game or show can reduce Creativity rewards unless a preference-specific rule overrides it.
- A room upgrade can modify sleep/stream effectiveness without directly changing a metric at purchase time.

### Statuses versus blocking activities

Persistent statuses and timed activities are different systems.

- `kidney_stone`, `sick`, `annoyed`, `full`, and `overstimulated` are persistent simulation state and clear only through explicit actions/items or documented reconciliation rules.
- `sleeping` and `streaming` are blocking activities with start/end timestamps. They are not statuses and do not need status-expiry timers.
- A blocking activity can produce a status when it completes, but the two records remain separate.

## Event, history, and clock model

### Lazy resolution instead of continuous ticking

The game does not need a background simulation process. Record actions/events and compare their timestamps with the effective current time whenever the player loads the save or attempts another action.

Candidate event shape:

```json
{
  "id": "evt_123",
  "type": "sleep_started",
  "sourceActionId": "act_456",
  "createdAt": "2026-08-21T02:00:00Z",
  "startsAt": "2026-08-21T02:00:00Z",
  "endsAt": "2026-08-21T09:00:00Z",
  "resolvedAt": null,
  "blocking": true,
  "payload": { "plannedHours": 7 }
}
```

On load/action:

```text
now = gameClock.now(save)
resolve all unresolved events with event time <= now
if an active blocking event ends after now:
    reject interactive actions and return remaining time
otherwise:
    evaluate the requested action
```

Event history should remain sufficient for rolling-window rules. Older detailed events may later be compacted into trusted aggregates plus graveyard/audit records so the save does not grow forever.

### Clock abstraction

```text
GameClock.now(save)
GameClock.advance(save, duration)
```

#### Normal mode

- `now()` returns authoritative server time.
- One game minute equals one real minute.
- Starting sleep or stream creates a blocking event ending in the future.
- Closing the browser or switching devices does not interrupt the activity.
- The next load/action resolves anything whose timestamp has passed.

#### Stream mode

- `now()` returns `save.virtualTime`.
- The clock moves only when an action advances it.
- Starting sleep, streaming, reading, watching, or playing performs a short transition, advances virtual time by the chosen/resolved duration, and processes all events crossed during that interval.
- Do not implement Stream Mode as a rapidly ticking real-time clock. Event-driven time skipping is easier to control and better for a broadcast.
- A seven-hour sleep can therefore complete immediately for the player while still consuming seven game-hours.

### Save-mode boundary

Use separate save slots for Normal Mode and Stream Mode. Do not allow a persistent save to toggle freely between clocks; that creates ambiguous timestamps and trivial time-skipping exploits.

Suggested fields:

```json
{
  "mode": "realtime",
  "virtualTime": null,
  "lastResolvedAt": "2026-08-21T12:00:00Z",
  "activeActivityId": null
}
```

For a Stream Mode save, `mode` is `stream` and `virtualTime` is required.

### Blocking activities

| Activity | Typical duration | Behavior |
|---|---:|---|
| Sleep | 4-9 game-hours; approximately 7 hours when Rest is critically low | Blocks interaction; restores Rest and may affect Health/Mood. |
| Stream | 2-6 game-hours | Blocks interaction; uses a selected game/content item and can affect Creativity, Mood, Bond, Rest, and currency/event outcomes. |
| Read | 30 minutes-3 game-hours | Usually non-blocking from the player's perspective in Stream Mode because time advances immediately; may become a long event. |
| Play game | 1-4 game-hours | Uses an owned game/controller and can unlock stream or bond events. |
| Watch episode/movie | 45 minutes-3 game-hours | Uses owned/rented media and can chain into “one more episode.” |
| Creative project | 30 minutes-4 game-hours | Uses creative supplies and can produce items/events. |

Normal Mode rejects new actions during an active blocking activity. Stream Mode advances directly through the activity and returns the completed result.

### Calendar days versus rolling windows

Use rolling game-time windows for physiological and behavioral consequences. Midnight must not erase a late-night salt binge.

Calendar-day resets are reserved for explicitly game-like systems such as:

- shop refresh;
- allowance or daily currency grant;
- one-per-day interactions;
- a daily random event;
- daily login presentation.

Store timestamps in UTC. Store a save timezone only for presentation and calendar-bound rules.

### Offline recap

When several events resolve while the player was away, return a concise recap instead of replaying every internal step. Example entries:

- Bri finished sleeping but stayed in bed longer than planned.
- Socks demanded attention.
- Food dropped while Bri was streaming.
- Too many salty snacks were consumed without enough water.

The recap is presentation derived from recorded outcomes, not a separate source of truth.

## Shop, ownership, and interaction model

### Item classes

- **Consumable:** removed after use, such as food, drinks, medicine, movie rentals, and one-use supplies.
- **Reusable activity item:** games, books, shows, controllers, toys, and creative tools.
- **Permanent upgrade:** bed, mattress, desk, chair, monitor, cat tree, and similar room/gear improvements.
- **Decoration/event modifier:** wall art, fairy lights, weapons, plushies, traffic cones, and other objects that alter room or random-event pools.
- **Interaction unlock:** an item that creates a new player action rather than directly changing a metric.
- **Chaotic collectible:** may be expensive, useless, or actively inconvenient, but exists for personality and discovery.

### Bond rules

- Bond should primarily come from successful interactions, not purchases.
- Items unlock or improve interaction opportunities: co-op games, reading together, rewatching a show, playing with Socks, karaoke, cooking, or looking through memories.
- Bond outcomes can depend on current Mood, Rest, repetition, item preference, time of day, and seeded randomness.
- Forcing interaction while Mood/Rest is poor can reduce Bond or cause refusal.

### Creativity rules

- Streaming, rigging, drawing, reading, games, music, crafts, and room inspiration can affect Creativity.
- Repetition should usually reduce Creativity returns.
- Low Rest may increase chaotic ideas but reduce successful completion.
- Equipment should modify action quality/event weighting rather than simply add permanent Creativity on purchase.

### Shop presentation

- The UI shows name, short description, price, category, ownership/quantity, and whether an item can currently be used.
- The UI does not show preference tier, exact effect ranges, hidden nutrition/property values, refusal chance, or rule hooks.
- Descriptions should generally fit one or two short lines on mobile.
- Internal preference headings in the catalogue below are design references only and must never be rendered to the player.

## Data cleanup before the expanded implementation

- Replace the current generic descriptions in `shop-items.json` with the player-facing catalogue below.
- Keep preference tags internal; do not render `favorite`, `kinda`, `disliked`, or `specific` as shop labels.
- Rework `salt-tablet`: it should contribute to salt-related history and may be beneficial in the correct context, but it should not clear `kidney_stone` merely because it is a salt tablet.
- Decide the canonical display name `Uncrustables` versus the joking shorthand `Crustables`; keep one stable item ID.
- Merge or deliberately differentiate duplicate concepts such as `pretzels`/`salted-pretzels` and `pizza`/`pizza-slice`.
- Correct the `potatoe-chips` ID/name typo with a migration alias if saves may already contain it.
- Decide singular display names for `Milkshake`, `Cupcake`, and similar entries while preserving stable IDs.
- Split the long shop dataset into maintainable category files or generate a compiled catalogue from smaller source files.
- Keep rule constants in JSON, status behavior in `src/lib/status-rules.ts`, seeded RNG in `src/lib/seeded-rng.ts`, and the rule/file inventory documentation current.

## Player-facing food catalogue

The headings below reveal internal preferences for planning only. The player sees only the item name and description.
### Good / confirmed-safe preference tier (design-only)
- **Dr Pepper:** Liquid serotonin, obviously.
- **Uncrustables:** Crust removed, problem solved.
- **Salt tablets:** All the salt. None of the snack.
- **Waffle:** Crispy grid of buttery carbs.
- **Pancake:** Soft stack of syrup-ready carbs.
- **Orange juice:** Sweet citrus, preferably pulp-free.
- **Tea:** Warm mug, gentle caffeine.
- **Chocolate milk:** Sugar, dairy, and some protein.
- **Pasta:** A bowl of dependable carbs.
- **Butter:** Concentrated fat; fixes many problems.
- **BBQ chips:** Smoky crunch with a heavy salt coat.
- **Sour cream:** Cool, creamy, and calorie-dense.
- **Lettuce:** Crisp leaves, mostly water.
- **Tomato:** Juicy, acidic, technically fruit.
- **Toast:** A butter-ready rectangle of stability.
- **Ketchup:** Sweet tomato sauce in disguise.
- **Mustard:** Sharp, tangy, and sneakily salty.
- **Broccoli:** Tiny trees packed with fiber.
- **Corn:** Sweet little kernels of starch.
- **Banana:** Soft, sweet, potassium-rich.
- **Potato chips:** Thin potatoes buried in salt.
- **Doritosuu:** Neon dust and aggressive seasoning.
- **Cheez-Its:** Tiny cheese squares with plenty of salt.
- **Cucumber:** Cold, crisp, mostly water.
- **Garlic bread:** Buttery carbs with irresponsible garlic.
- **Rice:** Plain, filling, dependable carbs.
- **Hash browns:** Crispy shredded potatoes and salt.
- **Tater tots:** Tiny potato cylinders with crunch.
- **Mashed potatoes:** Soft, buttery comfort carbs.
- **Milkshake:** Dessert, dairy, and sugar through a straw.
- **Taco:** Protein, carbs, toppings, structural risk.
- **Burrito:** An entire meal under tortilla containment.
- **Fries:** Crispy potatoes carrying a lot of salt.

### Never had
- No current items.

### Kinda / variable preference tier (design-only)
- **Sausage:** Salty, fatty, protein-packed mystery.
- **Water:** Literally just water.
- **Watermelon:** Sweet, crisp, mostly water.
- **Grape:** Tiny juice packets with skin attached.
- **Yogurt:** Tangy protein with texture variance.
- **Granola:** Crunchy sugar wearing a health-food badge.
- **Cheese:** Dense fat, protein, and strong opinions.
- **Chicken:** Lean, boring, high-protein.
- **Cake:** Frosting, flour, and a sugar spike.
- **Popcorn:** Light crunch until a kernel fights back.
- **Carrot:** Sweet root with a serious crunch.
- **Ranch dressing:** Creamy, salty vegetable camouflage.
- **Raisins:** Grapes with the water removed.
- **Lollipops:** Flavored sugar with a time commitment.
- **Chocolate:** Sugar, fat, instant gratification.
- **Caramel:** Sugar, but stickier.
- **Peanuts:** Crunchy protein and fat in tiny form.
- **Tuna:** A suspicious amount of lean protein.
- **Pepperoni:** Greasy little circles loaded with salt.
- **Pretzels:** Dry crunch with a salt coating.
- **Cupcakes:** Portable frosting with cake underneath.

### Do not like (design-only)
- **French toast:** Soft bread soaked in egg and sugar.
- **Egg:** Protein in a shell. See eggcup incident.
- **Bacon:** Crispy fat, protein, and a lot of salt.
- **Ham:** Cured protein with plenty of sodium.
- **Apple juice:** Sweet apple-flavored hydration.
- **Lemonade:** Sugar, water, aggressive citrus.
- **Coffee:** Bitter caffeine delivery system.
- **Milk:** Calcium and protein in liquid form.
- **Pear:** Sweet fruit with a grainy texture.
- **Orange:** Juicy citrus with built-in pulp.
- **Cantaloupe:** Soft melon with a very specific texture.
- **Blueberry:** Tiny berries with a sudden pop.
- **Raspberry:** Sweet-tart fruit full of seeds.
- **Kiwi:** Fuzzy outside, soft and seedy inside.
- **Hot dog:** Processed protein, bun, and lots of salt.
- **Chicken fingers:** Protein wearing crispy armor.
- **Onions:** Crunchy raw; slippery when cooked.
- **Pineapple:** Sweet, acidic, and mildly hostile.
- **Gummies:** Concentrated sugar with mandatory chewing.
- **Acai bowls:** Cold fruit under a pile of textures.
- **Celery:** Crunchy water reinforced with strings.
- **Cherry:** Sweet fruit built around a pit.
- **Peas:** Tiny green bursts of fiber and protein.
- **Almond:** Dry crunch packed with fat and protein.
- **Sunflower seeds:** Tiny nutrition behind manual labor.
- **Salsa:** Tomato, acid, chunks, and surprise heat.
- **Hummus:** Chickpeas blended into protein paste.
- **Coconut:** Sweet fat with stubborn shreds.
- **Turkey:** Lean protein with dry potential.
- **Cranberry sauce:** Tart fruit buried under sugar.
- **Sweet potatoes:** Sweet, starchy, vitamin-heavy.
- **Goldfish:** Tiny cheese crackers. Not actual fish.
- **Meatballs:** Dense spheres of seasoned protein.
- **Nachos:** Chips, cheese, salt, structural chaos.
- **BBQ ribs:** Fatty protein, sweet sauce, bone logistics.
- **Meat loaf:** Dense baked protein in loaf form.
- **Roast beef:** Roasted protein, usually served gray.
- **Chicken pot pie:** Protein and vegetables under soft pastry.

### Only in a very specific way (design-only)
- **Bagel:** Dense, chewy carbs; preparation matters.
- **Apple:** Sweet, crisp, fibrous, skin included.
- **Lemon:** An extremely sour vitamin-C grenade.
- **Strawberry:** Sweet fruit with seeds everywhere.
- **Bread:** Basic carbs with endless configuration options.
- **Cheeseburger:** Protein, fat, carbs, several variables.
- **Steak:** Dense protein with adjustable doneness.
- **Ice cream:** Cold dairy, fat, and plenty of sugar.
- **Brownies:** Dense chocolate with serious sugar potential.
- **Salad:** A responsible pile of uncontrolled variables.
- **Sushi:** Rice, protein, and texture roulette.
- **Gravy:** Salty liquid fat for other food.
- **Pizza:** Carbs, fat, salt, infinite configuration problems.
- **Apple pie:** Fruit surrounded by butter and sugar.
- **Fruit smoothies:** Several fruits compressed past texture.

## Planned non-edible shop catalogue

Descriptions are player-facing. Hooks are internal brainstorming, not final numeric effects.

### Streaming and work gear
- **Studio Mic:** Chat can hear everything now. Everything. _Candidate hooks: stream quality, creativity, stream-event weighting._
- **Stream Deck:** More buttons means more professional. _Candidate hooks: stream setup, creativity, shorter setup events._
- **New Keyboard:** Click clack, productivity allegedly. _Candidate hooks: creativity, mood, work events._
- **Drawing Tablet:** For productive creative endeavors. Obviously. _Candidate hooks: creativity, art interactions._
- **Monitor:** More screen for more problems. _Candidate hooks: streaming, creativity, setup progression._
- **PC Parts:** Tiny upgrades for a mighty setup. _Candidate hooks: stream quality, hardware events._
- **Webcam:** Say hi to the camera. _Candidate hooks: stream-event pool, social interactions._
- **Desk Chair:** Sitting equipment, but expensive. _Candidate hooks: rest loss during long streams, health._
- **Live2D Model:** Just one more model. Promise. _Candidate hooks: creativity, mood, major stream event._
- **Model Outfit:** The model needed clothes too. _Candidate hooks: creativity, mood, cosmetic stream event._
- **Rigging Software Upgrade:** More parameters. More jiggle. _Candidate hooks: creativity, work/rigging actions._
- **Commissioned Art:** Supporting artists is financially responsible. _Candidate hooks: mood, room decoration, stream event._
- **Stream Decorations:** Chat will definitely notice these. _Candidate hooks: creativity, mood, stream presentation._
- **Merch Sample:** Quality control requires keeping one. _Candidate hooks: mood, decoration, random merch events._

### Games and stream content
- **New Game:** Surely chat recommended something normal. _Candidate hooks: unlocks play/stream action, novelty bonus._
- **Horror Game:** This seemed wise at checkout. _Candidate hooks: volatile mood, creativity, bond through reactions._
- **Friendslop Game:** Better with friends. Worse for everyone else. _Candidate hooks: bond, mood, social event pool._
- **Soulslike:** How hard could it possibly be? _Candidate hooks: creativity, frustration risk, long stream._
- **Indie Game:** $12 and suspiciously good reviews. _Candidate hooks: creativity, discovery events._
- **Cursed Steam Game:** The reviews said 'Overwhelmingly Positive.' _Candidate hooks: high-variance mood/creativity events._
- **Cozy Game:** Low stakes. Allegedly. _Candidate hooks: mood recovery, lower-intensity stream._
- **Party Game:** A friendship stress test with menus. _Candidate hooks: bond, mood variance, social stream._
- **Rhythm Game:** Timing, music, immediate regret. _Candidate hooks: creativity, mood, fatigue._
- **Visual Novel:** Reading with branching consequences. _Candidate hooks: creativity, mood, long-session events._
- **Console:** A little extra fun for her room. _Candidate hooks: unlocks console games and couch play._
- **Controller:** Buttons, clicks, and cozy games. _Candidate hooks: unlocks solo play interactions._
- **Second Controller:** Now the backseating can be local. _Candidate hooks: unlocks co-op bond interaction._

### Socks and pet accessories
- **Cat Treats:** The actual currency of the household. _Candidate hooks: Socks mood, Bri mood, pet-event weighting._
- **Catnip:** What could possibly go wrong? _Candidate hooks: high-variance Socks events, mood._
- **Cat Toy:** It moves. Socks must destroy it. _Candidate hooks: unlocks play-with-Socks interaction._
- **Feather Wand:** Exercise for Socks. And Bri. _Candidate hooks: bond, mood, short activity._
- **Laser Pointer:** Tiny red enemy detected. _Candidate hooks: pet play, mood, chaotic events._
- **Cardboard Box:** Better than the expensive toy beside it. _Candidate hooks: cheap pet enrichment, random events._
- **Cat Bed:** Socks will sleep beside it. _Candidate hooks: room decoration, pet rest events._
- **Cat Tree:** Vertical Socks infrastructure. _Candidate hooks: pet enrichment, room event pool._
- **Scratching Post:** An optimistic attempt to save the furniture. _Candidate hooks: room protection, pet events._
- **Cat Tunnel:** Socks has entered the tube. _Candidate hooks: pet play, mood._
- **Window Perch:** Premium access to bird television. _Candidate hooks: pet mood, idle room events._
- **Cat Brush:** Removes fur from Socks; relocates it elsewhere. _Candidate hooks: pet care interaction, bond._
- **Cat Costume:** Socks did not approve this purchase. _Candidate hooks: brief mood event, annoyance risk._
- **Tiny Cat Hat:** Excellent for approximately four seconds. _Candidate hooks: photo event, mood variance._
- **Cat Camera:** Socks surveillance system online. _Candidate hooks: offline recap and pet events._
- **Automatic Feeder:** Removes one opportunity for human error. _Candidate hooks: pet-care automation, health._
- **Fancy Cat Fountain:** Maybe someone in this house will drink water. _Candidate hooks: pet health, water-related room events._
- **Socks Plushie:** Socks squared. Technology went too far. _Candidate hooks: mood, decoration._

### Entertainment and bond items
- **Book:** A few hundred pages of disappearing for a while. _Candidate hooks: mood, creativity, read interaction._
- **Really Long Book:** Unavailable for several business days. _Candidate hooks: large creativity gain, rest risk._
- **Manga:** Reading, but with pictures. _Candidate hooks: mood, creativity, shorter read action._
- **Red vs. Blue Box Set:** Time for another completely necessary rewatch. _Candidate hooks: unlocks RvB rewatch, bond, mood._
- **Glee Box Set:** This can only end emotionally. _Candidate hooks: unlocks Glee rewatch, mood variance, bond._
- **Movie Rental:** Two hours of mandatory not-working. _Candidate hooks: consumable movie-night interaction._
- **Board Game:** Requires locating other humans. _Candidate hooks: unlocks game-night bond interaction._
- **Puzzle:** One thousand tiny problems in one box. _Candidate hooks: creativity, mood, time sink._
- **Coloring Book:** Productive procrastination. _Candidate hooks: mood, creativity._
- **LEGO Set:** Expensive plastic meditation. _Candidate hooks: creativity, mood, long activity._
- **Karaoke Machine:** The neighbors have been warned. _Candidate hooks: unlocks karaoke interaction._
- **Headphones:** Everything else has been muted. _Candidate hooks: mood, focus, stream/reading modifiers._
- **Blanket:** Entertainment may now occur horizontally. _Candidate hooks: mood, rest, couch interactions._
- **Photo Album:** Evidence that any of this happened. _Candidate hooks: unlocks memories interaction, bond._
- **Book Club Pick:** Homework, but emotionally approved. _Candidate hooks: unlocks read-together interaction._
- **Blanket Fort Supplies:** A structurally questionable retreat. _Candidate hooks: unlocks build-fort interaction._
- **Cooking Supplies:** This could become food. _Candidate hooks: unlocks cook-together interaction._

### Room and comfort
- **New Bed:** A compelling argument for going to sleep. _Candidate hooks: improves sleep action effectiveness._
- **Soft Mattress:** Dangerously comfortable. _Candidate hooks: rest recovery, oversleep event weighting._
- **Fresh Bedsheets:** The bed has been reset. _Candidate hooks: temporary mood/rest modifier._
- **Weighted Blanket:** Maximum cozy achieved. _Candidate hooks: sleep quality, mood, oversleep risk._
- **Pillow:** One more could not hurt. _Candidate hooks: rest modifier._
- **Body Pillow:** Technically furniture. _Candidate hooks: mood, room decoration._
- **Sofa:** Sitting without being at the computer. _Candidate hooks: watch/read interactions, rest._
- **Beanbag Chair:** Productivity drops dramatically nearby. _Candidate hooks: mood, rest, creativity trade-off._
- **New Desk:** More surface area to cover in stuff. _Candidate hooks: creativity, work actions._
- **Bookshelf:** Storage for the inevitable book problem. _Candidate hooks: book capacity, room enrichment._
- **Bedside Lamp:** The big light is no longer required. _Candidate hooks: late reading, mood, rest risk._
- **Fairy Lights:** Tiny lights make everything better. _Candidate hooks: mood, room enrichment._
- **Blackout Curtains:** Outside privileges revoked. _Candidate hooks: sleep effectiveness, oversleep risk._
- **Rug:** The floor has been upgraded. _Candidate hooks: room enrichment, mood._
- **Plants:** Responsibility, but decorative. _Candidate hooks: room enrichment, care events._
- **Fake Plants:** Responsibility removed. _Candidate hooks: room enrichment without care events._
- **Wall Art:** The wall looked suspiciously empty. _Candidate hooks: mood, room personalization._
- **Mini Fridge:** Dr Pepper logistics optimized. _Candidate hooks: food storage, convenience events._
- **Snack Shelf:** Emergency provisions within arm's reach. _Candidate hooks: food access, overeating risk._
- **Cat Corner:** Socks owns part of the room now. _Candidate hooks: pet enrichment, room events._

### Creative and hobby supplies
- **Sketchbook:** Blank pages waiting for terrible ideas. _Candidate hooks: creativity interaction._
- **Fancy Pens:** Buying supplies counts as creating. _Candidate hooks: small creativity/mood modifier._
- **Paint Set:** The desk is in danger. _Candidate hooks: creative action, mess events._
- **Craft Supplies:** Future mess, neatly packaged. _Candidate hooks: creative and bond interactions._
- **Sewing Kit:** This could become something. _Candidate hooks: creativity, outfit/craft events._
- **3D Printer:** Every stupid idea can become physical. _Candidate hooks: creativity, chaotic item events._
- **Model Kit:** Assembly and patience sold separately. _Candidate hooks: creativity, focus, time sink._
- **Camera:** Bad decisions, now in higher resolution. _Candidate hooks: creative/photo events._
- **Polaroid Camera:** Memories with a material cost. _Candidate hooks: mood, bond, photo album events._
- **Notebook:** For ideas she will definitely write down. _Candidate hooks: creativity, planning events._
- **Whiteboard:** The plan is real once there are arrows. _Candidate hooks: creativity, stream planning._
- **Music Software:** New creative rabbit hole unlocked. _Candidate hooks: creativity, music events._

### Questionable purchases
- **Sword:** Bri owns a sword now. Sure. _Candidate hooks: mood, decoration, chaotic event pool._
- **Battle Axe:** Apparently the sword was not enough. _Candidate hooks: mood, decoration, chaotic event pool._
- **Second Sword:** Dual wielding has entered the budget. _Candidate hooks: rare event unlock, decoration._
- **Dagger:** For when the sword is inconvenient. _Candidate hooks: decoration, chaotic event._
- **Knight Helmet:** Provides no meaningful protection indoors. _Candidate hooks: costume/photo events._
- **Traffic Cone:** Do not ask. _Candidate hooks: pure decoration, mystery event._
- **Life-Size Cardboard Cutout:** This will be funny exactly once. _Candidate hooks: mood, room event._
- **Fog Machine:** Every room can be a boss arena. _Candidate hooks: stream/room events, chaos._
- **Disco Ball:** Absolutely essential infrastructure. _Candidate hooks: mood, karaoke/stream modifier._
- **Giant Plushie:** Furniture with a face. _Candidate hooks: mood, room enrichment._
- **Tiny Shopping Cart:** Finally, storage for tiny groceries. _Candidate hooks: decoration, random event._
- **Rubber Duck:** It knows what it did. _Candidate hooks: mystery event, decoration._
- **Mystery Box:** Financial decision pending. _Candidate hooks: random item/event outcome._
- **Five Plain Tortillas:** Five plain tortillas. Why?! _Candidate hooks: lore event, food-adjacent chaos._


## Interaction unlock map

| Owned item | Interaction unlocked | General outcome space |
|---|---|---|
| Controller + owned game | Play Game | Mood, Creativity, Rest cost, repetition rules |
| Second Controller | Co-op Night | Bond, Mood, social/random events |
| Stream-capable game | Start Game Stream | Creativity, Mood, Rest, currency/event outcomes |
| Book or Book Club Pick | Read / Read Together | Mood, Creativity, Bond, stay-up-too-late chance |
| Red vs. Blue Box Set | Rewatch Red vs. Blue | Mood, Bond, long-session/one-more-episode events |
| Glee Box Set | Rewatch Glee | Mood variance, Bond, emotional event pool |
| Movie Rental | Movie Night | Mood, Bond, Rest, consumable inventory |
| Cat Toy / Feather Wand / Laser Pointer | Play With Socks | Mood, Bond, pet-event outcomes |
| Karaoke Machine | Karaoke Night | Mood, Creativity, Bond, neighbor event pool |
| Board Game | Game Night | Bond, Mood, refusal/annoyance possibilities |
| Cooking Supplies | Cook Together | Bond, Creativity, Food, recipe failure/success events |
| Photo Album | Look Through Memories | Bond, Mood, graveyard/history callbacks |
| Blanket Fort Supplies | Build Fort | Bond, Mood, Rest, room event |
| Craft Supplies / Paint Set / LEGO Set | Make Something Together | Creativity, Bond, mess/random outcome |

## Open design decisions

- Final numeric property scale for salt, water, protein, sugar, caffeine, and portions.
- Whether hydration is only a hidden rolling fact or also appears through status/dialogue.
- Exact status-clearance rules, especially kidney stones, sickness, fullness, and overstimulation.
- Stream duration selection: player choice, RNG range, or content-dependent duration.
- Whether normal-mode activities can be cancelled and what penalty applies.
- Stream-mode win condition or run goal; it may remain an endless sandbox rather than a campaign.
- Currency sources after the first release. Streaming income is plausible but not yet settled.
- Shop refresh cadence and whether some items are always available.
- Whether durable items can break, be upgraded, or be resold.
- How much old event history is retained before compaction.
- Whether Socks has hidden pet-only needs or exists entirely through Bri events.
- Which room objects require commissioned sprites for the first public release.

## Expanded acceptance targets

These are future targets, not acceptance checks for the current landing-page milestone.

- The same action and rule suite produces equivalent deterministic outcomes in real-time and Stream Mode when given the same game-time sequence and seed inputs.
- A player can start sleep or stream, close the site, return from another device, and receive the correctly resolved state without continuous server processing.
- Stale clients cannot complete or bypass a blocking activity over newer state.
- Salty items automatically participate in shared salt/water rules without item-specific kidney-stone code.
- A newly added tagged item can participate in existing rules through JSON data alone.
- The player-facing shop does not expose preference tiers or exact outcomes.
- Bond is earned through interactions unlocked by ownership, not simply by spending currency.
- Long offline periods resolve into bounded deterministic events and a readable recap rather than an unbounded tick loop.

# Shop + Feed POC — prompt for Claude Code

## Context
This is a scoped prototype detour from the roadmap in `PLAN.md`. The long-term
plan uses SvelteKit + Azure Functions + Table Storage, but this task stays
entirely local and client-side so we can validate the shop/feed UX before
committing further backend effort. Don't modify `PLAN.md`, its milestones, or
its acceptance checks as part of this work.

## Goal
Add a Shop, Cart, Purchase, Inventory, and Feed flow to the existing SvelteKit
app, backed by a local JSON file — no API calls. Match the existing visual
style (see the "Good Morning, Oshi" mockup — purple/pink/orange retro-pixel
cards, bordered buttons, small-caps section labels). Reuse existing design
tokens/CSS rather than introducing a new style system.

## In scope
- Shop UI: browse items by category, see current currency, add item(s) to
  cart (qty 1+), purchase
- Inventory UI: owned items with quantity, select an item to see its
  image/description/qty
- Feed action: pick an inventory item and feed it to the pet
- Two stats only: hunger and mood, each a 0–10 bar
- Status effects: confused, annoyed, sick, overstimulated (rules below)
- A rules file documenting everything below for later reference

## Out of scope — do not build
- Azure Functions, Table Storage, or any network calls — read/write local
  JSON or in-memory state only
- Random stream events / income generation
- Any stat besides hunger and mood
- Persistence beyond the current session (in-memory is fine; localStorage
  only if trivial)

## Data model
Create `src/lib/data/shop-items.json` (adjust path to existing conventions).

```json
{
  "id": "dr-pepper",
  "name": "Dr Pepper",
  "category": "food",
  "price": 3,
  "image": "/items/dr-pepper.png",
  "description": "Her drink of choice. Always.",
  "edible": true,
  "hunger_value": 2,
  "tags": ["favorite", "salty"]
}
```

```json
{
  "id": "streaming-mic",
  "name": "Studio Mic",
  "category": "accessory",
  "price": 120,
  "image": "/items/mic.png",
  "description": "A proper condenser mic.",
  "edible": false,
  "tags": ["gear"]
}
```

Define a starting currency constant (e.g. 500) somewhere obvious and easy to
tune.

## Known food preferences (confirmed)
- Loves: Dr Pepper, Uncrustables — favorites, bigger hunger/mood bump on feed
- Hates: water — edible but tagged "disliked," little/negative benefit if fed
- Craves salt more than usual (she has POTS, so salty snacks should skew
  toward the favorite/bonus tier)

There's a longer preference chart ("picky eater test," color-coded: green =
good, orange/tan = never had or kinda, red = don't like, purple = only in a
specific way) that isn't fully transcribed here — I can misread small
color-coded text reliably, so don't take a full item-by-item list from me as
ground truth. If you want Claude Code to read the chart directly, save it
into the repo (e.g. `docs/reference/picky-eater-test.png`) and point it at
that path. Otherwise, ship this pass with the three confirmed items above
plus enough placeholder food to exercise the UI, and treat the JSON as a
living file you'll fill in by hand later.

## Accessories
Non-edible category: mic, monitor, PC parts, webcam, console, controller.
For this pass they're just purchasable/ownable — no stat effects yet.

## Shop & cart behavior
- Category tabs or filter (food / accessories)
- Item card: image, name, price, short description
- Add to cart with a quantity stepper; cart holds multiple distinct items
- Cart summary: line items, quantities, subtotal, total
- Purchase: deduct currency, move items into inventory (increment quantity
  if already owned), clear cart
- Insufficient funds: block purchase, show inline error

## Inventory behavior
- Grid/list of owned items with a quantity badge
- Selecting an item shows image, description, and quantity owned
- Feed is initiated from here (or from a "Feed" button on the selected item)

## Feed & stat rules
1. User selects an inventory item and feeds it.
2. **Not edible** → show `"{item} is not edible"`, set a transient
   `confused` flag, increment a consecutive-invalid-feed counter.
   - The failure threshold before the pet gets annoyed is randomized once
     per streak, in the range 2–5.
   - Hitting the threshold → set `annoyed`, decrease mood, reset the counter.
   - A successful edible feed resets the counter to 0.
3. **Edible** → increase hunger by the item's `hunger_value` (favorites give
   a bonus; disliked items like water give little/negative benefit).
   - If hunger is already at/near max (≥9) and the user feeds again → set
     `sick`. While sick, further feeding shouldn't keep raising hunger, and
     mood should take a modest hit. Pick a reasonable decay/recovery
     approach and write down what you chose.
4. **Overstimulation**: mood-raising actions (Cuddle/Play, whichever exist
   in the current UI) fired while mood is already at/near max (≥9) trigger
   `overstimulated` — mood drops considerably, more than a normal decrement.

Keep all thresholds and deltas above as named constants in one place, not
scattered magic numbers.

## Rules file
Create `docs/GAME_RULES.md` documenting every rule and constant introduced
here: stat ranges and starting values, the feed decision tree, the annoyed
threshold and its randomization, the sick trigger, the overstimulated
trigger, and the exact numeric deltas chosen. Write it for someone who
wasn't in this conversation — it becomes the reference doc for a future
in-depth design guide.

## Notes
This is a POC: prioritize the interactions working end-to-end over visual
polish or edge-case coverage. Pick sensible defaults for anything left
ambiguous above and note the choice in the rules file rather than stopping
to ask.

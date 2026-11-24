// Sinh tools/art_specs/full_b.json — bộ ảnh phong cách B (phẳng tối giản, không viền)
// Chạy: node tools/art_specs/full_b.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ST =
  'minimal flat vector illustration with NO outlines, clean geometric shapes, bold solid color fills with at most one subtle shade per shape, vivid saturated high-contrast palette (coral, teal, sunny yellow, royal blue, warm white), bright DAYTIME, very clean and readable at small size, modern educational infographic look, consistent with a cute kids coding game.';
const BG = (s) =>
  `${s} Wide 16:9. The floor must fill only the bottom 22 percent of the image with a clear straight horizontal floor line; the whole center and lower-middle area above the floor must be EMPTY (no furniture, no objects) because game objects are placed there.`;
const BIT = (outfit) =>
  `character sprite sheet of the SAME cute chibi kid mascot named Bit (big round head, short messy brown hair, big round dark eyes, rosy cheeks, teal t-shirt, blue jeans, ${outfit}) shown 4 times in a single horizontal row with equal spacing, full body, facing the viewer: pose 1 standing relaxed, pose 2 both arms raised working, pose 3 jumping happily, pose 4 dizzy and worried with swirly eyes. Same size and same outfit in every pose. Wide 4:1 image instead of square.`;

const items = [
  // ---- nền ----
  { name: 'bg_dj', bg: true, prompt: BG('a DJ music stage room: dark navy back wall with soft acoustic panels, colorful spotlights from the ceiling, a big loudspeaker on the far left and far right edges, stage floor at the bottom.') },
  { name: 'bg_city', bg: true, prompt: BG('a lively city street at golden hour seen straight from the front: a full row of TALL colorful shop houses and apartment buildings that fill the whole background from the floor line up to near the top of the image (no empty wall or blank band), shop fronts with awnings and shuttered doors at street level, many windows above, a few tall buildings in the far back, a strip of warm sky with a sun and a few clouds only at the very top, a grey sidewalk floor at the bottom with a yellow road line.') },
  { name: 'bg_dungeon', bg: true, prompt: BG('a friendly cartoon RPG dungeon hall: big purple-grey stone block wall, two wall torches on the left and right edges, a hanging banner, stone tile floor at the bottom. Bright and cheerful, not scary.') },
  { name: 'bg_kitchen', bg: true, prompt: BG('a bright restaurant back kitchen: white and mint tiled wall, a high shelf with plates and spice jars on the upper left, a range hood on the upper right, warm wooden floor at the bottom.') },
  // ---- đồ nội thất ----
  { name: 'table_long', prompt: 'a long low wooden workbench table seen from the front, very wide and short (about 8 times wider than tall), flat wooden top, two short legs at the ends.' },
  { name: 'dj_desk', prompt: 'a long DJ mixing desk seen from the front, very wide and short (about 8 times wider than tall), dark body with a thin glowing teal strip and small knobs along the top edge, two short legs.' },
  { name: 'city_platform', prompt: 'a long low concrete loading platform curb seen from the front, very wide and very short (about 12 times wider than tall), with a yellow safety stripe on its top edge.' },
  { name: 'kitchen_counter', prompt: 'a long kitchen counter seen from the front, very wide and short (about 7 times wider than tall), wooden cabinet doors with small handles, light stone countertop.' },
  // ---- Bàn & Kho ----
  { name: 'printer', prompt: 'a cute label printing machine (price tag printer): tall boxy body, a small dark screen on the front top, a paper slot in the middle, a paper roll on top.' },
  { name: 'storage_box', prompt: 'a wide wooden storage crate box with a lid, seen from the front, about 2 times wider than tall.' },
  { name: 'food_icons', prompt: 'icon sheet of 4 small food items in a single horizontal row with equal spacing: a red apple with a green leaf, a white and blue milk carton, a slice of strawberry cake, a pink ice cream cone. Same size each. Wide 4:1 image instead of square.' },
  // ---- DJ ----
  { name: 'dj_pad', prompt: 'a single square drum pad button of a beat sequencer, thick rubbery rounded square pad on a dark base, neutral light grey pad color, seen from the front with a slight top-down angle.' },
  { name: 'disc_presser', prompt: 'a cute vinyl record pressing machine: tall box body with a round platter holding a black vinyl record on the front, a pressing arm, an output slot at the bottom.' },
  // ---- Thành phố ----
  { name: 'parcel', prompt: 'a single closed cardboard delivery box with packing tape across the top and a small white shipping label, about 1.7 times wider than tall.' },
  { name: 'scooter', prompt: 'a cute delivery scooter seen from the side facing right, with a big cardboard cargo box on the back seat, no rider.' },
  { name: 'shipper_gate', prompt: 'a small delivery station kiosk booth with a striped awning on top and an open service window, seen from the front, taller than wide.' },
  // ---- Hầm ngục ----
  { name: 'dungeon_portal', prompt: 'a magic summoning portal: a stone archway with a swirling purple and teal energy inside, seen from the front, taller than wide.' },
  { name: 'slimes', prompt: 'sprite sheet of 3 cute round slime monsters in a single horizontal row with equal spacing, same blob shape and size, big eyes: slime 1 orange (fire) calm smiling, slime 2 pale lavender (ice) calm smiling, slime 3 red angry with frowning eyebrows. Wide 3:1 image instead of square.' },
  { name: 'loot_chest', prompt: 'a cute treasure chest, wooden with gold metal bands and a lock, closed, seen from the front.' },
  // ---- Bếp / Quán ----
  { name: 'stove', prompt: 'a kitchen stove top unit seen from the front: a frying pan sitting on a blue gas flame, control knobs on the front panel, wider than tall.' },
  { name: 'fridge', prompt: 'a cute two-door refrigerator seen from the front, a little taller than wide, rounded corners, small handles.' },
  { name: 'queue_window', prompt: 'a small square pass-through serving window frame with a wooden sill, open, seen from the front.' },
  { name: 'pos_terminal', prompt: 'a cash register POS terminal with a blank screen and a small keypad, seen from the front, wider than tall.' },
  { name: 'kitchen_hatch', prompt: 'a restaurant order pick-up window with a silver service bell on the counter and a small heat lamp on top, seen from the front, taller than wide.' },
  { name: 'lock_hook', prompt: 'a small wooden key hook board with one golden key hanging on a hook, wide and short, seen from the front.' },
  { name: 'wall_clock', prompt: 'a simple round wall clock with hands and tick marks but no numbers.' },
  { name: 'chefs', prompt: 'sprite sheet of 4 full-body cute chibi chefs in a single horizontal row with equal spacing, all wearing white chef hats and white jackets: figure 1 a chef with an ORANGE apron standing relaxed, figure 2 the same orange-apron chef stirring with a ladle, figure 3 a different chef with a GREEN apron standing relaxed, figure 4 the same green-apron chef stirring with a ladle. Same size each. Wide 4:1 image instead of square.' },
  // ---- Bit theo thế giới ----
  { name: 'bit_headphones', prompt: BIT('big teal DJ headphones on the head') },
  { name: 'bit_helmet', prompt: BIT('a yellow delivery helmet and a small delivery backpack') },
  { name: 'bit_mage', prompt: BIT('a purple wizard hat and a short purple cape') },
  { name: 'bit_chef', prompt: BIT('a white chef hat and a white apron') },
];
for (const it of items) it.style = ST;
const out = join(dirname(fileURLToPath(import.meta.url)), 'full_b.json');
writeFileSync(out, JSON.stringify(items, null, 2));
console.log(items.length, 'items →', out);

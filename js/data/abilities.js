/* ============ abilities.js — each Pokémon's innate ability ============
 * Designed on 20-10-2026 (one real ability per Pokémon, signature abilities first).
 * G.ABILITIES: id -> { n: name, c: category, d: what it does }
 * G.MON_ABILITY: dex -> ability id
 * Shown in the Pokémon tab and the Codex. Their effects are NOT applied in runs yet.
 */
G.ABILITIES = {
"adaptability": {
"n": "Adaptability",
"c": "Offense",
"d": "Moves of your own type deal +25% damage."
},
"air-lock": {
"n": "Air Lock",
"c": "Weather",
"d": "Weather has no downsides for you or your team, and you take 10% less damage from legendaries."
},
"analytic": {
"n": "Analytic",
"c": "Offense",
"d": "Hitting a foe that has already been hit this second deals +25% damage."
},
"anger-point": {
"n": "Anger Point",
"c": "Offense",
"d": "After a critical hit or a hit for over 20% HP: +50% Attack for 8 s."
},
"arena-trap": {
"n": "Arena Trap",
"c": "Status",
"d": "Ground-bound foes near you are slowed by 20%; Ground moves +10% damage."
},
"aura-break": {
"n": "Aura Break",
"c": "Defense",
"d": "Enemy legendaries and bosses deal 20% less damage to you and your team."
},
"bad-dreams": {
"n": "Bad Dreams",
"c": "Status",
"d": "Frozen or stunned enemies near you lose 4% max HP per second."
},
"ball-fetch": {
"n": "Ball Fetch",
"c": "Utility",
"d": "+15% chance for treasure Pokémon and gacha ticket drops."
},
"battery": {
"n": "Battery",
"c": "Team",
"d": "Nearby teammates deal +20% damage with special moves."
},
"battle-armor": {
"n": "Battle Armor",
"c": "Defense",
"d": "Enemies can never land critical hits on you; +6% damage reduction."
},
"beads-of-ruin": {
"n": "Beads of Ruin",
"c": "Defense",
"d": "Foes near you have their defenses lowered: +15% damage to them from everyone."
},
"beast-boost": {
"n": "Beast Boost",
"c": "Offense",
"d": "Every 25 defeated foes: +2% to your best stat for the rest of the run (max +30%)."
},
"berserk": {
"n": "Berserk",
"c": "Offense",
"d": "Dropping below 50% HP: +30% Sp. Atk until healed above it."
},
"big-pecks": {
"n": "Big Pecks",
"c": "Defense",
"d": "Your Defense can never be lowered; +6% damage reduction."
},
"blaze": {
"n": "Blaze",
"c": "Offense",
"d": "Below 40% HP: Fire moves deal +35% damage."
},
"bulletproof": {
"n": "Bulletproof",
"c": "Defense",
"d": "Take 30% less damage from enemy projectiles."
},
"cheek-pouch": {
"n": "Cheek Pouch",
"c": "Sustain",
"d": "Healing items and berries heal 50% more."
},
"chilling-neigh": {
"n": "Chilling Neigh",
"c": "Offense",
"d": "Every 25 defeated foes: +2% Attack for the rest of the run (max +30%)."
},
"chlorophyll": {
"n": "Chlorophyll",
"c": "Mobility",
"d": "+10% speed in the Forest biome; +30% speed in Harsh sunlight."
},
"clear-body": {
"n": "Clear Body",
"c": "Defense",
"d": "Your stats can never be lowered; immune to slow; +5% damage reduction."
},
"cloud-nine": {
"n": "Cloud Nine",
"c": "Weather",
"d": "Weather has no downsides for you (no chip damage, slow or weakened types)."
},
"color-change": {
"n": "Color Change",
"c": "Defense",
"d": "Your type changes to the type of the last attack that hit you (you resist it next time)."
},
"comatose": {
"n": "Comatose",
"c": "Defense",
"d": "Cannot be burned, poisoned, slowed or frozen."
},
"commander": {
"n": "Commander",
"c": "Team",
"d": "If a Dondozo is on your team: both get +30% to all stats."
},
"competitive": {
"n": "Competitive",
"c": "Offense",
"d": "Each time an enemy slows or debuffs you: +20% Sp. Atk for 8 s (stacks 3)."
},
"compound-eyes": {
"n": "Compound Eyes",
"c": "Offense",
"d": "+10% critical hit chance and your projectiles reach 15% further."
},
"contrary": {
"n": "Contrary",
"c": "Offense",
"d": "Stat drops become boosts: every 20 s, gain +8% Attack and Sp. Atk (stacks 5)."
},
"corrosion": {
"n": "Corrosion",
"c": "Status",
"d": "Your poison works on Steel and Poison foes and bosses, and lasts 30% longer."
},
"cotton-down": {
"n": "Cotton Down",
"c": "Status",
"d": "When you are hit, foes around you are slowed by 25% for 2 s."
},
"cud-chew": {
"n": "Cud Chew",
"c": "Sustain",
"d": "Each healing item you pick up heals you again 10 s later."
},
"cursed-body": {
"n": "Cursed Body",
"c": "Status",
"d": "Foes that hit you have a 30% chance to be frozen in place for 1.2 s (bosses: slowed)."
},
"cute-charm": {
"n": "Cute Charm",
"c": "Status",
"d": "Foes that touch you have a 30% chance to be charmed (stop attacking for 1.5 s)."
},
"dancer": {
"n": "Dancer",
"c": "Utility",
"d": "Dance moves (Swords Dance, Dragon Dance, Quiver Dance...) are cast twice."
},
"dark-aura": {
"n": "Dark Aura",
"c": "Team",
"d": "Everyone's Dark moves (yours and your team's) deal +30% damage."
},
"dauntless-shield": {
"n": "Dauntless Shield",
"c": "Defense",
"d": "Start every run with +30% damage reduction for the first 3 minutes, then +8% for the rest."
},
"dazzling": {
"n": "Dazzling",
"c": "Defense",
"d": "Enemy dash and lunge attacks cannot hit you; +5% damage reduction."
},
"defeatist": {
"n": "Defeatist",
"c": "Offense",
"d": "+30% damage above 50% HP, -20% below."
},
"defiant": {
"n": "Defiant",
"c": "Offense",
"d": "Each time an enemy slows or debuffs you: +20% Attack for 8 s (stacks 3)."
},
"disguise": {
"n": "Disguise",
"c": "Defense",
"d": "Blocks the first hit you take, then once more every 90 s."
},
"download": {
"n": "Download",
"c": "Offense",
"d": "Every 30 s, raises Attack or Sp. Atk by +20% (whichever beats the nearest foes) for 30 s."
},
"dragons-maw": {
"n": "Dragon's Maw",
"c": "Offense",
"d": "Dragon moves deal +40% damage."
},
"drizzle": {
"n": "Drizzle",
"c": "Weather",
"d": "Brings Rain: each run starts with 60 s of it, and it returns for 30 s every 4 min."
},
"drought": {
"n": "Drought",
"c": "Weather",
"d": "Brings Harsh sunlight: each run starts with 60 s of it, and it returns for 30 s every 4 min."
},
"dry-skin": {
"n": "Dry Skin",
"c": "Sustain",
"d": "Standing in water heals 2 HP/s and Rain heals 1.5 HP/s; take 20% more damage from Fire and in Harsh sunlight."
},
"early-bird": {
"n": "Early Bird",
"c": "Defense",
"d": "Freeze, stun and slow wear off twice as fast; +5% speed."
},
"earth-eater": {
"n": "Earth Eater",
"c": "Sustain",
"d": "Ground attacks heal you instead of hurting."
},
"effect-spore": {
"n": "Effect Spore",
"c": "Status",
"d": "Foes that touch you have a 30% chance to be poisoned, slowed or stunned."
},
"electric-surge": {
"n": "Electric Surge",
"c": "Team",
"d": "Creates Electric Terrain at the start of the run and every 4 min for 30 s: Electric moves +30% and no freeze or stun."
},
"electromorphosis": {
"n": "Electromorphosis",
"c": "Offense",
"d": "When hit: your next Electric move deals double damage."
},
"emergency-exit": {
"n": "Emergency Exit",
"c": "Mobility",
"d": "Dropping below 50% HP: +50% speed and 1.5 s of invulnerability (every 60 s)."
},
"fairy-aura": {
"n": "Fairy Aura",
"c": "Team",
"d": "Everyone's Fairy moves (yours and your team's) deal +30% damage."
},
"filter": {
"n": "Filter",
"c": "Defense",
"d": "Super-effective hits deal 25% less damage."
},
"flame-body": {
"n": "Flame Body",
"c": "Status",
"d": "Foes that touch you have a 30% chance to be burned; immune to lava."
},
"flare-boost": {
"n": "Flare Boost",
"c": "Offense",
"d": "While burned: +50% Sp. Atk."
},
"flash-fire": {
"n": "Flash Fire",
"c": "Defense",
"d": "Immune to Fire damage and lava; being hit by Fire powers up your Fire moves +30% for 6 s."
},
"flower-gift": {
"n": "Flower Gift",
"c": "Team",
"d": "In the Forest biome or Harsh sunlight, you and nearby teammates deal +15% damage."
},
"fluffy": {
"n": "Fluffy",
"c": "Defense",
"d": "Take 35% less contact damage, but 30% more Fire damage."
},
"forecast": {
"n": "Forecast",
"c": "Weather",
"d": "Your type follows the weather (Sun: Fire, Rain: Water, Snow: Ice) and you always get its boost."
},
"full-metal-body": {
"n": "Full Metal Body",
"c": "Defense",
"d": "Your stats can never be lowered; immune to slow; +12% damage reduction."
},
"fur-coat": {
"n": "Fur Coat",
"c": "Defense",
"d": "Take 30% less damage from enemy contact (melee and touch)."
},
"gale-wings": {
"n": "Gale Wings",
"c": "Mobility",
"d": "At full HP: Flying moves recharge 30% faster and you move 15% faster."
},
"gluttony": {
"n": "Gluttony",
"c": "Sustain",
"d": "Healing items and berries heal 30% more and you pick them up from 50% further."
},
"good-as-gold": {
"n": "Good As Gold",
"c": "Defense",
"d": "Immune to all status (burn, poison, slow, freeze) and to boss debuffs."
},
"grass-pelt": {
"n": "Grass Pelt",
"c": "Defense",
"d": "In the Forest biome or on grass: +20% damage reduction."
},
"grim-neigh": {
"n": "Grim Neigh",
"c": "Offense",
"d": "Every 25 defeated foes: +2% Sp. Atk for the rest of the run (max +30%)."
},
"gulp-missile": {
"n": "Gulp Missile",
"c": "Status",
"d": "Using a Water move catches prey; the next time you are hit it is spat at the attacker for heavy damage."
},
"guts": {
"n": "Guts",
"c": "Offense",
"d": "While burned, poisoned or slowed: +40% Attack, and burn does not lower your damage."
},
"harvest": {
"n": "Harvest",
"c": "Sustain",
"d": "Every 45 s, a berry grows at your feet (heals 15%); twice as often in Harsh sunlight."
},
"healer": {
"n": "Healer",
"c": "Team",
"d": "Every 4 s, 30% chance to cure the status of you or a nearby teammate; revive teammates 30% faster."
},
"honey-gather": {
"n": "Honey Gather",
"c": "Utility",
"d": "+30% PokéCoins at the end of the run."
},
"hospitality": {
"n": "Hospitality",
"c": "Team",
"d": "Reviving a teammate also heals them 25% more; nearby teammates regenerate +0.5 HP/s."
},
"huge-power": {
"n": "Huge Power",
"c": "Offense",
"d": "Attack ×1.35."
},
"hunger-switch": {
"n": "Hunger Switch",
"c": "Offense",
"d": "Alternates every 10 s: Full Belly (+15% Electric damage) and Hangry (Dark moves +15%)."
},
"hustle": {
"n": "Hustle",
"c": "Offense",
"d": "+25% Attack, but 10% of your physical attacks miss."
},
"hydration": {
"n": "Hydration",
"c": "Sustain",
"d": "Burn, poison and slow wear off twice as fast; in Rain or water they are removed at once."
},
"ice-body": {
"n": "Ice Body",
"c": "Sustain",
"d": "Immune to Snowfall; +0.5 HP/s, +2 HP/s in Snowfall or the Cave biome."
},
"ice-face": {
"n": "Ice Face",
"c": "Defense",
"d": "Blocks the first projectile you take, restored every 60 s or instantly in Snowfall."
},
"ice-scales": {
"n": "Ice Scales",
"c": "Defense",
"d": "Take 35% less damage from enemy projectiles and beams."
},
"illusion": {
"n": "Illusion",
"c": "Defense",
"d": "Disguised as a teammate or random Pokémon: foes ignore you for the first 3 s after each wave spawns."
},
"immunity": {
"n": "Immunity",
"c": "Defense",
"d": "Cannot be poisoned; +5% damage reduction."
},
"imposter": {
"n": "Imposter",
"c": "Utility",
"d": "Transforms into the first boss or rift legendary it sees, copying its stats and type for the rest of the run."
},
"infiltrator": {
"n": "Infiltrator",
"c": "Offense",
"d": "Your attacks ignore enemy shields and damage reduction."
},
"innards-out": {
"n": "Innards Out",
"c": "Status",
"d": "When knocked out, deal damage equal to the HP you lost in that hit to nearby foes."
},
"inner-focus": {
"n": "Inner Focus",
"c": "Defense",
"d": "Not knocked back or stunned; immune to slow. Bosses cannot interrupt your moves."
},
"insomnia": {
"n": "Insomnia",
"c": "Defense",
"d": "Cannot be frozen or stunned; +0.3 HP/s."
},
"intimidate": {
"n": "Intimidate",
"c": "Defense",
"d": "Foes near you deal 15% less damage (bosses 8%)."
},
"intrepid-sword": {
"n": "Intrepid Sword",
"c": "Offense",
"d": "Start every run with +30% Attack for the first 3 minutes, then +10% for the rest."
},
"iron-barbs": {
"n": "Iron Barbs",
"c": "Defense",
"d": "Foes that touch you take 15% of the damage back (bosses 5%)."
},
"iron-fist": {
"n": "Iron Fist",
"c": "Offense",
"d": "Punching moves deal +25% damage."
},
"justified": {
"n": "Justified",
"c": "Offense",
"d": "Hit by a Dark attack: +20% Attack for 8 s (stacks 3); Dark foes take +15% damage from you."
},
"keen-eye": {
"n": "Keen Eye",
"c": "Offense",
"d": "+6% critical hit chance; your moves reach 10% further."
},
"leaf-guard": {
"n": "Leaf Guard",
"c": "Defense",
"d": "In the Forest biome or Harsh sunlight you cannot be burned, poisoned or slowed."
},
"levitate": {
"n": "Levitate",
"c": "Defense",
"d": "Immune to Ground attacks, lava, water slowing and floor traps."
},
"libero": {
"n": "Libero",
"c": "Offense",
"d": "Your type changes to the move you use: every move gets the same-type bonus (+15% damage)."
},
"lightning-rod": {
"n": "Lightning Rod",
"c": "Offense",
"d": "Immune to Electric; each Electric hit you would take gives +20% Sp. Atk for 6 s (stacks 3)."
},
"limber": {
"n": "Limber",
"c": "Defense",
"d": "Cannot be slowed, frozen or stunned."
},
"lingering-aroma": {
"n": "Lingering Aroma",
"c": "Status",
"d": "Foes that touch you lose their special attacks for 5 s."
},
"liquid-ooze": {
"n": "Liquid Ooze",
"c": "Defense",
"d": "Foes that drain HP from you are hurt instead; Poison foes near you take +10% damage."
},
"liquid-voice": {
"n": "Liquid Voice",
"c": "Offense",
"d": "Sound moves become Water type and deal +15% damage."
},
"long-reach": {
"n": "Long Reach",
"c": "Offense",
"d": "Your melee and contact moves reach 30% further and never take contact damage."
},
"magic-bounce": {
"n": "Magic Bounce",
"c": "Defense",
"d": "Enemy status attacks and debuffs bounce back onto the attacker."
},
"magic-guard": {
"n": "Magic Guard",
"c": "Defense",
"d": "You only take damage from direct attacks: no poison, burn, weather, lava or recoil."
},
"magician": {
"n": "Magician",
"c": "Utility",
"d": "Hitting a boss or treasure foe can steal an extra item or coins (once per foe)."
},
"magma-armor": {
"n": "Magma Armor",
"c": "Defense",
"d": "Cannot be frozen or slowed; immune to Snowfall and lava."
},
"magnet-pull": {
"n": "Magnet Pull",
"c": "Status",
"d": "Steel foes near you are pulled toward you and take +20% damage; +20% pickup range."
},
"marvel-scale": {
"n": "Marvel Scale",
"c": "Defense",
"d": "While burned, poisoned or slowed: +30% damage reduction."
},
"mega-launcher": {
"n": "Mega Launcher",
"c": "Offense",
"d": "Pulse and aura moves deal +35% damage and size."
},
"merciless": {
"n": "Merciless",
"c": "Offense",
"d": "Poisoned foes always take critical hits from you."
},
"mirror-armor": {
"n": "Mirror Armor",
"c": "Defense",
"d": "Stat drops and slows are reflected onto the enemy; +8% damage reduction."
},
"misty-surge": {
"n": "Misty Surge",
"c": "Team",
"d": "Creates Misty Terrain at the start of the run and every 4 min: you and teammates cannot get any status for 30 s."
},
"mold-breaker": {
"n": "Mold Breaker",
"c": "Offense",
"d": "Your attacks ignore enemy shields, armour and immunities."
},
"motor-drive": {
"n": "Motor Drive",
"c": "Mobility",
"d": "Immune to Electric; each Electric hit you would take gives +15% speed for 6 s (stacks 3)."
},
"moxie": {
"n": "Moxie",
"c": "Offense",
"d": "Every 25 defeated foes: +2% Attack for the rest of the run (max +30%)."
},
"multiscale": {
"n": "Multiscale",
"c": "Defense",
"d": "At full HP you take 50% less damage."
},
"multitype": {
"n": "Multitype",
"c": "Utility",
"d": "Your type matches the type of your strongest move; +15% damage with it."
},
"mummy": {
"n": "Mummy",
"c": "Status",
"d": "Foes that touch you lose their special attacks for 5 s."
},
"mycelium-might": {
"n": "Mycelium Might",
"c": "Status",
"d": "Status moves (poison, slow, sleep) always land and ignore immunities; your moves recharge 5% slower."
},
"natural-cure": {
"n": "Natural Cure",
"c": "Sustain",
"d": "Status wears off 50% faster; picking up a heal also cures all status."
},
"neutralizing-gas": {
"n": "Neutralizing Gas",
"c": "Defense",
"d": "Enemy auras, shields and boss buffs near you are switched off."
},
"no-guard": {
"n": "No Guard",
"c": "Offense",
"d": "Your attacks always hit and ignore dodges, but enemies always hit you too."
},
"normalize": {
"n": "Normalize",
"c": "Offense",
"d": "All your moves become Normal type and deal +20% damage (and get the same-type bonus)."
},
"orichalcum-pulse": {
"n": "Orichalcum Pulse",
"c": "Weather",
"d": "Brings Harsh sunlight like Drought; +25% Attack in Harsh sunlight."
},
"overcoat": {
"n": "Overcoat",
"c": "Defense",
"d": "Immune to weather damage and spores; take 10% less damage from area attacks."
},
"overgrow": {
"n": "Overgrow",
"c": "Offense",
"d": "Below 40% HP: Grass moves deal +35% damage."
},
"own-tempo": {
"n": "Own Tempo",
"c": "Defense",
"d": "Cannot be slowed, stunned or confused; +5% speed."
},
"perish-body": {
"n": "Perish Body",
"c": "Status",
"d": "Foes that touch you are marked: after 5 s they take a big hit (bosses: smaller)."
},
"pickup": {
"n": "Pickup",
"c": "Utility",
"d": "+25% PokéCoins collected and a small chance for foes to drop a healing berry."
},
"pixilate": {
"n": "Pixilate",
"c": "Offense",
"d": "Your Normal moves become Fairy type and deal +20% damage."
},
"poison-heal": {
"n": "Poison Heal",
"c": "Sustain",
"d": "Poison heals you instead (2 HP/s), and you are immune to poison damage."
},
"poison-point": {
"n": "Poison Point",
"c": "Status",
"d": "Foes that touch you have a 30% chance to be poisoned."
},
"poison-puppeteer": {
"n": "Poison Puppeteer",
"c": "Status",
"d": "Poisoning a foe also confuses it: it attacks other foes for 2 s."
},
"power-spot": {
"n": "Power Spot",
"c": "Team",
"d": "Nearby teammates deal +20% damage."
},
"prankster": {
"n": "Prankster",
"c": "Utility",
"d": "Buff, shield and status moves recharge 30% faster."
},
"pressure": {
"n": "Pressure",
"c": "Defense",
"d": "Foes near you attack 15% slower (their attacks and projectiles recharge slower)."
},
"prism-armor": {
"n": "Prism Armor",
"c": "Defense",
"d": "Super-effective hits deal 30% less damage; +5% damage reduction."
},
"propeller-tail": {
"n": "Propeller Tail",
"c": "Offense",
"d": "Your projectiles cannot be blocked or redirected and pierce +1 foe."
},
"protean": {
"n": "Protean",
"c": "Offense",
"d": "Your type changes to the move you use: every move gets the same-type bonus (+15% damage)."
},
"protosynthesis": {
"n": "Protosynthesis",
"c": "Offense",
"d": "Your best stat (Attack, Sp. Atk or Speed) +15%; +30% in Harsh sunlight."
},
"psychic-surge": {
"n": "Psychic Surge",
"c": "Team",
"d": "Creates Psychic Terrain at the start of the run and every 4 min for 30 s: Psychic moves +30% and enemy projectiles are 30% slower."
},
"punk-rock": {
"n": "Punk Rock",
"c": "Offense",
"d": "Sound moves deal +30% damage; take 30% less from sound attacks."
},
"pure-power": {
"n": "Pure Power",
"c": "Offense",
"d": "Attack ×1.35."
},
"purifying-salt": {
"n": "Purifying Salt",
"c": "Defense",
"d": "Immune to burn, poison and slow; take 30% less Ghost damage."
},
"quark-drive": {
"n": "Quark Drive",
"c": "Offense",
"d": "Your best stat (Attack, Sp. Atk or Speed) +15%; +30% while a shrine power is active."
},
"queenly-majesty": {
"n": "Queenly Majesty",
"c": "Defense",
"d": "Enemy dash and lunge attacks cannot hit you; +5% damage reduction."
},
"quick-feet": {
"n": "Quick Feet",
"c": "Mobility",
"d": "While burned, poisoned or slowed: +40% speed (and slows do not apply)."
},
"rain-dish": {
"n": "Rain Dish",
"c": "Sustain",
"d": "+0.5 HP/s; +2 HP/s in Rain."
},
"rattled": {
"n": "Rattled",
"c": "Mobility",
"d": "Hit by Bug, Ghost or Dark: +20% speed for 5 s."
},
"receiver": {
"n": "Receiver",
"c": "Team",
"d": "When a teammate goes down, gain +20% damage for the rest of the run (once per teammate)."
},
"reckless": {
"n": "Reckless",
"c": "Offense",
"d": "Dash, charge and recoil moves deal +25% damage."
},
"refrigerate": {
"n": "Refrigerate",
"c": "Offense",
"d": "Your Normal moves become Ice type and deal +20% damage."
},
"regenerator": {
"n": "Regenerator",
"c": "Sustain",
"d": "+1.2 HP/s while you have not been hit for 3 s."
},
"ripen": {
"n": "Ripen",
"c": "Sustain",
"d": "Berries and healing items work twice as well."
},
"rks-system": {
"n": "RKS System",
"c": "Utility",
"d": "Your type matches your held item or the biome, and you always get same-type bonus on it."
},
"rock-head": {
"n": "Rock Head",
"c": "Defense",
"d": "No recoil from your moves (Life Orb, dash and charge moves); +5% damage reduction."
},
"rough-skin": {
"n": "Rough Skin",
"c": "Defense",
"d": "Foes that touch you take 15% of the damage back (bosses 5%)."
},
"sand-force": {
"n": "Sand Force",
"c": "Offense",
"d": "Immune to Sandstorm damage; Rock, Ground and Steel moves +12% damage (+30% in a Sandstorm)."
},
"sand-rush": {
"n": "Sand Rush",
"c": "Mobility",
"d": "Immune to Sandstorm damage; +10% speed in the Volcano biome, +30% in a Sandstorm."
},
"sand-spit": {
"n": "Sand Spit",
"c": "Weather",
"d": "When you are hit, a 6 s Sandstorm whips up around you (immune to it)."
},
"sand-stream": {
"n": "Sand Stream",
"c": "Weather",
"d": "Brings a Sandstorm: each run starts with 60 s of it, and it returns for 30 s every 4 min. You are immune to it."
},
"sap-sipper": {
"n": "Sap Sipper",
"c": "Offense",
"d": "Immune to Grass; each Grass hit you would take gives +20% Attack for 6 s (stacks 3)."
},
"schooling": {
"n": "Schooling",
"c": "Offense",
"d": "From level 20 and above 25% HP: School Form, +40% damage and +50% max HP."
},
"seed-sower": {
"n": "Seed Sower",
"c": "Status",
"d": "When you are hit, the ground around you sprouts grass that heals you 1 HP/s for 5 s."
},
"serene-grace": {
"n": "Serene Grace",
"c": "Status",
"d": "Your moves' extra effects (burn, poison, slow, freeze, crit) are twice as likely."
},
"shadow-shield": {
"n": "Shadow Shield",
"c": "Defense",
"d": "At full HP you take 50% less damage; this cannot be bypassed."
},
"shadow-tag": {
"n": "Shadow Tag",
"c": "Status",
"d": "Foes near you are slowed by 20% and cannot flee (treasure Pokémon stay catchable longer)."
},
"sharpness": {
"n": "Sharpness",
"c": "Offense",
"d": "Slicing moves deal +35% damage."
},
"shed-skin": {
"n": "Shed Skin",
"c": "Sustain",
"d": "Every 4 s, 35% chance to shed any burn, poison or slow."
},
"sheer-force": {
"n": "Sheer Force",
"c": "Offense",
"d": "Moves with an extra effect (burn, poison, slow, freeze) lose it but deal +30% damage."
},
"shell-armor": {
"n": "Shell Armor",
"c": "Defense",
"d": "Enemies can never land critical hits on you; +6% damage reduction."
},
"shield-dust": {
"n": "Shield Dust",
"c": "Defense",
"d": "Immune to burn, poison and slow; take 10% less from area attacks."
},
"shields-down": {
"n": "Shields Down",
"c": "Defense",
"d": "Above 50% HP: +25% damage reduction and status immunity. Below: +30% damage and speed."
},
"simple": {
"n": "Simple",
"c": "Offense",
"d": "All stat boosts from cards, buffs and shrines are 50% stronger."
},
"skill-link": {
"n": "Skill Link",
"c": "Offense",
"d": "Multi-hit moves always hit the maximum number of times and get +1 projectile."
},
"slow-start": {
"n": "Slow Start",
"c": "Offense",
"d": "For the first 5 minutes: -50% Attack and speed. After that: +40% Attack and +20% speed for the rest of the run."
},
"slush-rush": {
"n": "Slush Rush",
"c": "Mobility",
"d": "Immune to Snowfall damage and slow; +30% speed in Snowfall."
},
"sniper": {
"n": "Sniper",
"c": "Offense",
"d": "Critical hits deal ×2.25 instead of ×1.5."
},
"snow-warning": {
"n": "Snow Warning",
"c": "Weather",
"d": "Brings Snowfall: each run starts with 60 s of it, and it returns for 30 s every 4 min. You are immune to it."
},
"solar-power": {
"n": "Solar Power",
"c": "Offense",
"d": "+12% Sp. Atk; in Harsh sunlight +40% Sp. Atk but lose 1% max HP per second."
},
"solid-rock": {
"n": "Solid Rock",
"c": "Defense",
"d": "Super-effective hits deal 25% less damage."
},
"soul-heart": {
"n": "Soul Heart",
"c": "Offense",
"d": "Every 25 defeated foes nearby: +2% Sp. Atk for the rest of the run (max +30%)."
},
"soundproof": {
"n": "Soundproof",
"c": "Defense",
"d": "Immune to sound attacks (roars, screeches, Boomburst-type moves) and take 10% less from bosses."
},
"speed-boost": {
"n": "Speed Boost",
"c": "Mobility",
"d": "+2% speed every 30 s for the rest of the run (max +30%)."
},
"stall": {
"n": "Stall",
"c": "Defense",
"d": "Your moves recharge 15% slower, but you take 15% less damage."
},
"stalwart": {
"n": "Stalwart",
"c": "Defense",
"d": "Cannot be knocked back, pulled or stunned; your moves ignore enemy shields."
},
"stamina": {
"n": "Stamina",
"c": "Defense",
"d": "When hit: +4% damage reduction for 8 s (stacks 5)."
},
"stance-change": {
"n": "Stance Change",
"c": "Offense",
"d": "Using an attack switches to Blade Forme (+25% damage); not attacking for 2 s switches to Shield Forme (+25% damage reduction)."
},
"static": {
"n": "Static",
"c": "Status",
"d": "Foes that touch you have a 30% chance to be stunned for 0.8 s; Electric moves +5% damage."
},
"steadfast": {
"n": "Steadfast",
"c": "Mobility",
"d": "Cannot be stunned; each time you are knocked back gain +15% speed for 4 s."
},
"steelworker": {
"n": "Steelworker",
"c": "Offense",
"d": "Steel moves deal +40% damage."
},
"stench": {
"n": "Stench",
"c": "Defense",
"d": "Foes near you have a 10% chance to flinch (skip their attack)."
},
"storm-drain": {
"n": "Storm Drain",
"c": "Offense",
"d": "Immune to Water; each Water hit you would take gives +20% Sp. Atk for 6 s (stacks 3)."
},
"strong-jaw": {
"n": "Strong Jaw",
"c": "Offense",
"d": "Biting moves deal +35% damage."
},
"sturdy": {
"n": "Sturdy",
"c": "Defense",
"d": "A hit that would knock you out from above 50% HP leaves you at 1 HP (every 45 s)."
},
"super-luck": {
"n": "Super Luck",
"c": "Offense",
"d": "+10% critical hit chance."
},
"supersweet-syrup": {
"n": "Supersweet Syrup",
"c": "Defense",
"d": "At the start of the run and after each boss spawns: nearby foes are slowed 30% for 4 s."
},
"supreme-overlord": {
"n": "Supreme Overlord",
"c": "Offense",
"d": "+5% damage for each teammate down or defeated foe boss this run (max +30%)."
},
"swarm": {
"n": "Swarm",
"c": "Offense",
"d": "Below 40% HP: Bug moves deal +35% damage."
},
"sweet-veil": {
"n": "Sweet Veil",
"c": "Team",
"d": "You and nearby teammates cannot be frozen or stunned."
},
"swift-swim": {
"n": "Swift Swim",
"c": "Mobility",
"d": "Water never slows you; +30% speed in Rain."
},
"symbiosis": {
"n": "Symbiosis",
"c": "Team",
"d": "When you pick up a healing item, nearby teammates are healed for half as much."
},
"synchronize": {
"n": "Synchronize",
"c": "Status",
"d": "When a foe burns, poisons or slows you, it gets the same status."
},
"technician": {
"n": "Technician",
"c": "Offense",
"d": "Moves with a short cooldown (under 0.8 s) deal +35% damage."
},
"telepathy": {
"n": "Telepathy",
"c": "Team",
"d": "Your attacks never hurt or knock back teammates; nearby teammates take 8% less damage."
},
"tera-shift": {
"n": "Tera Shift",
"c": "Defense",
"d": "At the start of each run: +20% max HP and +10% damage reduction."
},
"teravolt": {
"n": "Teravolt",
"c": "Offense",
"d": "Your attacks ignore enemy shields, armour and immunities; Electric moves +15%."
},
"thermal-exchange": {
"n": "Thermal Exchange",
"c": "Defense",
"d": "Immune to burn; Fire hits give +15% Attack for 6 s (stacks 3)."
},
"thick-fat": {
"n": "Thick Fat",
"c": "Defense",
"d": "Take 35% less damage from Fire and Ice."
},
"tinted-lens": {
"n": "Tinted Lens",
"c": "Offense",
"d": "Not very effective hits deal double damage (counted as neutral)."
},
"torrent": {
"n": "Torrent",
"c": "Offense",
"d": "Below 40% HP: Water moves deal +35% damage."
},
"tough-claws": {
"n": "Tough Claws",
"c": "Offense",
"d": "Melee and contact moves deal +25% damage."
},
"toxic-chain": {
"n": "Toxic Chain",
"c": "Status",
"d": "Every hit has a 30% chance to badly poison (stronger poison)."
},
"toxic-debris": {
"n": "Toxic Debris",
"c": "Status",
"d": "When you are hit, you leave poison spikes that poison foes who step on them."
},
"trace": {
"n": "Trace",
"c": "Utility",
"d": "Copies a random ability from a nearby teammate (solo: a random Psychic ability) at the start of the run."
},
"transistor": {
"n": "Transistor",
"c": "Offense",
"d": "Electric moves deal +30% damage."
},
"triage": {
"n": "Triage",
"c": "Sustain",
"d": "Healing moves and draining moves heal 50% more."
},
"truant": {
"n": "Truant",
"c": "Offense",
"d": "Your moves fire every other cooldown, but deal +120% damage."
},
"turboblaze": {
"n": "Turboblaze",
"c": "Offense",
"d": "Your attacks ignore enemy shields, armour and immunities; Fire moves +15%."
},
"unaware": {
"n": "Unaware",
"c": "Defense",
"d": "Ignore enemy buffs: bosses' and legendaries' enraged or boosted damage does not apply to you."
},
"unburden": {
"n": "Unburden",
"c": "Mobility",
"d": "Once your held item has been used, or with no item: +30% speed."
},
"unnerve": {
"n": "Unnerve",
"c": "Defense",
"d": "Foes near you deal 10% less damage and drop no healing items for themselves."
},
"unseen-fist": {
"n": "Unseen Fist",
"c": "Offense",
"d": "Contact moves ignore enemy shields and protection; +10% Attack."
},
"victory-star": {
"n": "Victory Star",
"c": "Team",
"d": "You and your teammates get +10% critical hit chance and your moves reach 10% further."
},
"vital-spirit": {
"n": "Vital Spirit",
"c": "Defense",
"d": "Cannot be frozen or stunned; -5% move cooldowns."
},
"volt-absorb": {
"n": "Volt Absorb",
"c": "Sustain",
"d": "Electric attacks heal you instead of hurting."
},
"wandering-spirit": {
"n": "Wandering Spirit",
"c": "Status",
"d": "Foes that touch you are weakened: they deal 20% less damage for 5 s."
},
"water-absorb": {
"n": "Water Absorb",
"c": "Sustain",
"d": "Water attacks heal you instead of hurting; standing in water heals 1 HP/s."
},
"water-bubble": {
"n": "Water Bubble",
"c": "Offense",
"d": "Immune to burn; take 40% less Fire damage; Water moves +30% damage."
},
"water-compaction": {
"n": "Water Compaction",
"c": "Defense",
"d": "Water hits give +15% damage reduction for 8 s (stacks 3); standing in water +10% damage reduction."
},
"water-veil": {
"n": "Water Veil",
"c": "Defense",
"d": "Cannot be burned; immune to lava."
},
"well-baked-body": {
"n": "Well-Baked Body",
"c": "Defense",
"d": "Immune to Fire; Fire hits give +10% damage reduction for 6 s (stacks 3)."
},
"wimp-out": {
"n": "Wimp Out",
"c": "Mobility",
"d": "Dropping below 50% HP: +50% speed and 1.5 s of invulnerability (every 60 s)."
},
"wind-power": {
"n": "Wind Power",
"c": "Offense",
"d": "When hit by a wind or Flying attack: your next Electric move deals double damage."
},
"wind-rider": {
"n": "Wind Rider",
"c": "Mobility",
"d": "Immune to wind attacks; being hit by one gives +20% Attack and speed for 6 s."
},
"wonder-guard": {
"n": "Wonder Guard",
"c": "Defense",
"d": "Only super-effective hits can damage you, but your max HP is 1/4."
},
"zen-mode": {
"n": "Zen Mode",
"c": "Offense",
"d": "Below 50% HP: become Zen Mode, switching to Psychic type with +30% Sp. Atk."
},
"zero-to-hero": {
"n": "Zero to Hero",
"c": "Offense",
"d": "After your first knockout or revive in a run: Hero Form, +30% Attack and HP."
}
};
G.MON_ABILITY = {"1":"chlorophyll","2":"chlorophyll","3":"chlorophyll","4":"solar-power","5":"solar-power","6":"solar-power","7":"rain-dish","8":"rain-dish","9":"rain-dish","10":"shield-dust","11":"shed-skin","12":"compound-eyes","13":"shield-dust","14":"shed-skin","15":"sniper","16":"keen-eye","17":"keen-eye","18":"keen-eye","19":"guts","20":"guts","21":"sniper","22":"sniper","23":"intimidate","24":"intimidate","25":"static","26":"static","27":"sand-rush","28":"sand-rush","29":"poison-point","30":"poison-point","31":"poison-point","32":"poison-point","33":"poison-point","34":"poison-point","35":"magic-guard","36":"magic-guard","37":"flash-fire","38":"flash-fire","39":"competitive","40":"competitive","41":"inner-focus","42":"inner-focus","43":"chlorophyll","44":"chlorophyll","45":"chlorophyll","46":"effect-spore","47":"effect-spore","48":"compound-eyes","49":"tinted-lens","50":"arena-trap","51":"arena-trap","52":"pickup","53":"technician","54":"swift-swim","55":"swift-swim","56":"anger-point","57":"anger-point","58":"intimidate","59":"intimidate","60":"water-absorb","61":"water-absorb","62":"water-absorb","63":"magic-guard","64":"magic-guard","65":"magic-guard","66":"no-guard","67":"no-guard","68":"no-guard","69":"chlorophyll","70":"chlorophyll","71":"chlorophyll","72":"rain-dish","73":"rain-dish","74":"sturdy","75":"sturdy","76":"sturdy","77":"flash-fire","78":"flash-fire","79":"regenerator","80":"regenerator","81":"sturdy","82":"sturdy","83":"defiant","84":"early-bird","85":"early-bird","86":"thick-fat","87":"thick-fat","88":"stench","89":"stench","90":"skill-link","91":"skill-link","92":"levitate","93":"levitate","94":"cursed-body","95":"sturdy","96":"insomnia","97":"insomnia","98":"sheer-force","99":"sheer-force","100":"static","101":"static","102":"chlorophyll","103":"chlorophyll","104":"lightning-rod","105":"lightning-rod","106":"reckless","107":"iron-fist","108":"cloud-nine","109":"neutralizing-gas","110":"neutralizing-gas","111":"lightning-rod","112":"lightning-rod","113":"natural-cure","114":"chlorophyll","115":"early-bird","116":"swift-swim","117":"poison-point","118":"swift-swim","119":"swift-swim","120":"natural-cure","121":"natural-cure","122":"filter","123":"technician","124":"dry-skin","125":"static","126":"flame-body","127":"moxie","128":"intimidate","129":"swift-swim","130":"intimidate","131":"water-absorb","132":"imposter","133":"adaptability","134":"water-absorb","135":"volt-absorb","136":"flash-fire","137":"trace","138":"swift-swim","139":"swift-swim","140":"swift-swim","141":"swift-swim","142":"rock-head","143":"thick-fat","144":"pressure","145":"static","146":"flame-body","147":"marvel-scale","148":"marvel-scale","149":"multiscale","150":"pressure","151":"synchronize","152":"overgrow","153":"overgrow","154":"overgrow","155":"flash-fire","156":"flash-fire","157":"flash-fire","158":"sheer-force","159":"sheer-force","160":"sheer-force","161":"keen-eye","162":"keen-eye","163":"tinted-lens","164":"tinted-lens","165":"swarm","166":"iron-fist","167":"sniper","168":"sniper","169":"inner-focus","170":"volt-absorb","171":"volt-absorb","172":"static","173":"magic-guard","174":"competitive","175":"hustle","176":"hustle","177":"synchronize","178":"synchronize","179":"static","180":"static","181":"static","182":"chlorophyll","183":"huge-power","184":"huge-power","185":"sturdy","186":"drizzle","187":"chlorophyll","188":"chlorophyll","189":"chlorophyll","190":"pickup","191":"chlorophyll","192":"chlorophyll","193":"speed-boost","194":"water-absorb","195":"water-absorb","196":"synchronize","197":"synchronize","198":"super-luck","199":"regenerator","200":"levitate","201":"levitate","202":"shadow-tag","203":"sap-sipper","204":"sturdy","205":"sturdy","206":"serene-grace","207":"immunity","208":"sturdy","209":"intimidate","210":"intimidate","211":"poison-point","212":"technician","213":"sturdy","214":"guts","215":"inner-focus","216":"pickup","217":"guts","218":"magma-armor","219":"magma-armor","220":"thick-fat","221":"thick-fat","222":"hustle","223":"hustle","224":"sniper","225":"hustle","226":"swift-swim","227":"sturdy","228":"flash-fire","229":"flash-fire","230":"swift-swim","231":"pickup","232":"sturdy","233":"trace","234":"intimidate","235":"technician","236":"guts","237":"intimidate","238":"hydration","239":"static","240":"flame-body","241":"thick-fat","242":"natural-cure","243":"pressure","244":"pressure","245":"pressure","246":"guts","247":"shed-skin","248":"sand-stream","249":"multiscale","250":"regenerator","251":"natural-cure","252":"overgrow","253":"overgrow","254":"overgrow","255":"speed-boost","256":"speed-boost","257":"speed-boost","258":"torrent","259":"torrent","260":"torrent","261":"quick-feet","262":"intimidate","263":"pickup","264":"pickup","265":"shield-dust","266":"shed-skin","267":"swarm","268":"shed-skin","269":"compound-eyes","270":"swift-swim","271":"swift-swim","272":"swift-swim","273":"chlorophyll","274":"chlorophyll","275":"wind-rider","276":"guts","277":"guts","278":"rain-dish","279":"drizzle","280":"trace","281":"trace","282":"trace","283":"swift-swim","284":"intimidate","285":"poison-heal","286":"poison-heal","287":"truant","288":"vital-spirit","289":"truant","290":"compound-eyes","291":"speed-boost","292":"wonder-guard","293":"soundproof","294":"soundproof","295":"soundproof","296":"thick-fat","297":"thick-fat","298":"huge-power","299":"sturdy","300":"normalize","301":"normalize","302":"stall","303":"intimidate","304":"sturdy","305":"sturdy","306":"sturdy","307":"pure-power","308":"pure-power","309":"static","310":"static","311":"lightning-rod","312":"volt-absorb","313":"prankster","314":"tinted-lens","315":"natural-cure","316":"liquid-ooze","317":"liquid-ooze","318":"rough-skin","319":"rough-skin","320":"water-veil","321":"water-veil","322":"simple","323":"magma-armor","324":"drought","325":"thick-fat","326":"thick-fat","327":"contrary","328":"arena-trap","329":"levitate","330":"levitate","331":"water-absorb","332":"water-absorb","333":"natural-cure","334":"natural-cure","335":"immunity","336":"shed-skin","337":"levitate","338":"levitate","339":"hydration","340":"hydration","341":"adaptability","342":"adaptability","343":"levitate","344":"levitate","345":"storm-drain","346":"storm-drain","347":"swift-swim","348":"swift-swim","349":"swift-swim","350":"marvel-scale","351":"forecast","352":"color-change","353":"cursed-body","354":"cursed-body","355":"levitate","356":"pressure","357":"chlorophyll","358":"levitate","359":"super-luck","360":"shadow-tag","361":"ice-body","362":"ice-body","363":"thick-fat","364":"thick-fat","365":"thick-fat","366":"shell-armor","367":"swift-swim","368":"swift-swim","369":"swift-swim","370":"swift-swim","371":"sheer-force","372":"rock-head","373":"intimidate","374":"clear-body","375":"clear-body","376":"clear-body","377":"sturdy","378":"ice-body","379":"clear-body","380":"levitate","381":"levitate","382":"drizzle","383":"drought","384":"air-lock","385":"serene-grace","386":"pressure","387":"overgrow","388":"overgrow","389":"overgrow","390":"iron-fist","391":"iron-fist","392":"iron-fist","393":"competitive","394":"competitive","395":"competitive","396":"reckless","397":"intimidate","398":"intimidate","399":"simple","400":"simple","401":"shed-skin","402":"technician","403":"intimidate","404":"intimidate","405":"intimidate","406":"natural-cure","407":"natural-cure","408":"sheer-force","409":"sheer-force","410":"sturdy","411":"sturdy","412":"shed-skin","413":"overcoat","414":"tinted-lens","415":"hustle","416":"pressure","417":"pickup","418":"swift-swim","419":"swift-swim","420":"chlorophyll","421":"flower-gift","422":"storm-drain","423":"storm-drain","424":"technician","425":"flare-boost","426":"flare-boost","427":"limber","428":"cute-charm","429":"levitate","430":"super-luck","431":"limber","432":"thick-fat","433":"levitate","434":"stench","435":"stench","436":"levitate","437":"levitate","438":"sturdy","439":"filter","440":"natural-cure","441":"keen-eye","442":"pressure","443":"rough-skin","444":"rough-skin","445":"rough-skin","446":"pickup","447":"prankster","448":"justified","449":"sand-stream","450":"sand-stream","451":"sniper","452":"sniper","453":"dry-skin","454":"dry-skin","455":"levitate","456":"swift-swim","457":"swift-swim","458":"swift-swim","459":"snow-warning","460":"snow-warning","461":"pressure","462":"sturdy","463":"cloud-nine","464":"solid-rock","465":"chlorophyll","466":"motor-drive","467":"flame-body","468":"hustle","469":"speed-boost","470":"chlorophyll","471":"ice-body","472":"poison-heal","473":"thick-fat","474":"adaptability","475":"sharpness","476":"sturdy","477":"pressure","478":"cursed-body","479":"levitate","480":"levitate","481":"levitate","482":"levitate","483":"pressure","484":"pressure","485":"flash-fire","486":"slow-start","487":"pressure","488":"levitate","489":"hydration","490":"hydration","491":"bad-dreams","492":"natural-cure","493":"multitype","494":"victory-star","495":"contrary","496":"contrary","497":"contrary","498":"thick-fat","499":"thick-fat","500":"reckless","501":"torrent","502":"torrent","503":"torrent","504":"analytic","505":"analytic","506":"pickup","507":"intimidate","508":"intimidate","509":"prankster","510":"prankster","511":"gluttony","512":"gluttony","513":"gluttony","515":"gluttony","517":"synchronize","518":"synchronize","519":"super-luck","521":"super-luck","524":"sturdy","525":"sturdy","526":"sturdy","527":"unaware","528":"unaware","529":"sand-rush","530":"sand-rush","531":"regenerator","532":"guts","533":"guts","534":"guts","535":"swift-swim","536":"swift-swim","537":"swift-swim","539":"sturdy","540":"chlorophyll","541":"chlorophyll","542":"chlorophyll","543":"poison-point","544":"poison-point","545":"poison-point","546":"prankster","547":"prankster","548":"chlorophyll","549":"chlorophyll","550":"reckless","551":"intimidate","552":"intimidate","553":"intimidate","554":"hustle","555":"zen-mode","556":"water-absorb","557":"sturdy","559":"moxie","560":"moxie","561":"magic-guard","562":"mummy","563":"mummy","566":"defeatist","567":"defeatist","568":"stench","569":"stench","570":"illusion","571":"illusion","572":"technician","573":"technician","574":"competitive","575":"competitive","576":"competitive","577":"magic-guard","578":"magic-guard","579":"magic-guard","580":"keen-eye","581":"keen-eye","582":"ice-body","583":"ice-body","584":"ice-body","585":"chlorophyll","586":"chlorophyll","587":"motor-drive","588":"no-guard","589":"swarm","590":"effect-spore","593":"water-absorb","594":"regenerator","595":"compound-eyes","596":"compound-eyes","597":"iron-barbs","598":"iron-barbs","599":"clear-body","600":"clear-body","601":"clear-body","602":"levitate","603":"levitate","604":"levitate","605":"synchronize","606":"synchronize","607":"flash-fire","608":"flash-fire","609":"flash-fire","610":"unnerve","611":"unnerve","612":"unnerve","613":"slush-rush","614":"slush-rush","615":"levitate","617":"hydration","619":"regenerator","620":"regenerator","621":"rough-skin","622":"iron-fist","623":"iron-fist","624":"defiant","625":"defiant","627":"sheer-force","628":"sheer-force","629":"big-pecks","630":"big-pecks","631":"flash-fire","632":"truant","633":"hustle","634":"hustle","635":"levitate","636":"flame-body","637":"flame-body","638":"justified","639":"justified","640":"justified","641":"prankster","642":"prankster","643":"turboblaze","644":"teravolt","645":"sand-force","646":"pressure","647":"justified","648":"serene-grace","649":"download","650":"overgrow","651":"overgrow","652":"overgrow","653":"blaze","654":"blaze","655":"blaze","656":"protean","657":"protean","658":"protean","659":"pickup","660":"pickup","661":"gale-wings","662":"gale-wings","663":"gale-wings","664":"compound-eyes","665":"shed-skin","666":"compound-eyes","667":"moxie","669":"symbiosis","670":"symbiosis","671":"symbiosis","672":"grass-pelt","673":"grass-pelt","674":"iron-fist","675":"iron-fist","676":"fur-coat","677":"keen-eye","678":"prankster","679":"no-guard","680":"no-guard","681":"stance-change","682":"healer","684":"unburden","685":"unburden","686":"contrary","687":"contrary","688":"tough-claws","689":"tough-claws","690":"poison-point","691":"poison-point","692":"mega-launcher","693":"mega-launcher","694":"dry-skin","695":"dry-skin","696":"strong-jaw","697":"strong-jaw","698":"refrigerate","699":"refrigerate","700":"pixilate","701":"limber","702":"pickup","703":"sturdy","704":"sap-sipper","705":"sap-sipper","706":"sap-sipper","707":"prankster","708":"natural-cure","709":"natural-cure","710":"pickup","711":"pickup","712":"ice-body","713":"ice-body","714":"infiltrator","715":"infiltrator","716":"fairy-aura","717":"dark-aura","718":"aura-break","719":"clear-body","720":"magician","721":"water-absorb","722":"long-reach","723":"long-reach","724":"long-reach","725":"intimidate","726":"intimidate","727":"intimidate","728":"liquid-voice","729":"liquid-voice","730":"liquid-voice","731":"skill-link","734":"strong-jaw","736":"swarm","737":"battery","738":"levitate","739":"iron-fist","740":"iron-fist","741":"dancer","742":"honey-gather","743":"honey-gather","744":"keen-eye","745":"sand-rush","746":"schooling","747":"merciless","748":"merciless","749":"stamina","750":"stamina","751":"water-bubble","752":"water-bubble","753":"contrary","754":"contrary","755":"effect-spore","757":"corrosion","758":"corrosion","759":"fluffy","760":"fluffy","761":"leaf-guard","762":"leaf-guard","763":"queenly-majesty","764":"triage","766":"receiver","767":"wimp-out","768":"emergency-exit","769":"water-compaction","770":"water-compaction","771":"innards-out","772":"battle-armor","773":"rks-system","774":"shields-down","775":"comatose","776":"shell-armor","777":"iron-barbs","778":"disguise","779":"dazzling","780":"berserk","781":"steelworker","782":"bulletproof","783":"bulletproof","784":"bulletproof","785":"electric-surge","786":"psychic-surge","787":"telepathy","788":"misty-surge","789":"unaware","790":"sturdy","791":"full-metal-body","792":"shadow-shield","793":"beast-boost","794":"beast-boost","795":"beast-boost","796":"beast-boost","797":"beast-boost","798":"beast-boost","799":"beast-boost","800":"prism-armor","801":"soul-heart","802":"technician","803":"beast-boost","804":"beast-boost","805":"beast-boost","806":"beast-boost","807":"volt-absorb","808":"magnet-pull","809":"iron-fist","810":"overgrow","811":"overgrow","812":"overgrow","813":"libero","814":"libero","815":"libero","816":"sniper","817":"sniper","818":"sniper","819":"cheek-pouch","820":"cheek-pouch","821":"keen-eye","822":"keen-eye","823":"mirror-armor","824":"compound-eyes","825":"compound-eyes","826":"swarm","827":"unburden","828":"unburden","829":"cotton-down","830":"cotton-down","831":"fluffy","832":"fluffy","833":"strong-jaw","834":"strong-jaw","835":"ball-fetch","836":"strong-jaw","840":"ripen","841":"ripen","842":"ripen","843":"sand-spit","844":"sand-spit","845":"gulp-missile","846":"propeller-tail","847":"propeller-tail","848":"static","849":"punk-rock","850":"flash-fire","851":"flash-fire","852":"technician","853":"technician","854":"cursed-body","855":"cursed-body","856":"magic-bounce","857":"magic-bounce","858":"magic-bounce","859":"prankster","860":"prankster","861":"prankster","862":"reckless","863":"tough-claws","864":"perish-body","865":"steadfast","867":"wandering-spirit","868":"sweet-veil","869":"sweet-veil","871":"electric-surge","872":"ice-scales","873":"ice-scales","874":"power-spot","875":"ice-face","876":"psychic-surge","877":"hunger-switch","879":"sheer-force","880":"volt-absorb","881":"volt-absorb","882":"water-absorb","883":"water-absorb","884":"stalwart","885":"cursed-body","886":"cursed-body","887":"cursed-body","888":"intrepid-sword","889":"dauntless-shield","890":"pressure","891":"inner-focus","892":"unseen-fist","894":"transistor","895":"dragons-maw","896":"chilling-neigh","897":"grim-neigh","898":"unnerve","899":"intimidate","900":"sharpness","901":"guts","902":"swift-swim","903":"pressure","904":"poison-point","905":"contrary","906":"protean","907":"protean","908":"protean","909":"unaware","910":"unaware","911":"unaware","912":"moxie","913":"moxie","914":"moxie","915":"thick-fat","916":"lingering-aroma","917":"insomnia","918":"insomnia","919":"tinted-lens","920":"tinted-lens","921":"static","922":"volt-absorb","923":"volt-absorb","924":"pickup","925":"technician","926":"own-tempo","927":"well-baked-body","928":"harvest","930":"seed-sower","932":"purifying-salt","933":"purifying-salt","934":"purifying-salt","935":"flash-fire","936":"flash-fire","937":"flash-fire","938":"static","939":"electromorphosis","940":"wind-power","941":"wind-power","946":"wind-rider","948":"mycelium-might","951":"chlorophyll","952":"chlorophyll","953":"compound-eyes","955":"speed-boost","957":"mold-breaker","958":"mold-breaker","959":"mold-breaker","960":"rattled","961":"rattled","963":"water-veil","964":"zero-to-hero","965":"slow-start","966":"filter","967":"regenerator","968":"earth-eater","969":"toxic-debris","970":"toxic-debris","971":"pickup","972":"sand-rush","974":"thick-fat","975":"thick-fat","976":"sharpness","977":"unaware","978":"commander","979":"defiant","980":"poison-point","981":"cud-chew","982":"serene-grace","983":"supreme-overlord","984":"protosynthesis","985":"protosynthesis","987":"protosynthesis","988":"protosynthesis","989":"protosynthesis","991":"quark-drive","992":"quark-drive","994":"quark-drive","995":"quark-drive","996":"thermal-exchange","997":"thermal-exchange","998":"thermal-exchange","1000":"good-as-gold","1004":"beads-of-ruin","1005":"protosynthesis","1006":"quark-drive","1007":"orichalcum-pulse","1009":"protosynthesis","1010":"quark-drive","1011":"supersweet-syrup","1012":"hospitality","1013":"hospitality","1015":"toxic-chain","1016":"toxic-chain","1017":"defiant","1018":"stamina","1019":"supersweet-syrup","1024":"tera-shift","1025":"poison-puppeteer"};
G.abilityOf = dex => G.ABILITIES[G.MON_ABILITY[dex]] ? Object.assign({ id: G.MON_ABILITY[dex] }, G.ABILITIES[G.MON_ABILITY[dex]]) : null;

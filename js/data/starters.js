/* ============ starters.js — starting partners and personality test ============
 * As in Mystery Dungeon: a few questions decide your personality, and your
 * personality decides your partner. You can decline it and choose another.
 *
 * Stats come from G.DEX; only the traits and the starting move go here.
 */
G.STARTERS = [
  { dex: 1,   start: 'vine-whip',     traits: ['loyal', 'patient'] },
  { dex: 4,   start: 'ember',         traits: ['brave', 'impulsive'] },
  { dex: 7,   start: 'water-gun',     traits: ['cautious', 'loyal'] },
  { dex: 152, start: 'vine-whip',     traits: ['sweet', 'patient'] },
  { dex: 155, start: 'ember',         traits: ['shy', 'impulsive'] },
  { dex: 158, start: 'water-gun',     traits: ['mischievous', 'brave'] },
  { dex: 252, start: 'razor-leaf',    traits: ['calm', 'cunning'] },
  { dex: 255, start: 'ember',         traits: ['cheerful', 'brave'] },
  { dex: 258, start: 'water-gun',     traits: ['tenacious', 'loyal'] },
  { dex: 387, start: 'vine-whip',     traits: ['patient', 'tenacious'] },
  { dex: 390, start: 'ember',         traits: ['mischievous', 'cheerful'] },
  { dex: 393, start: 'bubble',        traits: ['proud', 'cautious'] },
  { dex: 495, start: 'razor-leaf',    traits: ['proud', 'cunning'] },
  { dex: 498, start: 'ember',         traits: ['tenacious', 'cheerful'] },
  { dex: 501, start: 'water-gun',     traits: ['brave', 'mischievous'] },
  { dex: 650, start: 'vine-whip',     traits: ['mischievous', 'tenacious'] },
  { dex: 653, start: 'ember',         traits: ['cunning', 'calm'] },
  { dex: 656, start: 'water-gun',     traits: ['calm', 'cunning'] },
  { dex: 722, start: 'razor-leaf',    traits: ['calm', 'sweet'] },
  { dex: 725, start: 'ember',         traits: ['solitary', 'proud'] },
  { dex: 728, start: 'bubble',        traits: ['cheerful', 'sweet'] },
  { dex: 810, start: 'vine-whip',     traits: ['cheerful', 'mischievous'] },
  { dex: 813, start: 'ember',         traits: ['impulsive', 'cheerful'] },
  { dex: 816, start: 'water-gun',     traits: ['shy', 'cunning'] },
  { dex: 906, start: 'razor-leaf',    traits: ['solitary', 'cunning'] },
  { dex: 909, start: 'ember',         traits: ['relaxed', 'tenacious'] },
  { dex: 912, start: 'water-gun',     traits: ['proud', 'cautious'] },
  { dex: 54,  start: 'confusion',     traits: ['chaotic', 'shy'] },
  { dex: 79,  start: 'confusion',     traits: ['relaxed', 'patient'] }
];

G.STARTER_BY = {};
for (const s of G.STARTERS) G.STARTER_BY[s.dex] = s;

/** Starting move of any Pokémon (starter or from the gacha). */
G.startMoveOf = dex => {
  const s = G.STARTER_BY[dex];
  return s ? s.start : G.Moves.startFor(G.DEX_BY[dex]);
};

/** Short description of each trait, for the result screen. */
G.TRAIT_TEXT = {
  brave:  'You don\'t think twice when someone needs help.',
  impulsive: 'You act first and think later. Sometimes it works!',
  cautious:  'You measure every step before taking it.',
  loyal:      'Your friends know they can always count on you.',
  patient:  'You know how to wait for the right moment.',
  sweet:     'Your kindness calms everyone around you.',
  shy:    'It\'s hard for you to take the first step, but you feel deeply.',
  mischievous:  'You always have a joke ready.',
  calm:    'You keep calm when things get complicated.',
  cunning:    'You see solutions where others see problems.',
  cheerful:    'You spread energy wherever you go.',
  tenacious:     'Giving up isn\'t in your plans.',
  proud: 'You push yourself to be the best, and you almost always are.',
  solitary: 'You do your own thing and don\'t care.',
  relaxed: 'Nothing fazes you. Nothing.',
  chaotic:   'Not even you know what you\'ll do next.'
};

G.PERSONALITY_TEST = [
  { q: 'There\'s a fight in the middle of town! What do you do?', a: [
    { t: 'I jump in to help without thinking.',          p: { brave: 2, impulsive: 1 } },
    { t: 'I look for someone who can stop it.',       p: { cautious: 2, loyal: 1 } },
    { t: 'I watch everything from afar.',             p: { calm: 1, shy: 1, solitary: 1 } },
    { t: 'I laugh and cheer both of them on.',                p: { mischievous: 2, chaotic: 1 } } ] },
  { q: 'You find a wallet on the ground.', a: [
    { t: 'I take it to the police right away.',         p: { loyal: 2, sweet: 1 } },
    { t: 'I look for its owner even if it takes hours.',     p: { tenacious: 2, patient: 1 } },
    { t: 'First I check what\'s inside…',            p: { cunning: 2, mischievous: 1 } },
    { t: 'I don\'t even touch it, just in case.',               p: { cautious: 1, shy: 2 } } ] },
  { q: 'Your ideal day off is…', a: [
    { t: 'An adventure with no plan at all.',            p: { impulsive: 2, cheerful: 1 } },
    { t: 'Reading, thinking, being calm.',           p: { calm: 2, relaxed: 1 } },
    { t: 'Hanging out with all my friends.',             p: { cheerful: 2, loyal: 1 } },
    { t: 'Training to get better.',                 p: { tenacious: 2, proud: 1 } } ] },
  { q: 'You have an important exam tomorrow.', a: [
    { t: 'I study until late at night.',                p: { tenacious: 2, cautious: 1 } },
    { t: 'I review just enough: I trust myself.',           p: { proud: 2, calm: 1 } },
    { t: 'I get really stressed.',                     p: { shy: 2, sweet: 1 } },
    { t: 'Exam? I\'ll see tomorrow.',                 p: { chaotic: 2, relaxed: 1 } } ] },
  { q: 'What do your friends say about you?', a: [
    { t: 'That I\'m the funniest one in the group.',      p: { cheerful: 2, mischievous: 1 } },
    { t: 'That they can always count on me.',       p: { loyal: 2, sweet: 1 } },
    { t: 'That I\'m a bit mysterious.',              p: { solitary: 2, cunning: 1 } },
    { t: 'That I never give up.',                   p: { brave: 1, tenacious: 2 } } ] },
  { q: 'The path splits: one dark and short, the other long and sunny.', a: [
    { t: 'The dark one, more excitement!',                 p: { brave: 2, impulsive: 1 } },
    { t: 'The long one, no rush.',                     p: { patient: 2, cautious: 1 } },
    { t: 'I sit down to think it over.',            p: { relaxed: 2, calm: 1 } },
    { t: 'Neither: I make a new shortcut.',            p: { cunning: 2, chaotic: 1 } } ] },
  { q: 'Someone mocks you in front of everyone.', a: [
    { t: 'I answer back on the spot.',                  p: { proud: 2, impulsive: 1 } },
    { t: 'I ignore them completely.',                  p: { calm: 2, solitary: 1 } },
    { t: 'It hurts, even if I don\'t say it.',            p: { shy: 2, sweet: 1 } },
    { t: 'I hit back with a better joke.',             p: { mischievous: 2, cunning: 1 } } ] },
  { q: 'What matters most to you?', a: [
    { t: 'Friendship.',                              p: { loyal: 2, cheerful: 1 } },
    { t: 'Freedom.',                             p: { solitary: 2, impulsive: 1 } },
    { t: 'Calm.',                                p: { relaxed: 2, patient: 1 } },
    { t: 'Being the best.',                            p: { proud: 2, tenacious: 1 } } ] }
];

/** Trait scores -> { trait, dex } with the partner that fits best. */
G.personalityResult = scores => {
  const trait = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  let best = [], bestScore = -1;
  for (const s of G.STARTERS) {
    // The main trait counts double.
    const v = (scores[s.traits[0]] || 0) * 2 + (scores[s.traits[1]] || 0);
    if (v > bestScore) { bestScore = v; best = [s]; }
    else if (v === bestScore) best.push(s);
  }
  return { trait, dex: G.U.pick(best).dex };
};

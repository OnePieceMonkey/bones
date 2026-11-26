/**
 * e2e-only case with 4 suspects of 5 statements each (requirement 21.3), the worst layout case.
 * It is valid under the Case_Schema and fair: under every version only `widow` can be convicted.
 * It is not a Recorded_Case and never ships: samples.ts adds it only when CASE_FILES_E2E=1.
 */
const proposedFields = {
  title: "The Four Lamps",
  setting: "A lamp-lit estate office where the ledger was burned and the clerk was found dead.",
  victim: { name: "Hugo Brandt" },
  crime: { placeId: "office", startMin: 1260, endMin: 1320, weaponItemId: "letter-opener" },
  places: [
    { id: "office", name: "the office" },
    { id: "cellar", name: "the cellar" },
    { id: "garden", name: "the garden" },
    { id: "hall", name: "the hall" },
  ],
  items: [
    { id: "letter-opener", name: "a brass letter opener" },
    { id: "ledger", name: "a burned ledger" },
  ],
  suspects: [
    {
      id: "widow",
      name: "the widow",
      statements: [
        { id: "st-widow-1", kind: "location", text: "I was in the hall all evening.", placeId: "hall", startMin: 1250, endMin: 1340 },
        { id: "st-widow-2", kind: "location", text: "I walked in the garden before supper.", placeId: "garden", startMin: 1080, endMin: 1140 },
        { id: "st-widow-3", kind: "possession", text: "I never touched the ledger.", itemId: "ledger", held: false },
        { id: "st-widow-4", kind: "sighting", text: "I saw the porter in the cellar before supper.", seenSuspectId: "porter", placeId: "cellar", startMin: 1100, endMin: 1130 },
        { id: "st-widow-5", kind: "location", text: "I rested in the hall after dinner.", placeId: "hall", startMin: 1160, endMin: 1200 },
      ],
    },
    {
      id: "porter",
      name: "the porter",
      statements: [
        { id: "st-porter-1", kind: "location", text: "I was in the cellar at the time.", placeId: "cellar", startMin: 1260, endMin: 1320 },
        { id: "st-porter-2", kind: "location", text: "I swept the hall at dusk.", placeId: "hall", startMin: 1100, endMin: 1150 },
        { id: "st-porter-3", kind: "possession", text: "I never held the letter opener.", itemId: "letter-opener", held: false },
        { id: "st-porter-4", kind: "sighting", text: "I saw the cook in the garden at dusk.", seenSuspectId: "cook", placeId: "garden", startMin: 1100, endMin: 1140 },
        { id: "st-porter-5", kind: "location", text: "I had tea in the cellar later.", placeId: "cellar", startMin: 1340, endMin: 1380 },
      ],
    },
    {
      id: "cook",
      name: "the cook",
      statements: [
        { id: "st-cook-1", kind: "location", text: "I was in the garden picking herbs.", placeId: "garden", startMin: 1250, endMin: 1330 },
        { id: "st-cook-2", kind: "location", text: "I cooked in the hall kitchen at noon.", placeId: "hall", startMin: 700, endMin: 760 },
        { id: "st-cook-3", kind: "possession", text: "I never held the ledger.", itemId: "ledger", held: false },
        { id: "st-cook-4", kind: "sighting", text: "I saw the widow in the hall at supper.", seenSuspectId: "widow", placeId: "hall", startMin: 1160, endMin: 1200 },
        { id: "st-cook-5", kind: "location", text: "I fed the hens in the garden at dawn.", placeId: "garden", startMin: 360, endMin: 400 },
      ],
    },
    {
      id: "heir",
      name: "the heir",
      statements: [
        { id: "st-heir-1", kind: "location", text: "I was in the hall at the time.", placeId: "hall", startMin: 1250, endMin: 1330 },
        { id: "st-heir-2", kind: "location", text: "I read in the office in the morning.", placeId: "office", startMin: 540, endMin: 600 },
        { id: "st-heir-3", kind: "possession", text: "I never held the letter opener.", itemId: "letter-opener", held: false },
        { id: "st-heir-4", kind: "sighting", text: "I saw the cook in the garden at dawn.", seenSuspectId: "cook", placeId: "garden", startMin: 370, endMin: 390 },
        { id: "st-heir-5", kind: "location", text: "I smoked in the garden at noon.", placeId: "garden", startMin: 720, endMin: 760 },
      ],
    },
  ],
  clues: [
    { id: "cl-1", kind: "holding", text: "The letter opener was found wiped clean in the widow's bag.", reliability: "firm", suspectId: "widow", itemId: "letter-opener" },
    { id: "cl-2", kind: "presence", text: "A clerk firmly places the widow in the office at the time of the murder.", reliability: "firm", suspectId: "widow", placeId: "office", startMin: 1270, endMin: 1300 },
    { id: "cl-3", kind: "motive", text: "The widow was cut out of the will that week.", reliability: "firm", suspectId: "widow" },
    { id: "cl-4", kind: "holding", text: "The porter once borrowed the letter opener.", reliability: "weak", suspectId: "porter", itemId: "letter-opener" },
    { id: "cl-5", kind: "motive", text: "The porter was owed three months of wages.", reliability: "firm", suspectId: "porter" },
    { id: "cl-6", kind: "presence", text: "The porter is firmly placed in the cellar at the time of the murder.", reliability: "firm", suspectId: "porter", placeId: "cellar", startMin: 1260, endMin: 1320 },
    { id: "cl-7", kind: "motive", text: "The cook argued with Hugo about the pantry key.", reliability: "weak", suspectId: "cook" },
    { id: "cl-8", kind: "presence", text: "The cook is firmly placed in the garden at the time of the murder.", reliability: "firm", suspectId: "cook", placeId: "garden", startMin: 1260, endMin: 1320 },
    { id: "cl-9", kind: "motive", text: "The heir stood to inherit the estate.", reliability: "firm", suspectId: "heir" },
    { id: "cl-10", kind: "presence", text: "The heir is firmly placed in the hall at the time of the murder.", reliability: "firm", suspectId: "heir", placeId: "hall", startMin: 1260, endMin: 1320 },
  ],
};
function buildConfidence(): Record<string, number> {
  const out: Record<string, number> = { title: 0.97, setting: 0.93, victim: 0.96, crime: 0.91 };
  proposedFields.suspects.forEach((s, i) => {
    s.statements.forEach((_st, j) => {
      out[`suspects.${i}.statements.${j}`] = 0.9;
    });
  });
  proposedFields.clues.forEach((_c, k) => {
    out[`clues.${k}`] = 0.88;
  });
  return out;
}
const confidence = buildConfidence();
export const fourSuspectsEntry = {
  id: "four-suspects",
  title: "The Four Lamps",
  origin: "fixture",
  extraction: {
    proposedFields: { ...proposedFields, confidence },
    confidence,
    sources: {},
    rawModelOutput: JSON.stringify({ ...proposedFields, confidence }),
  },
} as const;

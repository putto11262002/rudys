/**
 * Product catalog - static reference data for inventory management
 * Source: products_en.csv
 */

export type Product = {
  articleNumber: string;
  description: string;
  minQty: number;
  maxQty: number;
};

export const PRODUCT_CATALOG: Product[] = [
  { articleNumber: "ART.100002", description: "AD mattress Obese Arise LAL 1000 EX. L200/220 x W90/106/122 cm", minQty: 1, maxQty: 5 },
  { articleNumber: "ART.100003", description: "AD mattress Arise LAL 85. L203 x W85 x H25 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100005", description: "AD Foam mattress Obese Barimatt. L200/220 x W90/106/122 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100010", description: "AD mattress ProMatt. L200 x W85 x H18 cm", minQty: 10, maxQty: 20 },
  { articleNumber: "ART.100011", description: "AD mattress ProMatt. L200 x W88 x H18 cm", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100013", description: "AD mattress ProMatt. L207 x W85 x H18 cm", minQty: 9, maxQty: 18 },
  { articleNumber: "ART.100017", description: "AD mattress TS506 with detachable sections. L200 x W85 x H14 cm", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100022", description: "AD TS506 pump", minQty: 10, maxQty: 20 },
  { articleNumber: "ART.100023", description: "AD pump Obese Arise LAL 1000 EX pump", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100024", description: "AD mattress TS508 High Cell. L200 x W85 x H20 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100031", description: "AD mattress TS506. L200 x W85 x H14 cm", minQty: 4, maxQty: 8 },
  { articleNumber: "ART.100032", description: "AD seat cushion blocks. L45 x W45 x H8 cm", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100033", description: "AD seat cushion Mosaic. L43 x W43 x H10 cm", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100035", description: "AD seat cushion Mosaic. L41 x D41 x H5 cm", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100036", description: "AD seat cushion Mosaic. L46 x D46 x H5 cm", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100037", description: "AD seat cushion Ola Alternating incl. pump. L40 x D45 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100045", description: "AD seat cushion memory foam incl. PU cover. L43 x D43 x H5 cm", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100046", description: "AD seat cushion memory foam incl. PU cover. L43 x D43 x H7 cm", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100055", description: "Bed table classic", minQty: 7, maxQty: 10 },
  { articleNumber: "ART.100062", description: "Bed cradle/blanket support", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.100071", description: "Shower stool height adjustable 43 - 58 cm", minQty: 10, maxQty: 15 },
  { articleNumber: "ART.100073", description: "Shower chair height adjustable 43 - 64 cm", minQty: 4, maxQty: 6 },
  { articleNumber: "ART.100075", description: "Shower/toilet chair Badoflex 3010 mobile", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100076", description: "Shower/toilet chair Obese. 4 wheels braked", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100078", description: "Turntable/Transfer disc", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100082", description: "Sliding sheet Large. L150 x W82 cm", minQty: 10, maxQty: 20 },
  { articleNumber: "ART.100084", description: "Sliding sheet Medium. L90 x W65 cm", minQty: 10, maxQty: 20 },
  { articleNumber: "ART.100091", description: "H/L bed Allegra 20.80. hospital version. L200 x W90 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100100", description: "H/L bed Bari 10A Obese", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100142", description: "H/L bed Allegra 20.80 incl. side rails. L200 x W890 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100158", description: "IV pole mobile incl. 4 hooks. Stainless steel", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100164", description: "Walking bike City. max. L113 x max. W55 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100174", description: "Bedpan incl. lid", minQty: 5, maxQty: 10 },
  { articleNumber: "ART.100205", description: "Wheelchair Quicky M6. seat W65 x D55 cm. black", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100210", description: "Sit-to-stand aid Switch", minQty: 4, maxQty: 7 },
  { articleNumber: "ART.100230", description: "Toilet chair non-mobile with fixed legs", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.100236", description: "Transfer/sliding board", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100237", description: "Transfer aid Turner Pro O-grip", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100239", description: "Triple chair electric extra low. low back. L35 x W30 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100240", description: "Triple chair electric. low back L35 x W30 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.100241", description: "Triple chair mechanical extra low. high back", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100248", description: "Air cushion ring diameter 45 cm. incl. pump", minQty: 2, maxQty: 4 },
  { articleNumber: "ART.100622", description: "Bed rail/bed aid Frida incl. single handle and loop", minQty: 3, maxQty: 5 },
  { articleNumber: "ART.100624", description: "Leg rest Comfort left for manual wheelchair", minQty: 4, maxQty: 8 },
  { articleNumber: "ART.100705", description: "Guides for Medial H/L bed", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100710", description: "Hand control for Medial/Allegra", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100949", description: "Motor backrest WO Transformer for Haydn", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.100951", description: "Hand control for Haydn H/L bed", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.100957", description: "Extension 10 cm per piece for Haydn H/L bed", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.101124", description: "Backrest with breathable fabric", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.101127", description: "Yoke 2-point for Advance", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.101129", description: "Battery Linak", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.101130", description: "Yoke 4-point electric tiltable for Presence/Stature", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.104310", description: "AD seat cushion K1 F37 H1 R1 Opd1 Ov12, L50 x W50 x H10 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.104327", description: "Overbed pole (thicker tube) for H/L bed Haydn", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.104623", description: "AD mattress Arise LAL, L200 x W90 x H15 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.104635", description: "Draw sheet SatinSheet 4D Midi incl handles, L140 x W200 cm", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.104662", description: "Clamp for IV pole 4 hooks, Stainless steel, Allegra", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.105089", description: "Filler piece F9 H2 R1 Opd1 Ov9, L20 x W88 x H15 cm", minQty: 3, maxQty: 6 },
  { articleNumber: "ART.105132", description: "Motor head and foot end for Haydn", minQty: 2, maxQty: 3 },
  { articleNumber: "ART.105713", description: "Air Seat Cushion 9 pcs cell incl. pump, L45.72 x D45.72 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "ART.106885", description: "Bed rail guides Ecofit", minQty: 3, maxQty: 5 },
  { articleNumber: "GHA.000001", description: "H/L bed incl. overbed pole, excl. side rails L200 x W90 cm", minQty: 7, maxQty: 10 },
  { articleNumber: "GHA.000007", description: "Manual wheelchair, Seat Width 46/50 cm", minQty: 2, maxQty: 4 },
  { articleNumber: "GHA.000008", description: "Toilet raiser, H10-11 cm", minQty: 5, maxQty: 8 },
  { articleNumber: "GHA.000009", description: "Toilet raiser, H5-6 cm", minQty: 2, maxQty: 4 },
  { articleNumber: "GHA.000010", description: "H/L bed MMO 3000 assembled L200 x W90 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000012", description: "H/L bed MMO 5000 assembled L200 x W90 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000014", description: "H/L bed MMO 8000 assembled L200 x W120 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000015", description: "Passive lift up to 227kg, 4-point yoke (sling with clips)", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000016", description: "Passive lift up to 155kg, 2-point yoke (sling with loops)", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000017", description: "Active lift up to 155kg, (sling with loops)", minQty: 3, maxQty: 5 },
  { articleNumber: "GHA.000023", description: "Sit-to-stand transfer aid", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000025", description: "Parkinson walker", minQty: 2, maxQty: 4 },
  { articleNumber: "GHA.000028", description: "AD Foam mattress L200 x W90 cm", minQty: 5, maxQty: 10 },
  { articleNumber: "GHA.000032", description: "Fall mat L180 x W70 x H2.5 cm", minQty: 3, maxQty: 6 },
  { articleNumber: "GHA.000035", description: "Active sling with loops, Small", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000036", description: "Active sling with loops, Medium", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000037", description: "Active sling with loops, Large", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000038", description: "Active sling with loops, XLarge", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000039", description: "Passive amputation sling with loops, Small", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000040", description: "Passive amputation sling with loops, Medium", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000041", description: "Passive amputation sling with loops, Large", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000042", description: "Passive toilet sling with loops, Small", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000043", description: "Passive toilet sling with loops, Medium", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000044", description: "Passive toilet sling with loops, Large", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000045", description: "Passive toilet sling with loops, XLarge", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000046", description: "Passive standard sling with loops, XSmall", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000047", description: "Passive standard sling with loops, Small", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000048", description: "Passive standard sling with loops, Medium", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000049", description: "Passive standard sling with loops, Large", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000050", description: "Passive standard sling with loops, XLarge", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000051", description: "Passive standard sling with loops, XXLarge", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000052", description: "Obesity sling for Calibre, XLarge", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000053", description: "Obesity sling for Calibre, XXLarge", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000054", description: "Amputation sling with clips, XSmall", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000055", description: "Amputation sling with clips, Small", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000056", description: "Amputation sling with clips, Medium", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000057", description: "Amputation sling with clips, Large", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000058", description: "Amputation sling with clips, XLarge", minQty: 1, maxQty: 1 },
  { articleNumber: "GHA.000060", description: "Toilet sling with clips, Small", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000061", description: "Toilet sling with clips, Medium", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000062", description: "Toilet sling with clips, Large", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000063", description: "Passive standard sling with clips, XSmall", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000064", description: "Passive standard sling with clips, Small", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000065", description: "Passive standard sling with clips, Medium", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000066", description: "Passive standard sling with clips, Large", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000067", description: "Passive standard sling with clips, XLarge", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000068", description: "Passive standard sling with clips, XXLarge", minQty: 3, maxQty: 5 },
  { articleNumber: "GHA.000070", description: "AD comfort Plus mattress, 8/7 195-202/85-90 logo Joerns", minQty: 2, maxQty: 3 },
  { articleNumber: "GHA.000071", description: "Triple chair mechanical, low back, 418, H35 x W30 cm", minQty: 1, maxQty: 2 },
  { articleNumber: "GHA.000072", description: "H/L bed EXTRA low L200 x W90 x H25-65cm", minQty: 2, maxQty: 3 },
];

/**
 * Lookup map for O(1) product access by article number
 */
export const PRODUCT_BY_CODE = new Map<string, Product>(
  PRODUCT_CATALOG.map((p) => [p.articleNumber, p])
);

/**
 * Get a product by article number
 */
export function getProduct(articleNumber: string): Product | undefined {
  return PRODUCT_BY_CODE.get(articleNumber);
}

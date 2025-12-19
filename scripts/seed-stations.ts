/**
 * Seed script for station captures
 *
 * Creates valid station data for a session based on its computed demand.
 * Stations are created with on-hand quantities BELOW max to require ordering.
 *
 * Usage:
 *   bun run scripts/seed-stations.ts <sessionId>
 *
 * Example:
 *   bun run scripts/seed-stations.ts 123e4567-e89b-12d3-a456-426614174000
 */

import { db } from "@/lib/db";
import { stationCaptures, sessions, employeeCaptureGroups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeDemandFromGroups } from "@/lib/workflow/compute";

async function seedStations(sessionId: string) {
  console.log(`\nSeeding stations for session: ${sessionId}\n`);

  // Verify session exists
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    console.error("Session not found");
    process.exit(1);
  }

  // Get groups with extraction results to compute demand
  const groups = await db.query.employeeCaptureGroups.findMany({
    where: eq(employeeCaptureGroups.sessionId, sessionId),
    with: {
      extractionResult: true,
    },
  });

  const demandItems = computeDemandFromGroups(groups);

  if (demandItems.length === 0) {
    console.error("No demand items found for this session.");
    console.error("Please extract loading lists first before seeding stations.");
    process.exit(1);
  }

  console.log(`Found ${demandItems.length} products in demand:\n`);

  // Delete existing stations for this session
  await db.delete(stationCaptures).where(eq(stationCaptures.sessionId, sessionId));
  console.log("Cleared existing stations\n");

  // Create stations for each demanded product
  const stations = [];
  for (const item of demandItems) {
    // Generate min/max values
    const minQty = Math.floor(Math.random() * 3) + 2; // 2-4
    const maxQty = minQty + Math.floor(Math.random() * 5) + 3; // min + 3-7

    // Generate on-hand qty that requires ordering (below max, sometimes below min)
    // This ensures ordering is needed
    const onHandQty = Math.floor(Math.random() * (maxQty - 1)); // 0 to max-1

    const station = {
      sessionId,
      status: "valid" as const,
      productCode: item.productCode,
      minQty,
      maxQty,
      onHandQty,
      // Use placeholder URLs (these won't be real images but the data is valid)
      signBlobUrl: `https://placeholder.com/stations/${item.productCode}/sign.jpg`,
      signWidth: 800,
      signHeight: 1200,
      signUploadedAt: new Date().toISOString(),
      stockBlobUrl: `https://placeholder.com/stations/${item.productCode}/stock.jpg`,
      stockWidth: 800,
      stockHeight: 1200,
      stockUploadedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString(),
    };

    stations.push(station);

    const needsOrder = onHandQty < maxQty;
    const belowMin = onHandQty < minQty;
    const orderQty = maxQty - onHandQty;

    console.log(
      `  ${item.productCode}: on-hand=${onHandQty}, min=${minQty}, max=${maxQty}` +
        (belowMin ? " ⚠️ BELOW MIN" : "") +
        (needsOrder ? ` → order ${orderQty}` : " ✓ stocked")
    );
  }

  // Insert all stations
  await db.insert(stationCaptures).values(stations);

  console.log(`\n✓ Created ${stations.length} stations`);

  // Summary
  const needsOrdering = stations.filter((s) => s.onHandQty < s.maxQty).length;
  const belowMin = stations.filter((s) => s.onHandQty < s.minQty).length;

  console.log(`\nSummary:`);
  console.log(`  - Total stations: ${stations.length}`);
  console.log(`  - Needs ordering: ${needsOrdering}`);
  console.log(`  - Below minimum: ${belowMin}`);
}

// Get session ID from command line args
const sessionId = process.argv[2];

if (!sessionId) {
  console.error("Usage: bun run scripts/seed-stations.ts <sessionId>");
  process.exit(1);
}

// Validate UUID format
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(sessionId)) {
  console.error("Invalid session ID format. Expected UUID.");
  process.exit(1);
}

seedStations(sessionId)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

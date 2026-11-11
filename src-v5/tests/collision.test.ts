import assert from "node:assert/strict";
import test from "node:test";
import { rooms, type RoomId } from "../config/rooms";
import { detectCollisions, roomSpans } from "../lib/room-layout";

const sizes: [string, number, number][] = [
  ["small", 12, 10],
  ["default", 18, 14],
  ["large", 24, 20],
];

for (const room of rooms) {
  for (const [label, lengthFt, widthFt] of sizes) {
    test(`${room.id} ${label} ${lengthFt}x${widthFt} has no layout collisions`, () => {
      const { spanX, spanZ } = roomSpans(room.id as RoomId, lengthFt, widthFt);
      const hits = detectCollisions(room.id as RoomId, spanX, spanZ);
      assert.deepEqual(hits, [], hits.map((h) => `${h.a} vs ${h.b}: ${h.reason}`).join("\n"));
    });
  }
}

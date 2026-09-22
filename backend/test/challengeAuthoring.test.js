import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import BattleRoom from '../src/models/BattleRoom.js'; // Adjust path based on your project

test('simulates concurrent codingBehavior updates to replicate the version lock error', async () => {
  // 1. Setup a dummy document in your test database
  const battleRoom = new BattleRoom({
    status: 'ACTIVE',
    codingBehavior: { totalLinesWritten: 10, totalEdits: 1 }
  });
  await battleRoom.save();

  // 2. Fetch the same document twice (simulating Request 1 and Request 2)
  const docInstance1 = await BattleRoom.findById(battleRoom._id);
  const docInstance2 = await BattleRoom.findById(battleRoom._id);

  // 3. Make changes to both independent instances in-memory
  docInstance1.codingBehavior.totalLinesWritten = 15;
  docInstance2.codingBehavior.totalLinesWritten = 25;

  // 4. Save Instance 1 (This sets __v = 1 in the database)
  await docInstance1.save();

  // 5. Try saving Instance 2 (This expects __v = 0, but database is now 1)
  await assert.rejects(
    async () => {
      await docInstance2.save();
    },
    (err) => {
      // Confirms the exact VersionError trace you encountered
      return err.name === 'VersionError' && err.message.includes('No matching document found for id');
    }
  );

  // Cleanup test entry
  await BattleRoom.deleteOne({ _id: battleRoom._id });
});

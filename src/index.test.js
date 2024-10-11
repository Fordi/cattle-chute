import assert from "node:assert";
import { describe, it } from "node:test";
import CattleChute from "./index.js";

const delay = (t) => new Promise((resolve) => setTimeout(resolve, t));

const mockJob = (index, cb) => {
  const timeout = 10 + index * 5;
  return async () => {
    await delay(timeout);
    await cb?.();
  }
};

describe("CattleChute", () => {
  it("Manages a queue of jobs", async () => {
    const log = [];
    const chute = new CattleChute({ concurrency: 5, report: (queued, running) => log.push([queued, running]) });
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(chute.add(mockJob(i)));
    }
    promises.push(chute.flush());
    await Promise.all(promises);
    await chute.flush();
    assert.deepEqual(log, [
      [ 10, 0 ], [ 5, 5 ],
      [ 4, 5 ],  [ 3, 5 ],
      [ 2, 5 ],  [ 1, 5 ],
      [ 0, 5 ],  [ 0, 4 ],
      [ 0, 3 ],  [ 0, 2 ],
      [ 0, 1 ],  [ 0, 0 ]
    ]);
  });

  describe("#map", () => {
    it("is analogous to array#map, but returns a concurrency-limited Promise<Array>", async () => {
      const items = new Array(40).fill(1).map((one, index) => one * index);
      const expected = new Array(40).fill(1).map((one, index) => 2 * index);
      const chute = new CattleChute({ concurrency: 5 });
      let maxRunning = 0;
      let running = 0;
      const results = await chute.map(items, async (item) => {
        running++;
        maxRunning = Math.max(running, maxRunning);
        // "Complete" these in random order
        await delay(10 + Math.random() * 50);
        running--;
        return item * 2;
      });
      assert.deepEqual(results, expected);
      assert.equal(maxRunning, 5);
      assert.equal(running, 0);
    });
  });

  describe("#cancel", () => {
    it("prevents a job from running", async () => {
      const chute = new CattleChute({ concurrency: 5 });
      const log = [];
      const job = async () => {
        console.log('failure');
        log.push('failure');
      };
      const promise = chute.add(job);
      const CANCEL_MESSAGE = "CANCELLED";
      chute.cancel(job, CANCEL_MESSAGE );
      try {
        await promise;
      } catch (e) {
        assert.equal(e.message, CANCEL_MESSAGE);
      }
      await chute.flush();
      assert.deepEqual(log, []);
    });
  });
});
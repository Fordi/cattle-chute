# @fordi-org/cattle-chute

Simple promise concurrency limiter.

### `new CattleChute({ concurrency?: number = 10, report?: (queued: number, running: number) => void } = {})`

Creates a new cattle chute, which you can think of as a concurrency-limited pipeline for async functions.

| name        | description                                                      |
| ----------- | ---------------------------------------------------------------- |
| concurrency | Amount of concurrency to allow in this chute.                    |
| report      | Callback function for reporting changes in the chute's contents. |

### `CattleChute#add(job: () => T | Promise<T>): Promise<T>`

Add a job to the chute. The job is added to a queue, but not executed immediately, instead executing once there's
space open in the chute. Returns a promise that resolves/rejects in tandem with the job's resolution.

| name | description                                                                          |
| ---- | ------------------------------------------------------------------------------------ |
| job  | The job to run. This should create and return a promise. AsyncFunctions work as well |

### `CattleChute#map(Iterable<T>: items, processor: (item: T, index: number, items: Iterable<T>) => Promise<Array<T>>)`

Map an array, array-like, or other iterable of items into ordered jobs, and return a promise of their results.

| name      | description                                                                           |
| --------- | ------------------------------------------------------------------------------------- |
| items     | An array or iterable                                                                  |
| processor | An array comprehension function (like with Array#map) that returns a value or promise |

### `CattleChute#cancel(job: () => T, reason: string = "Cancelled") => boolean`

Attempt to cancel a job. If the job has not yet been started, this pulls it out of the queue and returns true. If it
has been started, this returns false.

If the job is successfully cancelled, the promise returned from `#add` will reject with a `new Error(reason)`.

| name   | description                      |
| ------ | -------------------------------- |
| job    | The job to cancel                |
| reason | The reason the job was cancelled |

### `CattleChute#flush() => Promise<void>`

Returns a promise that resolves when the chute is empty (there are no queued or running jobs). Despite the name, this
does not actually trigger the chute to start running - it is always running.

## Example of use

This example intakes a JSON file representing an array of URLs. It uses a CattleChute to limit concurrent requests of those URLs to 5 at a time.

```javascript
import { readFile } from "node:fs/promises";
import CattleChute from "@fordi-org/cattle-chute";

const urls = JSON.parse(await readFile("urls.json", "utf-8"));
const chute = new CattleChute({ concurrency: 5 });

const urlTexts = chute.map(urls, (url) => fetch(url).then((r) => r.text()));
```

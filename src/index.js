class CattleChute {
  #running = new Set();
  #queue;
  #promise = undefined;
  #resolve = undefined;
  #reportTimeout = undefined;
  constructor({
    concurrency = 10,
    report,
  }) {
    this.concurrency = concurrency;
    this.#queue = [];
    this.report = report;
    this.#assertPromise();
  }

  #assertPromise() {
    if (!this.#promise || (this.#promise.stale && (this.#queue.length || this.#running.size))) {
      this.#promise = new Promise((resolve) => {
        this.#resolve = () => {
          if (!this.#promise.stale) {
            this.#promise.stale = true;
            resolve();
          }
        };
      });
    }
    return this;
  }

  #scheduleReport() {
    if (this.#reportTimeout === undefined) {
      this.#reportTimeout = setImmediate(() => {
        this.#reportTimeout = undefined;
        this.report?.(this.#queue.length, this.#running.size);
      });
    }
  }

  #dequeue() {
    while (this.#running.size < this.concurrency && this.#queue.length) {
      this.#queue.shift().runJob();
    }
    this.#scheduleReport();
  }

  #enqueue(job) {
    let resolve, reject, promise = new Promise((res, rej) => [resolve, reject] = [res, rej]);
    this.#queue.push({
      job,
      runJob: async () => {
        const p = job();
        this.#running.add(promise);
        let result;
        try {
          result = [await p, undefined];
        } catch (e) {
          result = [undefined, e];
        }
        this.#running.delete(promise);
        if (this.#running.size) {
          this.#scheduleReport();
        } else {
          this.report?.(this.#queue.length, this.#running.size);
        }

        if (result[0] === undefined && result[1] !== undefined) {
          reject(result[1]);
        } else {
          resolve(result[0]);
        }
        if (!this.#queue.length && !this.#running.size) {
          this.#assertPromise().#resolve();
        } else if (this.#queue.length) {
          this.#dequeue();
        }
      },
      reject
    });
    this.#scheduleReport();
    promise.cancel = () => this.cancel(job);
    return promise;
  }

  async flush() {
    const rv = this.#assertPromise().#promise;
    if (!this.#queue.length && !this.#running.size) {
      this.#resolve();
    }
    return rv;
  }

  async add(job) {
    const promise = this.#enqueue(job);
    setImmediate(() => this.#dequeue(), 0);
    return promise;
  }

  cancel(job, reason = "Cancelled") {
    const jobIndex = this.#queue.findIndex((item) => job === item.job);
    if (jobIndex === -1) return false;
    this.#queue.splice(jobIndex, 1)[0].reject(new Error(reason));
    return true;
  }

  async map(iterable, promisor) {
    let counter = 0;
    const promises = [];
    for (const item of iterable) {
      promises.push(this.add(() => promisor(item, counter++, iterable)));
    }
    return Promise.all(promises);
  }
}

export default CattleChute;

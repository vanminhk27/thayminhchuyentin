export class SubmissionQueue {
  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
    this.active = 0;
    this.waiting = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.waiting.push({ task, resolve, reject });
      this.runNext();
    });
  }

  get status() {
    return { active: this.active, waiting: this.waiting.length, concurrency: this.concurrency };
  }

  runNext() {
    while (this.active < this.concurrency && this.waiting.length > 0) {
      const item = this.waiting.shift();
      this.active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.runNext();
        });
    }
  }
}

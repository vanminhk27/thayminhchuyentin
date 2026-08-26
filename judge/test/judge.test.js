import test from "node:test";
import assert from "node:assert/strict";
import { judgeSubmission } from "../src/judge.js";
import { getProblem, toPublicProblem } from "../src/problems.js";
import { SubmissionQueue } from "../src/queue.js";

const sumProblem = getProblem("001");

test("không đưa test ẩn ra API công khai", () => {
  const publicProblem = toPublicProblem(sumProblem);
  assert.equal(publicProblem.samples.length, 1);
  assert.equal(Object.hasOwn(publicProblem, "tests"), false);
  assert.equal(JSON.stringify(publicProblem).includes("1000000000000"), false);
});

test("chấm Accepted khi chương trình vượt toàn bộ test", async () => {
  const sourceCode = `#include <iostream>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b; }`;
  const result = await judgeSubmission(sumProblem, sourceCode, "host");
  assert.equal(result.status, "Accepted");
  assert.equal(result.passedTests, sumProblem.tests.length);
});

test("chấm Wrong Answer và không làm lộ test ẩn", async () => {
  const sourceCode = `#include <iostream>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a-b; }`;
  const result = await judgeSubmission(sumProblem, sourceCode, "host");
  assert.equal(result.status, "Wrong Answer");
  assert.equal(result.failedTest.hidden, false);

  const passesSampleOnly = `#include <iostream>
using namespace std;
int main(){ long long a,b; cin>>a>>b; if(a==2 && b==3) cout<<5; else cout<<0; }`;
  const hiddenFailure = await judgeSubmission(sumProblem, passesSampleOnly, "host");
  assert.equal(hiddenFailure.status, "Wrong Answer");
  assert.equal(hiddenFailure.failedTest.hidden, true);
  assert.equal(Object.hasOwn(hiddenFailure.failedTest, "input"), false);
  assert.equal(JSON.stringify(hiddenFailure).includes("-10 7"), false);
});

test("trả về Compilation Error cùng thông báo g++", async () => {
  const result = await judgeSubmission(sumProblem, "int main( {", "host");
  assert.equal(result.status, "Compilation Error");
  assert.match(result.compileOutput, /error:/i);
});

test("hàng đợi không chạy vượt mức đồng thời", async () => {
  const queue = new SubmissionQueue(2);
  let active = 0;
  let highestActive = 0;
  const task = () => queue.add(async () => {
    active += 1;
    highestActive = Math.max(highestActive, active);
    await new Promise((resolve) => setTimeout(resolve, 30));
    active -= 1;
  });
  await Promise.all([task(), task(), task(), task(), task()]);
  assert.equal(highestActive, 2);
  assert.deepEqual(queue.status, { active: 0, waiting: 0, concurrency: 2 });
});

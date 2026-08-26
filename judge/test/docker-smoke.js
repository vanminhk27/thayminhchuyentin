import assert from "node:assert/strict";
import { judgeSubmission } from "../src/judge.js";
import { getProblem } from "../src/problems.js";

const sourceCode = `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}`;

const result = await judgeSubmission(getProblem("001"), sourceCode, "docker");
assert.equal(result.status, "Accepted", JSON.stringify(result));
console.log(`Docker smoke test: ${result.status} (${result.passedTests}/${result.totalTests} test)`);

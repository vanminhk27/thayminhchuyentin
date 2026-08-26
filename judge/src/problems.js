export const problems = [
  {
    id: "001",
    slug: "tong-hai-so",
    title: "Tổng hai số",
    difficulty: "Dễ",
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    statement: "Cho hai số nguyên a và b. Hãy in ra tổng a + b.",
    input: "Một dòng gồm hai số nguyên a và b.",
    output: "In ra giá trị a + b.",
    starterCode: `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}`,
    tests: [
      { input: "2 3\n", expected: "5\n", hidden: false },
      { input: "-10 7\n", expected: "-3\n", hidden: true },
      { input: "0 0\n", expected: "0\n", hidden: true },
      { input: "1000000000000 -999999999999\n", expected: "1\n", hidden: true }
    ]
  },
  {
    id: "002",
    slug: "kiem-tra-so-nguyen-to",
    title: "Kiểm tra số nguyên tố",
    difficulty: "Dễ",
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    statement: "Cho số nguyên n. Hãy kiểm tra n có phải là số nguyên tố hay không.",
    input: "Một số nguyên n, |n| không vượt quá 10^12.",
    output: "In YES nếu n là số nguyên tố, ngược lại in NO.",
    starterCode: `#include <iostream>
using namespace std;

int main() {
    long long n;
    cin >> n;
    // Viết lời giải tại đây.
    return 0;
}`,
    tests: [
      { input: "7\n", expected: "YES\n", hidden: false },
      { input: "1\n", expected: "NO\n", hidden: true },
      { input: "2\n", expected: "YES\n", hidden: true },
      { input: "100\n", expected: "NO\n", hidden: true },
      { input: "999983\n", expected: "YES\n", hidden: true },
      { input: "-5\n", expected: "NO\n", hidden: true }
    ]
  },
  {
    id: "003",
    slug: "tong-lon-nhat-day-con",
    title: "Tổng lớn nhất của dãy con",
    difficulty: "Trung bình",
    timeLimitMs: 1000,
    memoryLimitMb: 128,
    statement: "Cho dãy n số nguyên. Tìm tổng lớn nhất của một dãy con liên tiếp không rỗng.",
    input: "Dòng đầu là n. Dòng thứ hai gồm n số nguyên.",
    output: "In ra tổng lớn nhất tìm được.",
    starterCode: `#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int n;
    cin >> n;
    // Viết lời giải tại đây.
    return 0;
}`,
    tests: [
      { input: "8\n-2 -3 4 -1 -2 1 5 -3\n", expected: "7\n", hidden: false },
      { input: "5\n-8 -3 -6 -2 -5\n", expected: "-2\n", hidden: true },
      { input: "1\n42\n", expected: "42\n", hidden: true },
      { input: "6\n1 2 3 4 5 6\n", expected: "21\n", hidden: true },
      { input: "7\n5 -10 6 7 -20 8 9\n", expected: "17\n", hidden: true }
    ]
  }
];

export function getProblem(problemId) {
  return problems.find((problem) => problem.id === problemId || problem.slug === problemId);
}

export function toPublicProblem(problem) {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    statement: problem.statement,
    input: problem.input,
    output: problem.output,
    starterCode: problem.starterCode,
    samples: problem.tests
      .filter((test) => !test.hidden)
      .map(({ input, expected }) => ({ input, output: expected }))
  };
}

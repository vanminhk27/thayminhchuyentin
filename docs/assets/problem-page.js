const problemId=document.body.dataset.problemId;
const starters={
  "001":{
    cpp:`#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}`,
    python:`a, b = map(int, input().split())
print(a + b)`
  },
  "002":{
    cpp:`#include <iostream>
using namespace std;

int main() {
    long long n;
    cin >> n;
    bool prime = n >= 2;
    for (long long i = 2; i * i <= n; ++i)
        if (n % i == 0) prime = false;
    cout << (prime ? "YES" : "NO");
}`,
    python:`n = int(input())
prime = n >= 2
i = 2
while i * i <= n:
    if n % i == 0:
        prime = False
        break
    i += 1
print("YES" if prime else "NO")`
  },
  "003":{
    cpp:`#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int n;
    cin >> n;
    long long x, best, current;
    cin >> x;
    best = current = x;
    for (int i = 1; i < n; ++i) {
        cin >> x;
        current = max(x, current + x);
        best = max(best, current);
    }
    cout << best;
}`,
    python:`n = int(input())
a = list(map(int, input().split()))
best = current = a[0]
for x in a[1:]:
    current = max(x, current + x)
    best = max(best, current)
print(best)`
  },
  "004":{
    cpp:`#include <bits/stdc++.h>
using namespace std;

int main() {
    // Hãy cài đặt thuật toán Dijkstra tại đây.
    return 0;
}`,
    python:`import heapq

# Hãy cài đặt thuật toán Dijkstra tại đây.`
  }
};
const language=document.getElementById("language");
const code=document.getElementById("code");
const saved=document.getElementById("saved");
const msg=document.getElementById("msg");
const storageKey=()=>`thayminh-code-${problemId}-${language.value}`;
function loadCode(){
  const stored=localStorage.getItem(storageKey());
  code.value=stored||starters[problemId][language.value];
  saved.textContent=stored?"Đã khôi phục code đã lưu":"Đang dùng code mẫu";
  msg.style.display="none";
}
language.addEventListener("change",loadCode);
let timer;
code.addEventListener("input",()=>{
  saved.textContent="Đang lưu...";
  clearTimeout(timer);
  timer=setTimeout(()=>{
    localStorage.setItem(storageKey(),code.value);
    saved.textContent="Đã lưu tự động";
  },350);
});
document.getElementById("reset").addEventListener("click",()=>{
  if(confirm("Khôi phục code mẫu của bài này?")){
    localStorage.removeItem(storageKey());
    loadCode();
  }
});
document.getElementById("copy").addEventListener("click",async()=>{
  await navigator.clipboard.writeText(code.value);
  saved.textContent="Đã sao chép code";
});
document.getElementById("submit").addEventListener("click",()=>{
  localStorage.setItem(storageKey(),code.value);
  saved.textContent="Đã lưu";
  msg.style.display="block";
});
loadCode();

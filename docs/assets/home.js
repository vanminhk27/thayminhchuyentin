const normalize=text=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const searchItems=[
  {title:"Lập trình Scratch",note:"9 Level · 12 buổi/Level",keywords:"scratch tieu hoc tin hoc tre sang tao",target:"#courses"},
  {title:"Dạy lập trình tại Vũng Tàu",note:"Học tại Rạch Dừa",keywords:"lop hoc gia su tin hoc lap trinh vung tau rach dua binh gia",target:"day-lap-trinh-vung-tau.html"},
  {title:"Học lập trình online",note:"Dạy trực tuyến toàn quốc",keywords:"hoc lap trinh online truc tuyen cho hoc sinh c++ python",target:"hoc-lap-trinh-online-cho-hoc-sinh.html"},
  {title:"Python định hướng thuật toán",note:"8 Level · 12 buổi/Level",keywords:"python thuat toan hsg tin hoc tre luyen de",target:"#courses"},
  {title:"Python định hướng ứng dụng",note:"9 Level · 12 buổi/Level",keywords:"python ung dung game ai san pham",target:"#courses"},
  {title:"HSG & Chuyên Tin",note:"Khóa học",keywords:"hsg hoc sinh gioi chuyen tin lop 10",target:"#courses"},
  {title:"Tin học trẻ",note:"Khóa học",keywords:"tin hoc tre bang a d2",target:"#courses"},
  {title:"Olympic & HKICO",note:"Khóa học",keywords:"olympic hkico quoc te",target:"#courses"},
  {title:"Lập trình Website & Bảo mật Web",note:"8 Level · 12 buổi/Level",keywords:"wordpress html css javascript bootstrap django bao mat web",target:"#courses"},
  {title:"Nghiên cứu khoa học",note:"Khóa học",keywords:"nghien cuu khoa hoc khkt sang tao",target:"#courses"},
  {title:"Thành tích học sinh",note:"Tuyển sinh chuyên & Tin học trẻ 2025–2026",keywords:"thanh tich hoc sinh giai thuong chuyen tin chuyen toan",target:"#achievements"},
  {title:"Kho bài tập",note:"Luyện Code TMCT",keywords:"bai tap luyen code c++ python",target:"https://luyencode.net/organization/tmct"},
  {title:"Lộ trình luyện thi chuyên Tin",note:"Bài viết",keywords:"luyen thi chuyen tin c++ thuat toan lop 10",target:"luyen-thi-chuyen-tin.html"},
  {title:"Luyện thi Tin học trẻ",note:"Bài viết",keywords:"tin hoc tre lap trinh thuat toan",target:"luyen-thi-tin-hoc-tre.html"},
  {title:"Học C++ và thuật toán",note:"Bài viết",keywords:"hoc c++ thuat toan cho hoc sinh",target:"hoc-cpp-thuat-toan-cho-hoc-sinh.html"},
  {title:"Tư vấn qua Zalo",note:"Liên hệ",keywords:"tu van lien he zalo so dien thoai",target:"#contact"}
];
const searchForm=document.getElementById("siteSearch"),searchInput=document.getElementById("searchInput"),searchResults=document.getElementById("searchResults");
function getMatches(value){const query=normalize(value);return query?searchItems.filter(item=>normalize(item.title+" "+item.keywords).includes(query)).slice(0,6):[]}
function renderSearch(){const matches=getMatches(searchInput.value);searchResults.textContent="";if(!searchInput.value.trim()){searchResults.classList.remove("open");return}if(!matches.length){const empty=document.createElement("div");empty.className="searchEmpty";empty.textContent="Chưa tìm thấy. Thử: C++, Tin học trẻ, thành tích...";searchResults.appendChild(empty)}else matches.forEach(item=>{const link=document.createElement("a");link.className="searchResult";link.href=item.target;if(item.target.startsWith("http")){link.target="_blank";link.rel="noopener noreferrer"}const title=document.createElement("span");title.textContent=item.title;const note=document.createElement("small");note.textContent=item.note;link.append(title,note);searchResults.appendChild(link)});searchResults.classList.add("open")}
searchInput.addEventListener("input",renderSearch);searchInput.addEventListener("focus",renderSearch);searchForm.addEventListener("submit",event=>{event.preventDefault();const first=getMatches(searchInput.value)[0];if(first){if(first.target.startsWith("http"))window.open(first.target,"_blank","noopener,noreferrer");else window.location.href=first.target}});document.addEventListener("click",event=>{if(!event.target.closest(".searchWrap"))searchResults.classList.remove("open")});
const menuToggle=document.getElementById("menuToggle"),mainNav=document.getElementById("mainNav");function closeMenu(){mainNav.classList.remove("open");menuToggle.setAttribute("aria-expanded","false");menuToggle.textContent="☰";document.body.classList.remove("menu-open")}menuToggle.addEventListener("click",()=>{const open=mainNav.classList.toggle("open");menuToggle.setAttribute("aria-expanded",String(open));menuToggle.textContent=open?"✕":"☰";document.body.classList.toggle("menu-open",open)});mainNav.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));window.addEventListener("resize",()=>{if(innerWidth>760)closeMenu()});
const sections=[...document.querySelectorAll("main section[id]")],navLinks=[...mainNav.querySelectorAll("a[href^='#']")];const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)navLinks.forEach(link=>link.classList.toggle("active",link.getAttribute("href")==="#"+entry.target.id))}),{rootMargin:"-25% 0px -65% 0px"});sections.forEach(section=>observer.observe(section));

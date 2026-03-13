// ─── Theme Toggle ─────────────────────────────
const toggleBtn = document.getElementById('themeToggle');
const body = document.body;

// LocalStorage se theme yaad rakhna
const savedTheme = localStorage.getItem('snaplink-theme');
if (savedTheme === 'light') body.classList.add('light');

toggleBtn.addEventListener('click', () => {
  body.classList.toggle('light');
  const current = body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem('snaplink-theme', current);
});

// ─── Copy Button ──────────────────────────────
const link = document.getElementById('shortLink');

if (link) {
  // URL text alag span mein rakhna
  const urlText = document.createElement('span');
  urlText.textContent = link.textContent.trim();
  urlText.style.overflow = 'hidden';
  urlText.style.textOverflow = 'ellipsis';
  urlText.style.whiteSpace = 'nowrap';

  // Copy button banana
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.classList.add('copy-btn');

  // Link ke andar dono rakhna
  link.textContent = '';
  link.appendChild(urlText);
  link.appendChild(copyBtn);

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault(); // link pe navigate nahi karna
    navigator.clipboard.writeText(urlText.textContent.trim()).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });
}
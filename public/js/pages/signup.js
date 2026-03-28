// ─── Password Show/Hide ────────────────────────
const togglePass = document.getElementById('togglePass');
const passInput  = document.getElementById('password');

togglePass.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  togglePass.title = isHidden ? 'Hide password' : 'Show password';
});

// ─── Password Strength Meter ───────────────────
const strengthBar   = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');

const levels = [
  { label: '',         cls: ''   },
  { label: 'Weak',     cls: 's1' },
  { label: 'Fair',     cls: 's2' },
  { label: 'Good',     cls: 's3' },
  { label: 'Strong',   cls: 's4' },
];

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)                    score++;
  if (/[A-Z]/.test(pwd))                  score++;
  if (/[0-9]/.test(pwd))                  score++;
  if (/[^A-Za-z0-9]/.test(pwd))          score++;
  return score;
}

passInput.addEventListener('input', () => {
  const pwd = passInput.value;
  if (!pwd) {
    strengthBar.className = 'strength-bar';
    strengthLabel.textContent = '';
    return;
  }
  const score = getStrength(pwd);
  strengthBar.className = 'strength-bar ' + levels[score].cls;
  strengthLabel.textContent = levels[score].label;
});

// ─── Confirm Password Match ────────────────────
const confirmInput = document.getElementById('confirmPassword');

confirmInput.addEventListener('input', () => {
  if (confirmInput.value && confirmInput.value !== passInput.value) {
    confirmInput.classList.add('invalid');
  } else {
    confirmInput.classList.remove('invalid');
  }
});

// ─── Form Submit Validation ────────────────────
const form = document.querySelector('.form');

form.addEventListener('submit', (e) => {
  if (passInput.value !== confirmInput.value) {
    e.preventDefault();
    confirmInput.classList.add('invalid');
    confirmInput.focus();
  }
});

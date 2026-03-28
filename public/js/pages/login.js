// ─── Password Show/Hide ────────────────────────
const togglePass = document.getElementById('togglePass');
const passInput  = document.getElementById('password');

togglePass.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  togglePass.title = isHidden ? 'Hide password' : 'Show password';
});
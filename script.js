const menu = document.querySelector('.menu');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('open');
}
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('open', !expanded);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});
document.querySelector('#year').textContent = new Date().getFullYear();

// Motion is optional, and never drives changing content or focus.
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = document.querySelector('#motion-toggle');
let motionPaused = motionQuery.matches;
function renderMotion() {
  motionToggle.disabled = motionQuery.matches;
  document.body.classList.toggle('motion-paused', motionPaused);
  motionToggle.setAttribute('aria-pressed', String(motionPaused));
  if (motionQuery.matches) {
    motionToggle.textContent = 'Reduced motion enabled';
    return;
  }
  motionToggle.innerHTML = motionPaused
    ? '<span aria-hidden="true">▷</span> Resume motion'
    : '<span aria-hidden="true">Ⅱ</span> Pause motion';
}
motionToggle.addEventListener('click', () => {
  motionPaused = !motionPaused;
  renderMotion();
});
motionQuery.addEventListener('change', event => {
  motionPaused = event.matches;
  renderMotion();
});
renderMotion();
if ('IntersectionObserver' in window && !motionQuery.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  document.body.classList.add('js-ready');
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectTab(tabs[next], true);
    }
  });
});
document.querySelectorAll('[data-interest]').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('#interest').value = link.dataset.interest;
  });
});

const privacyDialog = document.querySelector('#privacy-dialog');
document.querySelectorAll('.privacy-trigger').forEach(button => {
  button.addEventListener('click', () => privacyDialog.showModal());
});
privacyDialog.querySelectorAll('.dialog-close, .dialog-done').forEach(button => {
  button.addEventListener('click', () => privacyDialog.close());
});
privacyDialog.addEventListener('click', event => {
  if (event.target !== privacyDialog) return;
  const bounds = privacyDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) privacyDialog.close();
});

const form = document.querySelector('#inquiry-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('[type="submit"]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form).entries());
  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  status.className = 'form-status';
  status.textContent = 'Sending your inquiry…';
  try {
    const response = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Your inquiry could not be sent. Please email inquire@hexabridge.com or try again.');
    status.classList.add('success');
    status.textContent = 'Thank you. Your inquiry has been sent to HexaBridge. We’ll respond using the contact details you provided.';
    form.reset();
  } catch (error) {
    status.textContent = error.name === 'TimeoutError'
      ? 'Delivery could not be confirmed. Please email inquire@hexabridge.com before sending again.'
      : error.message || 'We couldn’t send your inquiry. Please email inquire@hexabridge.com.';
  } finally {
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  }
});

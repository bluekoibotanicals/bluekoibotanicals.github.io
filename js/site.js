document.documentElement.classList.add('js');
document.querySelectorAll('[data-market-calendar]').forEach(calendar => {
  const months = [...calendar.querySelectorAll('[data-calendar-month]')];
  if (!months.length) return;
  const controls = calendar.querySelector('.calendar-controls');
  const previous = calendar.querySelector('[data-calendar-previous]');
  const next = calendar.querySelector('[data-calendar-next]');
  const heading = calendar.querySelector('[data-calendar-heading]');
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit'}).formatToParts(new Date());
  const current = parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
  let index = months.findIndex(month => month.dataset.calendarMonth >= current);
  if (index < 0) index = months.length - 1;
  const render = () => {
    months.forEach((month, i) => { month.hidden = i !== index; });
    heading.textContent = months[index].dataset.calendarTitle;
    previous.disabled = index === 0;
    next.disabled = index === months.length - 1;
  };
  previous.addEventListener('click', () => { index = Math.max(0, index - 1); render(); });
  next.addEventListener('click', () => { index = Math.min(months.length - 1, index + 1); render(); });
  render();
  controls.hidden = false;
});
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  links.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  window.matchMedia('(min-width: 821px)').addEventListener('change', () => setOpen(false));
}

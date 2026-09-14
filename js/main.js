// ===== Mobile nav toggle =====
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ===== Footer year =====
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ===== Scroll reveal =====
const revealTargets = document.querySelectorAll('.card, .about-inner, .flow-list li');
revealTargets.forEach((el) => el.setAttribute('data-reveal', ''));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => observer.observe(el));

// ===== Contact form -> Formspree (auto email delivery) =====
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  const formNote = contactForm.querySelector('.form-note');
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const defaultNote = formNote ? formNote.textContent : '';

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('send failed');

      contactForm.reset();
      submitBtn.textContent = '送信しました';
      if (formNote) formNote.textContent = 'お問い合わせありがとうございます。内容を確認のうえご連絡いたします。';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = '送信する';
      if (formNote) formNote.textContent = '送信に失敗しました。お手数ですが keita611210@gmail.com まで直接ご連絡ください。';
      setTimeout(() => {
        if (formNote) formNote.textContent = defaultNote;
      }, 6000);
    }
  });
}

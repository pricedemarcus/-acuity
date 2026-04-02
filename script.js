// ACUITY — Landing Page Script

// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Animate score dial on load
document.addEventListener('DOMContentLoaded', () => {
  // Dial score count-up
  const scoreEl = document.getElementById('dialScore');
  if (scoreEl) {
    let current = 472;
    const target = 514;
    const duration = 1800;
    const step = (target - current) / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      scoreEl.textContent = Math.round(current);
    }, 16);
  }

  // Animate score bars on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.dataset.width || entry.target.style.width;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.sim-score-fill').forEach(el => {
    const width = el.style.width;
    el.style.width = '0%';
    el.dataset.width = width;
    observer.observe(el);
  });

  // Fade-in sections on scroll
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.problem__card, .mcat-subject, .mcat-feature, .pricing__card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    revealObserver.observe(el);
  });
});

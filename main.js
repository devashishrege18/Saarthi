/* ─────────────────────────────────────────────────────────────────────────────
   SAARTHI — JavaScript
   ───────────────────────────────────────────────────────────────────────────── */

(function() {
  'use strict';

  /* ─── Navigation scroll effect ──────────────────────────────────────────── */

  const nav = document.getElementById('nav');
  let lastScroll = 0;

  window.addEventListener('scroll', function() {
    const y = window.scrollY;
    if (y > 40) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
    lastScroll = y;
  }, { passive: true });

  /* ─── Mobile nav toggle ─────────────────────────────────────────────────── */

  const navToggle = document.getElementById('nav-toggle');
  const navMobile = document.getElementById('nav-mobile');

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function() {
      const isOpen = navMobile.classList.toggle('nav__mobile--open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navMobile.setAttribute('aria-hidden', String(!isOpen));
    });

    // Close on mobile link click
    navMobile.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navMobile.classList.remove('nav__mobile--open');
        navToggle.setAttribute('aria-expanded', 'false');
        navMobile.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /* ─── Smooth scroll for anchor links ───────────────────────────────────── */

  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const href = anchor.getAttribute('href');
      if (href === '#' || href === '#connect') return; // handled by modal or page
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 70; // nav height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ─── Hero particle canvas ──────────────────────────────────────────────── */

  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let particles = [];
    let animId;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function randomParticle() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.5 + 0.1
      };
    }

    function initParticles() {
      particles = [];
      const count = Math.min(120, Math.floor((W * H) / 12000));
      for (let i = 0; i < count; i++) {
        particles.push(randomParticle());
      }
    }

    function drawLines() {
      const maxDist = 130;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96,165,250,${p.alpha})`;
        ctx.fill();
      }
      drawLines();
      animId = requestAnimationFrame(tick);
    }

    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        resize();
        initParticles();
      }, 200);
    });

    resize();
    initParticles();
    tick();
  }

  /* ─── Scroll reveal ─────────────────────────────────────────────────────── */

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    reveals.forEach(function(el) { observer.observe(el); });
  } else {
    reveals.forEach(function(el) { el.classList.add('revealed'); });
  }

  /* ─── Pipeline animation ────────────────────────────────────────────────── */

  const pipeline = document.getElementById('pipeline');
  const pipelineFill = document.getElementById('pipeline-fill');
  const stages = document.querySelectorAll('.pipeline__stage');
  let pipelineActive = false;
  let currentStage = -1;
  let pipelineInterval = null;

  function activateStage(index) {
    stages.forEach(function(s, i) {
      if (i <= index) {
        s.classList.add('is-active');
      } else {
        s.classList.remove('is-active');
      }
    });
    if (stages.length > 0) {
      const pct = ((index + 1) / stages.length) * 100;
      if (pipelineFill) pipelineFill.style.width = pct + '%';
    }
  }

  function startPipeline() {
    if (pipelineInterval) return;
    currentStage = 0;
    activateStage(currentStage);

    pipelineInterval = setInterval(function() {
      currentStage++;
      if (currentStage >= stages.length) {
        currentStage = -1;
        stages.forEach(function(s) { s.classList.remove('is-active'); });
        if (pipelineFill) pipelineFill.style.width = '0%';
        clearInterval(pipelineInterval);
        pipelineInterval = null;
        // Restart after a pause
        setTimeout(startPipeline, 2200);
      } else {
        activateStage(currentStage);
      }
    }, 700);
  }

  if (pipeline && 'IntersectionObserver' in window) {
    const pipelineObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !pipelineActive) {
          pipelineActive = true;
          setTimeout(startPipeline, 400);
        }
      });
    }, { threshold: 0.3 });
    pipelineObserver.observe(pipeline);
  }

  /* ─── Dashboard KPI counter animation ──────────────────────────────────── */

  function animateCounter(el, target, duration, suffix) {
    suffix = suffix || '';
    const start = performance.now();
    const startVal = 0;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (target - startVal) * eased);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function animateGauge(targetPct) {
    const arc = document.getElementById('gauge-arc');
    const pctEl = document.getElementById('gauge-pct');
    const trustEl = document.getElementById('trust-display');

    if (!arc || !pctEl) return;

    const circumference = 314;
    const offset = circumference - (targetPct / 100) * circumference;

    // Animate via CSS transition — just set the value
    setTimeout(function() {
      arc.style.strokeDashoffset = offset;
    }, 200);

    // Animate the percentage text
    let start = performance.now();
    let startVal = 0;
    function tickGauge(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / 1500, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetPct - startVal) * eased);
      pctEl.textContent = current + '%';
      if (trustEl) trustEl.textContent = current + '%';
      if (progress < 1) requestAnimationFrame(tickGauge);
    }
    requestAnimationFrame(tickGauge);
  }

  // Trigger counters when dashboard enters viewport
  const dashboard = document.querySelector('.console');
  let dashAnimated = false;

  if (dashboard && 'IntersectionObserver' in window) {
    const dashObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !dashAnimated) {
          dashAnimated = true;

          document.querySelectorAll('.console__kpi-val[data-target]').forEach(function(el) {
            const target = parseInt(el.getAttribute('data-target'));
            animateCounter(el, target, 1800);
          });

          animateGauge(96);
        }
      });
    }, { threshold: 0.2 });
    dashObserver.observe(dashboard);
  }

  /* ─── Connection modal ──────────────────────────────────────────────────── */

  const modal = document.getElementById('connect-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalIcon = document.getElementById('modal-icon');
  const modalCta = document.getElementById('modal-cta');

  let _currentConnectType = 'gmail'; // track which type is open

  function openModal(type) {
    if (!modal) return;
    _currentConnectType = type;

    const isGmail = type === 'gmail';
    if (modalTitle) modalTitle.textContent = isGmail ? 'Connect Gmail' : 'Connect Outlook';
    if (modalBody) modalBody.textContent = isGmail
      ? 'Authorise SAARTHI to monitor your Gmail inbox via OAuth 2.0. Read-only access. No emails stored.'
      : 'Authorise SAARTHI to monitor your Outlook inbox via OAuth 2.0. Read-only access. No emails stored.';

    if (modalIcon) {
      modalIcon.innerHTML = isGmail
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
    }

    // Reset CTA to default state
    if (modalCta) {
      modalCta.textContent = 'Authorise & Connect';
      modalCta.removeAttribute('disabled');
      modalCta.style.opacity = '';
      modalCta.style.pointerEvents = '';
      modalCta.className = 'btn btn--primary btn--lg';
      modalCta.style.cssText = 'width:100%;justify-content:center;';
    }

    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Step sequence animation
    const steps = modal.querySelectorAll('.modal__step');
    steps.forEach(function(s) { s.classList.remove('modal__step--active'); });
    let stepIdx = 0;
    if (steps[0]) steps[0].classList.add('modal__step--active');

    const stepInterval = setInterval(function() {
      stepIdx++;
      if (stepIdx < steps.length) {
        if (steps[stepIdx - 1]) steps[stepIdx - 1].classList.remove('modal__step--active');
        if (steps[stepIdx]) steps[stepIdx].classList.add('modal__step--active');
      } else {
        clearInterval(stepInterval);
        steps.forEach(function(s) { s.classList.add('modal__step--active'); });
      }
    }, 1000);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });

  // ─── Modal CTA → POST to backend ──────────────────────────────────────────
  if (modalCta) {
    modalCta.addEventListener('click', async function(e) {
      e.preventDefault();

      // Show loading state
      modalCta.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Connecting…</span>';
      modalCta.setAttribute('disabled', 'true');
      modalCta.style.opacity = '0.8';

      const isGmail = _currentConnectType === 'gmail';

      try {
        // Load existing settings first, then patch
        const getRes = await fetch('http://localhost:8000/api/v1/settings');
        const existing = getRes.ok ? await getRes.json() : {};

        const payload = {
          gmail_connected: isGmail ? true : (existing.gmail_connected || false),
          gmail_email: existing.gmail_email || null,
          local_pc_connected: existing.local_pc_connected || false,
          watch_folder: existing.watch_folder || null,
          auto_accept_timesheets: true,  // auto-enable when connecting inbox
          selective_ai_parsing: true,    // auto-enable selective parsing
        };

        const postRes = await fetch('http://localhost:8000/api/v1/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (postRes.ok) {
          // ✅ Success state
          modalCta.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Connected! Redirecting…</span>';
          modalCta.style.background = 'var(--success, #10b981)';

          if (modalBody) {
            modalBody.textContent = isGmail
              ? '✅ Gmail connected. Auto-timesheet parsing enabled. Redirecting to dashboard…'
              : '✅ Outlook connected. Auto-timesheet parsing enabled. Redirecting to dashboard…';
          }

          setTimeout(function() {
            window.open('http://localhost:3000/settings', '_blank');
            closeModal();
            // Reset CTA
            if (modalCta) {
              modalCta.innerHTML = 'Authorise & Connect';
              modalCta.removeAttribute('disabled');
              modalCta.style.opacity = '';
              modalCta.style.background = '';
            }
          }, 2000);
        } else {
          throw new Error('Server responded with ' + postRes.status);
        }
      } catch (err) {
        // ❌ Error state — backend might not be running
        modalCta.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Backend offline — start the server</span>';
        modalCta.style.background = '#ef4444';
        modalCta.removeAttribute('disabled');
        modalCta.style.opacity = '1';
        if (modalBody) {
          modalBody.textContent = 'Cannot reach the backend at localhost:8000. Run: cd backend && uvicorn main:app --reload';
        }
        // Auto-reset after 4s
        setTimeout(function() {
          if (modalCta) {
            modalCta.innerHTML = 'Authorise & Connect';
            modalCta.style.background = '';
          }
        }, 4000);
      }
    });
  }

  // CSS keyframe for spinner (injected once)
  (function() {
    if (!document.getElementById('spin-keyframe')) {
      var style = document.createElement('style');
      style.id = 'spin-keyframe';
      style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
  })();

  window.handleConnect = function(type, event) {
    if (event) event.preventDefault();
    openModal(type);
  };

  // Wire up hero and nav Gmail CTAs
  ['hero-gmail', 'nav-cta'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        openModal('gmail');
      });
    }
  });

  var heroOutlook = document.getElementById('hero-outlook');
  if (heroOutlook) {
    heroOutlook.addEventListener('click', function(e) {
      e.preventDefault();
      openModal('outlook');
    });
  }

  // Wire footer "Connect Gmail / Connect Outlook" links
  document.querySelectorAll('a[href="#connect"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var text = (link.textContent || '').toLowerCase();
      openModal(text.includes('outlook') ? 'outlook' : 'gmail');
    });
  });


  /* ─── Add reveal classes on DOMContentLoaded ────────────────────────────── */

  // Hero elements
  const heroContent = document.querySelector('.hero__content');
  if (heroContent) {
    heroContent.querySelectorAll('.hero__eyebrow, .hero__headline, .hero__sub, .hero__note, .hero__actions, .hero__trust').forEach(function(el, i) {
      el.classList.add('reveal', 'reveal--delay-' + (i + 1));
    });
  }

  // Section headers
  document.querySelectorAll('.section-header .section-eyebrow, .section-header .section-title, .section-header .section-sub').forEach(function(el, i) {
    el.classList.add('reveal', 'reveal--delay-' + ((i % 3) + 1));
  });

  // Feature cards
  document.querySelectorAll('.feature-card').forEach(function(el, i) {
    el.classList.add('reveal', 'reveal--delay-' + ((i % 3) + 1));
  });

  // Console
  const consoleEl = document.querySelector('.console');
  if (consoleEl) consoleEl.classList.add('reveal', 'reveal--delay-1');

  // About sections
  document.querySelectorAll('.principle').forEach(function(el, i) {
    el.classList.add('reveal', 'reveal--delay-' + (i + 1));
  });

  // Connect section
  document.querySelectorAll('.connect__text > *').forEach(function(el, i) {
    el.classList.add('reveal', 'reveal--delay-' + ((i % 4) + 1));
  });
  const connectVisual = document.querySelector('.connect__visual');
  if (connectVisual) connectVisual.classList.add('reveal', 'reveal--delay-3');

  /* ─── Re-run observer for newly added reveal elements ─────────────────── */
  reveals.forEach(function(el) {
    // Already observed above, no-op
  });

  // Re-initialize observer for newly classified reveals
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(function(el) {
      revealObserver.observe(el);
    });
  }

  /* ─── Active nav link on scroll ─────────────────────────────────────────── */

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  function updateActiveNav() {
    let current = '';
    sections.forEach(function(section) {
      const top = section.offsetTop - 100;
      if (window.scrollY >= top) current = section.getAttribute('id');
    });
    navLinks.forEach(function(link) {
      link.style.color = '';
      if (link.getAttribute('href') === '#' + current) {
        link.style.color = 'var(--text-primary)';
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

})();

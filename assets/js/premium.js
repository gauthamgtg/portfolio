/* =====================================================================
   PREMIUM INTERACTIONS — particle field, 3D tilt, magnetic cursor,
   scroll reveal, spotlight, counters, progress bar.
   Vanilla JS, no dependencies. Guards for reduced-motion & touch.
   ===================================================================== */
(function () {
	'use strict';

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
	const $ = (s, c) => (c || document).querySelector(s);
	const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

	/* ----------------------------------------------------------------
	   1. Particle constellation background
	   ---------------------------------------------------------------- */
	function initParticles() {
		if (reduceMotion) return;
		const canvas = document.createElement('canvas');
		canvas.id = 'premium-canvas';
		document.body.prepend(canvas);
		const ctx = canvas.getContext('2d');

		let w, h, dpr, particles, mouse = { x: -9999, y: -9999 };

		function brandColor() {
			return document.documentElement.getAttribute('data-theme') === 'light'
				? '14, 165, 233'
				: '56, 189, 248';
		}

		function resize() {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			w = canvas.width = window.innerWidth * dpr;
			h = canvas.height = window.innerHeight * dpr;
			canvas.style.width = window.innerWidth + 'px';
			canvas.style.height = window.innerHeight + 'px';
			const count = Math.min(110, Math.floor((window.innerWidth * window.innerHeight) / 14000));
			particles = Array.from({ length: count }, () => ({
				x: Math.random() * w,
				y: Math.random() * h,
				vx: (Math.random() - 0.5) * 0.25 * dpr,
				vy: (Math.random() - 0.5) * 0.25 * dpr,
				r: (Math.random() * 1.6 + 0.6) * dpr
			}));
		}

		function tick() {
			ctx.clearRect(0, 0, w, h);
			const rgb = brandColor();
			const linkDist = 140 * dpr;
			const mx = mouse.x * dpr, my = mouse.y * dpr;

			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > w) p.vx *= -1;
				if (p.y < 0 || p.y > h) p.vy *= -1;

				// gentle attraction to pointer
				const dxm = mx - p.x, dym = my - p.y;
				const dm = Math.hypot(dxm, dym);
				if (dm < 180 * dpr) {
					p.x += (dxm / dm) * 0.4 * dpr;
					p.y += (dym / dm) * 0.4 * dpr;
				}

				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(' + rgb + ', 0.7)';
				ctx.fill();

				for (let j = i + 1; j < particles.length; j++) {
					const q = particles[j];
					const dx = p.x - q.x, dy = p.y - q.y;
					const dist = Math.hypot(dx, dy);
					if (dist < linkDist) {
						ctx.beginPath();
						ctx.moveTo(p.x, p.y);
						ctx.lineTo(q.x, q.y);
						ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.14 * (1 - dist / linkDist)) + ')';
						ctx.lineWidth = dpr;
						ctx.stroke();
					}
				}
			}
			requestAnimationFrame(tick);
		}

		window.addEventListener('resize', resize, { passive: true });
		window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
		window.addEventListener('mouseout', () => { mouse.x = -9999; mouse.y = -9999; });
		resize();
		tick();
	}

	/* ----------------------------------------------------------------
	   2. Scroll progress bar
	   ---------------------------------------------------------------- */
	function initProgress() {
		const bar = document.createElement('div');
		bar.id = 'scroll-progress';
		document.body.appendChild(bar);
		const update = () => {
			const st = document.documentElement.scrollTop || document.body.scrollTop;
			const sh = document.documentElement.scrollHeight - document.documentElement.clientHeight;
			bar.style.width = (sh > 0 ? (st / sh) * 100 : 0) + '%';
		};
		window.addEventListener('scroll', update, { passive: true });
		update();
	}

	/* ----------------------------------------------------------------
	   3. Custom magnetic cursor
	   ---------------------------------------------------------------- */
	function initCursor() {
		if (isTouch) return;
		document.body.classList.add('has-custom-cursor');
		const dot = document.createElement('div');
		const ring = document.createElement('div');
		dot.id = 'cursor-dot';
		ring.id = 'cursor-ring';
		document.body.append(dot, ring);

		let mx = window.innerWidth / 2, my = window.innerHeight / 2;
		let rx = mx, ry = my;

		window.addEventListener('mousemove', (e) => {
			mx = e.clientX; my = e.clientY;
			dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
		}, { passive: true });

		(function ringLoop() {
			rx += (mx - rx) * 0.18;
			ry += (my - ry) * 0.18;
			ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
			requestAnimationFrame(ringLoop);
		})();

		const hoverSel = 'a, button, .project-card, .stat-card, .skill-card, .why-me-card, .impact-card, [data-tilt], .theme-toggle, .filter-btn';
		document.addEventListener('mouseover', (e) => {
			if (e.target.closest(hoverSel)) ring.classList.add('is-hover');
		});
		document.addEventListener('mouseout', (e) => {
			if (e.target.closest(hoverSel)) ring.classList.remove('is-hover');
		});
		document.addEventListener('mousedown', () => ring.classList.add('is-down'));
		document.addEventListener('mouseup', () => ring.classList.remove('is-down'));
	}

	/* ----------------------------------------------------------------
	   4. 3D tilt + spotlight on cards
	   ---------------------------------------------------------------- */
	function initTilt() {
		const cards = $$('.project-card, .stat-card, .why-me-card, .impact-card, .skill-card, .domain-card, .achievement-card, .value-card');
		cards.forEach((card) => {
			card.setAttribute('data-spotlight', '');
			if (isTouch || reduceMotion) return;
			card.setAttribute('data-tilt', '');
			const maxTilt = 7;
			let raf = null;

			function onMove(e) {
				const r = card.getBoundingClientRect();
				const px = (e.clientX - r.left) / r.width;
				const py = (e.clientY - r.top) / r.height;
				card.style.setProperty('--mx', px * 100 + '%');
				card.style.setProperty('--my', py * 100 + '%');
				if (raf) return;
				raf = requestAnimationFrame(() => {
					const rotY = (px - 0.5) * 2 * maxTilt;
					const rotX = -(py - 0.5) * 2 * maxTilt;
					card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.015)`;
					raf = null;
				});
			}
			function reset() {
				if (raf) { cancelAnimationFrame(raf); raf = null; }
				card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
			}
			card.addEventListener('mousemove', onMove);
			card.addEventListener('mouseleave', reset);
		});
	}

	/* ----------------------------------------------------------------
	   5. Magnetic buttons
	   ---------------------------------------------------------------- */
	function initMagnetic() {
		if (isTouch || reduceMotion) return;
		$$('.btn, .nav-cta, #back-to-top').forEach((el) => {
			el.addEventListener('mousemove', (e) => {
				const r = el.getBoundingClientRect();
				const x = e.clientX - r.left - r.width / 2;
				const y = e.clientY - r.top - r.height / 2;
				el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
			});
			el.addEventListener('mouseleave', () => { el.style.transform = ''; });
		});
	}

	/* ----------------------------------------------------------------
	   6. Scroll reveal + section header underline
	   ---------------------------------------------------------------- */
	function initReveal() {
		const grids = $$('.why-me-grid, .domain-grid, .impact-grid, .projects-grid, .skills-grid, .achievements-grid, .contact-grid, .value-cards, .hero-stats-grid');
		grids.forEach((g) => g.classList.add('reveal-stagger'));

		const singles = $$('.section-header, .timeline-item, .education-item, .philosophy-card, .philosophy-visual, .hero-quote, .hero-cta-banner');
		singles.forEach((el) => el.classList.add('reveal'));

		const io = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('in-view');
					io.unobserve(entry.target);
				}
			});
		}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

		[...grids, ...singles].forEach((el) => io.observe(el));
	}

	/* ----------------------------------------------------------------
	   7. Animated counters for stat / impact / achievement numbers
	   ---------------------------------------------------------------- */
	function initCounters() {
		const nodes = $$('.stat-number, .impact-number, .achievement-number');
		const io = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				animate(entry.target);
				io.unobserve(entry.target);
			});
		}, { threshold: 0.6 });
		nodes.forEach((n) => io.observe(n));

		function animate(el) {
			// Capture prefix/suffix from the raw text, e.g. "$22K+", "90%", "₹1Cr+"
			const raw = el.textContent.trim();
			const match = raw.match(/([^0-9]*)([\d,.]+)(.*)/);
			if (!match || reduceMotion) return;
			const prefix = match[1];
			const target = parseFloat(match[2].replace(/,/g, ''));
			const suffix = match[3];
			if (isNaN(target)) return;
			const hasDecimal = match[2].includes('.');
			const start = performance.now();
			const dur = 1600;

			function frame(now) {
				const t = Math.min((now - start) / dur, 1);
				const eased = 1 - Math.pow(1 - t, 3);
				const val = target * eased;
				const shown = hasDecimal ? val.toFixed(1) : Math.round(val).toLocaleString();
				el.textContent = prefix + shown + suffix;
				if (t < 1) requestAnimationFrame(frame);
			}
			requestAnimationFrame(frame);
		}
	}

	/* ----------------------------------------------------------------
	   8. Back-to-top orb
	   ---------------------------------------------------------------- */
	function initBackToTop() {
		const btn = document.createElement('button');
		btn.id = 'back-to-top';
		btn.setAttribute('aria-label', 'Back to top');
		btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
		document.body.appendChild(btn);
		btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
		window.addEventListener('scroll', () => {
			btn.classList.toggle('show', window.scrollY > 600);
		}, { passive: true });
	}

	/* ----------------------------------------------------------------
	   9. Grain overlay element
	   ---------------------------------------------------------------- */
	function initGrain() {
		const g = document.createElement('div');
		g.id = 'grain-overlay';
		document.body.appendChild(g);
	}

	/* ----------------------------------------------------------------
	   Boot
	   ---------------------------------------------------------------- */
	function boot() {
		initGrain();
		initParticles();
		initProgress();
		initCursor();
		initTilt();
		initMagnetic();
		initReveal();
		initCounters();
		initBackToTop();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();

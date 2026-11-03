// nav.js - Shared mobile navigation and interactive features for Determan Tech Help
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    const closeMenu = () => {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('is-open');
        mobileMenu.classList.add('hidden');
        if (menuToggle) {
            menuToggle.classList.remove('is-active');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('menu-open');
    };

    const openMenu = () => {
        if (!mobileMenu) return;
        mobileMenu.classList.add('is-open');
        mobileMenu.classList.remove('hidden');
        if (menuToggle) {
            menuToggle.classList.add('is-active');
            menuToggle.setAttribute('aria-expanded', 'true');
        }
        document.body.classList.add('menu-open');
    };

    // Toggle Mobile Menu
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = mobileMenu.classList.contains('is-open');
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close menu when any link inside mobile menu is clicked
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });

        // Close menu when clicking anywhere outside
        document.addEventListener('click', (e) => {
            if (mobileMenu.classList.contains('is-open') && !navbar.contains(e.target)) {
                closeMenu();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
                closeMenu();
            }
        });
    }

    // Header scroll state with shadow
    const handleScroll = () => {
        if (!navbar) return;
        if (window.scrollY > 20) {
            navbar.classList.add('scrolled', 'shadow-md');
        } else {
            navbar.classList.remove('scrolled', 'shadow-md');
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Intersection Observer for fade-in animations
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    } else {
        document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    }
});

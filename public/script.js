// ─── LANDING PAGE AUTH SCRIPT ─────────────────────────────────────────────────

const authModalBackdrop = document.getElementById('authModalBackdrop');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const googleBtnContainer = document.getElementById('googleBtnContainer');
const googleFallbackContainer = document.getElementById('googleFallbackContainer');
const devLoginBtn = document.getElementById('devLoginBtn');

const userProfileWrapper = document.getElementById('userProfileWrapper');
const userAvatarBtn = document.getElementById('userAvatarBtn');
const userAvatarImg = document.getElementById('userAvatarImg');
const userAvatarInitial = document.getElementById('userAvatarInitial');

const profileDropdownMenu = document.getElementById('profileDropdownMenu');
const dropdownAvatarImg = document.getElementById('dropdownAvatarImg');
const dropdownAvatarInitial = document.getElementById('dropdownAvatarInitial');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserEmail = document.getElementById('dropdownUserEmail');
const logoutDropdownBtn = document.getElementById('logoutDropdownBtn');
const deleteAccountDropdownBtn = document.getElementById('deleteAccountDropdownBtn');

const navSignInBtn = document.getElementById('navSignInBtn');
const openAppNavBtn = document.getElementById('openAppNavBtn');

// Hero CTA buttons
const ctaLoggedOut = document.getElementById('ctaLoggedOut');
const ctaLoggedIn = document.getElementById('ctaLoggedIn');
const heroGetStartedBtn = document.getElementById('heroGetStartedBtn');
const heroSignUpBtn = document.getElementById('heroSignUpBtn');

let currentUser = null;

// ─── MODAL CONTROLS ───────────────────────────────────────────────────────────

function openAuthModal() {
    if (authModalBackdrop) {
        authModalBackdrop.style.display = 'flex';
        initGoogleAuth();
    }
}

function closeAuthModal() {
    if (authModalBackdrop) {
        authModalBackdrop.style.display = 'none';
    }
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAuthModal);

if (authModalBackdrop) {
    authModalBackdrop.addEventListener('click', (e) => {
        if (e.target === authModalBackdrop) {
            closeAuthModal();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModalBackdrop && authModalBackdrop.style.display === 'flex') {
        closeAuthModal();
    }
});

if (navSignInBtn) navSignInBtn.addEventListener('click', openAuthModal);
if (heroGetStartedBtn) heroGetStartedBtn.addEventListener('click', openAuthModal);
if (heroSignUpBtn) heroSignUpBtn.addEventListener('click', openAuthModal);

// ─── PROFILE DROPDOWN INTERACTION ─────────────────────────────────────────────

if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdownMenu.style.display === 'block';
        profileDropdownMenu.style.display = isOpen ? 'none' : 'block';
        userAvatarBtn.setAttribute('aria-expanded', !isOpen);
    });
}

document.addEventListener('click', (e) => {
    if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== userAvatarBtn) {
        profileDropdownMenu.style.display = 'none';
        if (userAvatarBtn) userAvatarBtn.setAttribute('aria-expanded', 'false');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && profileDropdownMenu && profileDropdownMenu.style.display === 'block') {
        profileDropdownMenu.style.display = 'none';
        if (userAvatarBtn) userAvatarBtn.setAttribute('aria-expanded', 'false');
    }
});

if (logoutDropdownBtn) {
    logoutDropdownBtn.addEventListener('click', async () => {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            setUserLoggedOut();
        } catch (err) {
            console.error('Logout error:', err);
        }
    });
}

if (deleteAccountDropdownBtn) {
    deleteAccountDropdownBtn.addEventListener('click', async () => {
        const confirmed = window.confirm('Are you sure you want to delete your account and all session data? This action cannot be undone.');
        if (confirmed) {
            try {
                const res = await fetch('/auth/delete-account', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    setUserLoggedOut();
                }
            } catch (err) {
                console.error('Delete account error:', err);
            }
        }
    });
}

// ─── AUTHENTICATION CHECK ─────────────────────────────────────────────────────

async function checkAuthStatus() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
            currentUser = data.user;
            setUserLoggedIn(currentUser);
        } else {
            setUserLoggedOut();
            const params = new URLSearchParams(window.location.search);
            if (params.get('login') === 'true') {
                openAuthModal();
            }
        }
    } catch (err) {
        console.error('Failed to check auth status:', err);
        setUserLoggedOut();
    }
}

async function initGoogleAuth() {
    try {
        const configRes = await fetch('/auth/config');
        const config = await configRes.json();

        if (config.googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.initialize({
                client_id: config.googleClientId,
                callback: handleGoogleCredentialResponse
            });

            googleBtnContainer.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnContainer, {
                theme: 'filled_black',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                logo_alignment: 'left',
                width: 280
            });
            googleFallbackContainer.style.display = 'none';
        } else {
            googleFallbackContainer.style.display = 'flex';
        }
    } catch (err) {
        console.warn('Google Auth init warning:', err);
        googleFallbackContainer.style.display = 'flex';
    }
}

async function handleGoogleCredentialResponse(response) {
    try {
        const res = await fetch('/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            window.location.href = '/app';
        } else {
            alert(data.error || 'Google Sign-In failed.');
        }
    } catch (err) {
        console.error('Google Sign-In error:', err);
        alert('Network error during Google Sign-In.');
    }
}

if (devLoginBtn) {
    devLoginBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/auth/dev-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/app';
            }
        } catch (err) {
            console.error('Dev login failed:', err);
        }
    });
}

function setUserLoggedIn(user) {
    if (navSignInBtn) navSignInBtn.style.display = 'none';
    if (openAppNavBtn) openAppNavBtn.style.display = 'inline-flex';
    if (ctaLoggedOut) ctaLoggedOut.style.display = 'none';
    if (ctaLoggedIn) ctaLoggedIn.style.display = 'flex';

    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const initial = (displayName.charAt(0) || 'U').toUpperCase();
    const displayEmail = user.email || 'Google Account Connected';

    dropdownUserName.textContent = displayName;
    dropdownUserEmail.textContent = displayEmail;

    if (user.picture) {
        userAvatarImg.src = user.picture;
        userAvatarImg.style.display = 'block';
        userAvatarInitial.style.display = 'none';

        dropdownAvatarImg.src = user.picture;
        dropdownAvatarImg.style.display = 'block';
        dropdownAvatarInitial.style.display = 'none';
    } else {
        userAvatarImg.style.display = 'none';
        userAvatarInitial.textContent = initial;
        userAvatarInitial.style.display = 'inline-block';

        dropdownAvatarImg.style.display = 'none';
        dropdownAvatarInitial.textContent = initial;
        dropdownAvatarInitial.style.display = 'inline-block';
    }

    userProfileWrapper.style.display = 'inline-flex';
}

function setUserLoggedOut() {
    currentUser = null;
    if (navSignInBtn) navSignInBtn.style.display = 'block';
    if (openAppNavBtn) openAppNavBtn.style.display = 'none';
    if (ctaLoggedOut) ctaLoggedOut.style.display = 'flex';
    if (ctaLoggedIn) ctaLoggedIn.style.display = 'none';
    if (userProfileWrapper) userProfileWrapper.style.display = 'none';
    if (profileDropdownMenu) profileDropdownMenu.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
});

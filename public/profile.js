// ─── PROFILE SETTINGS PAGE SCRIPT ────────────────────────────────────────────

const profileAvatarImgLg = document.getElementById('profileAvatarImgLg');
const profileAvatarInitialLg = document.getElementById('profileAvatarInitialLg');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileEmail = document.getElementById('profileEmail');
const profileSignOutBtn = document.getElementById('profileSignOutBtn');
const dangerDeleteBtn = document.getElementById('dangerDeleteBtn');

let currentUser = null;

// ─── INIT: FETCH USER & RENDER ───────────────────────────────────────────────

async function initProfile() {
    try {
        const res = await fetch('/auth/me');
        const data = await res.json();

        if (data.authenticated && data.user) {
            currentUser = data.user;
            renderProfile(currentUser);
        } else {
            window.location.href = '/?login=true';
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        window.location.href = '/?login=true';
    }
}

function renderProfile(user) {
    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    const initial = (displayName.charAt(0) || 'U').toUpperCase();
    const displayEmail = user.email || 'Google Account Connected';

    profileDisplayName.textContent = displayName;
    profileEmail.textContent = displayEmail;

    if (user.picture) {
        profileAvatarImgLg.src = user.picture;
        profileAvatarImgLg.style.display = 'block';
        profileAvatarInitialLg.style.display = 'none';
    } else {
        profileAvatarImgLg.style.display = 'none';
        profileAvatarInitialLg.textContent = initial;
        profileAvatarInitialLg.style.display = 'flex';
    }
}

// ─── SIGN OUT ────────────────────────────────────────────────────────────────

profileSignOutBtn.addEventListener('click', async () => {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (err) {
        console.error('Logout error:', err);
        window.location.href = '/';
    }
});

// ─── DELETE ACCOUNT ──────────────────────────────────────────────────────────

dangerDeleteBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(
        'Are you absolutely sure?\n\nThis will permanently delete your account, all session data, and roasting history. This action CANNOT be undone.'
    );

    if (confirmed) {
        try {
            const res = await fetch('/auth/delete-account', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/?deleted=true';
            }
        } catch (err) {
            console.error('Delete account error:', err);
            window.location.href = '/';
        }
    }
});

// ─── BOOT ────────────────────────────────────────────────────────────────────

initProfile();

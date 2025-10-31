// js/app.js
const { auth, db } = window.Chatflix;
import {
    onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential,
    updateEmail, updatePassword, deleteUser
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { renderUserProfile } from './user-profile.js';

// Basit SPA router: view-root içine modüller içerik basar.
const routes = {
    messages: async () => (await import('./messages.js')).render(),
    friends: async () => (await import('./friends.js')).render(),
    media: async () => (await import('./media.js')).render(),
    profile: async () => (await import('./profile.js')).render(),
    admin: async () => (await import('./admin.js')).render(),
    user: async (uid) => renderUserProfile(uid)
};

const root = document.getElementById('view-root');
const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
const adminBtn = document.getElementById('btn-admin');
const logoutBtn = document.getElementById('btn-logout');

function setActive(route) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.route === route));
}

async function navigate(route) {
    // user/ID yönlendirmesini yakala
    if (route.startsWith('user/')) {
        const uid = route.split('/')[1];
        await routes.user(uid);
        history.replaceState({ route }, '', `#/${route}`);
        return;
    }

    if (!routes[route]) route = 'messages';

    setActive(route);
    root.innerHTML = `<div class="card">Yükleniyor…</div>`;
    try {
        await routes[route]();
    } catch (e) {
        root.innerHTML = `<div class="card">Hata: ${e.message}</div>`;
    }
    history.replaceState({ route }, '', `#/${route}`);
}

tabBtns.forEach(b => b.addEventListener('click', () => navigate(b.dataset.route)));

logoutBtn.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await update(ref(db, "users/" + uid), { isOnline: false, lastSeen: Date.now() });
    await signOut(auth);
    location.reload();
});

// Auth guard + admin görünürlüğü
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Login görünümü (index içinde modal gibi basit render)
        root.innerHTML = `
      <div class="card" style="max-width:420px;margin:40px auto">
        <div class="section-title">Giriş</div>
        <input id="li-id" placeholder="E-posta veya kullanıcı adı" />
        <input id="li-pw" type="password" placeholder="Şifre" />
        <div class="grid cols-2">
          <button id="btn-login" class="btn">Giriş</button>
          <button id="btn-to-register" class="btn alt">Kayıt</button>
        </div>
        <div class="grid" style="margin-top:8px">
          <button id="btn-forgot" class="btn ghost">Şifremi Unuttum</button>
        </div>
        <div class="hr" style="height:1px;background:var(--line);margin-top:10px"></div>
        <div id="reg-box" style="display:none;margin-top:8px">
          <div class="section-title">Kayıt</div>
          <input id="rg-user" placeholder="Kullanıcı adı" />
          <input id="rg-mail" placeholder="E-posta" />
          <input id="rg-pw" type="password" placeholder="Şifre (min 6)" />
          <button id="btn-register" class="btn">Kaydol</button>
        </div>
      </div>`;
        attachAuthHandlers();
        return;
    }

    // users/{uid} kaydı yoksa oluştur
    const uref = ref(db, "users/" + user.uid);
    const snap = await get(uref);
    if (!snap.exists()) {
        await set(uref, {
            username: user.email.split('@')[0],
            email: user.email,
            about: "",
            photoURL: "",
            isOnline: true,
            createdAt: Date.now()
        });
    } else {
        await update(uref, { isOnline: true, lastSeen: Date.now() });
    }

    // admin butonunu göster/gizle
    const roleSnap = await get(ref(db, "users/" + user.uid + "/role"));
    adminBtn.style.display = (roleSnap.exists() && roleSnap.val() === "admin") ? "inline-block" : "none";
    adminBtn.onclick = () => navigate('admin');

    // İlk rota
    const hash = (location.hash || '#/messages').replace('#/', '');
    await navigate(hash);

    // Profil modülünün ayar işlemleri için fonksiyonları globale veriyoruz
    window.ChatflixHelpers = {
        reauthAndUpdateEmail: async (currentEmail, currentPass, newEmail) => {
            const cred = EmailAuthProvider.credential(currentEmail, currentPass);
            await reauthenticateWithCredential(auth.currentUser, cred);
            await updateEmail(auth.currentUser, newEmail);
            await update(ref(db, "users/" + auth.currentUser.uid), { email: newEmail });
        },
        reauthAndUpdatePassword: async (currentEmail, currentPass, newPass) => {
            const cred = EmailAuthProvider.credential(currentEmail, currentPass);
            await reauthenticateWithCredential(auth.currentUser, cred);
            await updatePassword(auth.currentUser, newPass);
        },
        reauthAndDeleteAccount: async (currentEmail, currentPass) => {
            const cred = EmailAuthProvider.credential(currentEmail, currentPass);
            await reauthenticateWithCredential(auth.currentUser, cred);
            const uid = auth.currentUser.uid;
            await deleteUser(auth.currentUser);
            // Kullanıcı verisini istersen burada temizleyebilirsin (soft-delete önerilir)
            await update(ref(db, "users/" + uid), { deletedAt: Date.now() });
            location.reload();
        }
    };
});
// Profil sayfasına yönlendirme (arkadaş listesi vb. için)
window.viewProfile = function (uid) {
    history.pushState({ route: 'user/' + uid }, '', '#/user/' + uid);
    routes.user(uid);
};


// basit auth işlemleri (login/register/reset)
async function signInByEmail(email, pw) {
    const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js");
    return signInWithEmailAndPassword(auth, email, pw);
}
function attachAuthHandlers() {
    const btnLogin = document.getElementById('btn-login');
    const btnToReg = document.getElementById('btn-to-register');
    const btnForgot = document.getElementById('btn-forgot');
    const regBox = document.getElementById('reg-box');
    const btnReg = document.getElementById('btn-register');

    btnToReg.onclick = () => regBox.style.display = regBox.style.display === 'none' ? 'block' : 'none';

    btnLogin.onclick = async () => {
        const id = document.getElementById('li-id').value.trim();
        const pw = document.getElementById('li-pw').value;
        if (!id || !pw) return alert("Alanları doldur");

        try {
            await signInByEmail(id, pw);
            location.reload();
        } catch (e) {
            // kullanıcı adıyla dene
            try {
                const { ref, query, orderByChild, equalTo, limitToFirst, get } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js");
                const q = query(ref(db, "users"), orderByChild("username"), equalTo(id), limitToFirst(1));
                const s = await get(q);
                if (s.exists()) {
                    const uid = Object.keys(s.val())[0];
                    const mail = s.val()[uid].email;
                    await signInByEmail(mail, pw);
                    location.reload();
                } else {
                    alert("Giriş başarısız: " + e.message);
                }
            } catch (err) { alert("Hata: " + err.message); }
        }
    };

    btnReg.onclick = async () => {
        const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js");
        const { ref, set } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js");
        const uname = document.getElementById('rg-user').value.trim();
        const mail = document.getElementById('rg-mail').value.trim();
        const pw = document.getElementById('rg-pw').value;
        if (!uname || !mail || !pw) return alert("Tüm alanlar gerekli");
        try {
            const res = await createUserWithEmailAndPassword(auth, mail, pw);
            await updateProfile(res.user, { displayName: uname });
            await set(ref(db, "users/" + res.user.uid), {
                username: uname, email: mail, photoURL: "", about: "", isOnline: true, createdAt: Date.now()
            });
            // E-posta doğrulama (bilgilendirme)
            try { await sendEmailVerification(res.user); } catch (_) { }
            alert("Kayıt başarılı. E-posta doğrulaması gönderilmiş olabilir. Girişe yönlendiriliyorsunuz.");
            location.reload();
        } catch (e) { alert("Kayıt hatası: " + e.message); }
    };

    btnForgot.onclick = async () => {
        const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js");
        const mail = prompt("E-posta adresi:");
        if (!mail) return;
        try {
            await sendPasswordResetEmail(auth, mail);
            alert("Sıfırlama bağlantısı gönderildi.");
        } catch (e) { alert(e.message); }
    };
}

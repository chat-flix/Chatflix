// js/user-profile.js
const { auth, db } = window.Chatflix;
import { ref, get, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export async function renderUserProfile(uid) {
    const root = document.getElementById('view-root');
    if (!uid) {
        root.innerHTML = `<div class="card">Kullanıcı bulunamadı.</div>`;
        return;
    }

    const snap = await get(ref(db, "users/" + uid));
    if (!snap.exists()) {
        root.innerHTML = `<div class="card">Kullanıcı bulunamadı.</div>`;
        return;
    }
    const u = snap.val();

    // Kullanıcı bilgileri
    root.innerHTML = `
    <div class="card profile-view">
      <button id="btn-back" class="btn alt">← Geri</button>
      <div class="profile-header">
        <img src="${u.photoURL || 'assets/logo.png'}" class="avatar" style="width:90px;height:90px;border-radius:50%;border:2px solid var(--line);object-fit:cover" />
        <h2>${u.username || '(Kullanıcı Adı Yok)'}</h2>
        <p style="opacity:.8">${u.about || 'Henüz bir açıklama eklenmemiş.'}</p>
      </div>

      <div class="profile-actions grid cols-2">
        <button id="btn-add" class="btn">Arkadaş Ekle</button>
        <button id="btn-chat" class="btn alt">Mesaj Gönder</button>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Yorumlar</h3>
        <div id="comments" class="comments"></div>
      </div>
    </div>
  `;

    document.getElementById('btn-back').onclick = () => {
        history.pushState({ route: 'friends' }, '', '#/friends');
        import('./friends.js').then(m => m.render());
    };


    document.getElementById('btn-add').onclick = async () => {
        await update(ref(db, "users/" + auth.currentUser.uid + "/friends"), { [uid]: "requested" });
        await update(ref(db, "users/" + uid + "/friends"), { [auth.currentUser.uid]: "pending" });
        alert("Arkadaşlık isteği gönderildi!");
    };

    document.getElementById('btn-chat').onclick = async () => {
        const me = auth.currentUser.uid;
        const chatId = [me, uid].sort().join('_');
        const chatRef = ref(db, "chats/" + chatId);
        const s = await get(chatRef);
        if (!s.exists()) {
            await update(chatRef, { participants: { [me]: true, [uid]: true }, createdAt: Date.now(), updatedAt: Date.now() });
        }
        alert("Sohbet başlatıldı! Mesajlar sekmesinden erişebilirsin.");
        history.replaceState({ route: 'messages' }, '', '#/messages');
        (await import('./messages.js')).render();
    };

    // Yorumlar kısmı
    const commentsEl = document.getElementById('comments');
    commentsEl.innerHTML = `<div class="friend-row">Kullanıcının yorumları yakında eklenecek.</div>`;
}

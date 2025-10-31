// js/profile.js
const { auth, db } = window.Chatflix;
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export async function render() {
    const root = document.getElementById('view-root');
    const s = await get(ref(db, "users/" + auth.currentUser.uid));
    const u = s.val() || {};
    root.innerHTML = `
    <div class="right-top">
      <button id="btn-settings" class="btn ghost">Ayarlar</button>
    </div>
    <div class="card">
      <div class="profile-header">
        <img class="avatar" src="${u.photoURL || 'assets/logo.png'}" />
        <div style="font-weight:700">${u.username || '-'}</div>
        <div style="opacity:.8">${u.email || ''}</div>
      </div>
      <div class="grid">
        <label>Hakkımda</label>
        <textarea id="p-about" placeholder="Kendini anlat…">${u.about || ''}</textarea>
        <label>Profil Fotoğrafı URL</label>
        <input id="p-photo" value="${u.photoURL || ''}" placeholder="https://..." />
        <div class="grid cols-2">
          <button id="p-save" class="btn">Kaydet</button>
          <button id="p-refresh" class="btn alt">Yenile</button>
        </div>
      </div>
    </div>

    <!-- Ayarlar Paneli -->
    <div class="modal" id="settings-modal" style="display:none;">

      <div class="modal-card">
        <div class="section-title">Ayarlar</div>
        <div class="grid">
          <label>Yeni kullanıcı adı</label>
          <input id="chg-username" placeholder="Yeni kullanıcı adını yaz…" />
          <button id="chg-username-btn" class="btn">Kullanıcı adını değiştir</button>

          <button id="theme-toggle" class="btn">Tema: Aqua</button>
          <div class="hr" style="height:1px;background:var(--line)"></div>

          <button id="chg-email" class="btn ghost">E-posta Değiştir</button>
          <button id="chg-pass"  class="btn ghost">Şifre Değiştir</button>
          <button id="del-acc"   class="btn alt"  style="color:#fff;background:var(--danger)">Hesabı Sil</button>
        </div>
        <div class="grid" style="margin-top:8px">
          <button id="close-settings" class="btn alt">Kapat</button>
        </div>
      </div>
    </div>
  `;

    // Profil bilgilerini kaydet
    document.getElementById('p-save').onclick = async () => {
        const about = document.getElementById('p-about').value.trim();
        const photo = document.getElementById('p-photo').value.trim();
        await update(ref(db, "users/" + auth.currentUser.uid), {
            about: about, photoURL: photo, updatedAt: Date.now()
        });
        alert("Profil güncellendi.");
    };
    document.getElementById('p-refresh').onclick = () => render();

    // Ayarlar modalını aç/kapat
    const modal = document.getElementById('settings-modal');
    document.getElementById('btn-settings').onclick = () => modal.style.display = 'flex';
    document.getElementById('close-settings').onclick = () => modal.style.display = 'none';

    // Tema değişimi (şu anda aqua temalı sabit)
    document.getElementById('theme-toggle').onclick = () => {
        alert("Tema: Aqua sabit (isteğe bağlı olarak koyu/açık eklenebilir).");
    };

    // ✅ Kullanıcı adı değiştirme
    document.getElementById('chg-username-btn').onclick = async () => {
        const newName = document.getElementById('chg-username').value.trim();
        if (!newName) return alert("Yeni kullanıcı adı boş olamaz");
        await update(ref(db, "users/" + auth.currentUser.uid), { username: newName });
        alert("Kullanıcı adı güncellendi.");
        render();
    };

    // E-posta değiştirme
    document.getElementById('chg-email').onclick = async () => {
        const currentEmail = prompt("Mevcut e-posta:");
        const currentPass = prompt("Mevcut şifre:");
        const newEmail = prompt("Yeni e-posta:");
        if (!currentEmail || !currentPass || !newEmail) return;
        try {
            await window.ChatflixHelpers.reauthAndUpdateEmail(currentEmail, currentPass, newEmail);
            alert("E-posta güncellendi.");
            render();
        } catch (e) { alert(e.message); }
    };

    // Şifre değiştirme
    document.getElementById('chg-pass').onclick = async () => {
        const currentEmail = prompt("Mevcut e-posta:");
        const currentPass = prompt("Mevcut şifre:");
        const newPass = prompt("Yeni şifre:");
        if (!currentEmail || !currentPass || !newPass) return;
        try {
            await window.ChatflixHelpers.reauthAndUpdatePassword(currentEmail, currentPass, newPass);
            alert("Şifre güncellendi.");
        } catch (e) { alert(e.message); }
    };

    // Hesap silme
    document.getElementById('del-acc').onclick = async () => {
        if (!confirm("Hesabı silmek istediğine emin misin?")) return;
        const currentEmail = prompt("Mevcut e-posta:");
        const currentPass = prompt("Mevcut şifre:");
        if (!currentEmail || !currentPass) return;
        try {
            await window.ChatflixHelpers.reauthAndDeleteAccount(currentEmail, currentPass);
        } catch (e) { alert(e.message); }
    };
}

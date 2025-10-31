// js/admin.js
const { auth, db } = window.Chatflix;
import { ref, get, set, update, push, onValue, remove, query, orderByChild } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export async function render() {
    // admin guard
    const role = (await get(ref(db, "users/" + auth.currentUser.uid + "/role"))).val();
    const root = document.getElementById('view-root');
    if (role !== "admin") { root.innerHTML = `<div class="card">Admin yetkiniz yok.</div>`; return; }

    root.innerHTML = `
    <div class="card">
      <div class="section-title">İçerik Ekle (Film/Dizi/Anime)</div>
      <div class="grid cols-3">
        <input id="m-title" placeholder="Başlık" />
        <select id="m-type">
          <option value="movie">Film</option>
          <option value="series">Dizi</option>
          <option value="anime">Anime</option>
        </select>
        <input id="m-thumb" placeholder="Kapak URL" />
        <input id="m-video" placeholder="Video URL (film için)" />
        <input id="m-desc" placeholder="Açıklama" />
        <button id="m-add" class="btn">Ekle</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="section-title">Var Olan İçeriğe Bölüm Ekle</div>
      <div class="grid cols-3">
        <select id="m-select"></select>
        <input id="e-title" placeholder="Bölüm adı" />
        <input id="e-num" type="number" placeholder="Bölüm no" />
        <input id="e-url" placeholder="Video URL" />
        <button id="e-add" class="btn">Bölüm Ekle</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="section-title">Kullanıcı Yönetimi</div>
      <div class="grid cols-3">
        <input id="u-mail" placeholder="Kullanıcı e-postası" />
        <button id="u-mkadmin" class="btn ghost">Admin Yap</button>
        <button id="u-rmadmin" class="btn alt">Adminlik Kaldır</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="section-title">İçerikler</div>
      <div id="list" class="grid"></div>
    </div>
  `;

    // içerik listesi
    const sel = document.getElementById('m-select');
    onValue(query(ref(db, "media"), orderByChild("title")), (snap) => {
        sel.innerHTML = "";
        const list = document.getElementById('list');
        list.innerHTML = "";
        snap.forEach(ch => {
            const m = { id: ch.key, ...ch.val() };
            const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.title;
            sel.appendChild(opt);

            const el = document.createElement('div');
            el.className = "media-card";
            el.innerHTML = `
        <img src="${m.thumbnail || 'assets/logo.png'}" />
        <div style="flex:1">
          <h3>${m.title}</h3>
          <div style="opacity:.8">${m.type || ''}</div>
          <p style="opacity:.8">${(m.description || '').slice(0, 140)}</p>
          <div class="grid cols-2">
            <button class="btn alt" data-act="del" data-id="${m.id}">Sil</button>
            ${m.videoUrl ? `<a class="btn ghost" href="${m.videoUrl}" target="_blank">İzle</a>` : ''}
          </div>
        </div>
      `;
            el.querySelector('[data-act="del"]').onclick = async () => {
                if (!confirm("Silinsin mi?")) return;
                await remove(ref(db, "media/" + m.id));
            };
            list.appendChild(el);
        });
    });

    document.getElementById('m-add').onclick = async () => {
        const payload = {
            title: document.getElementById('m-title').value.trim(),
            type: document.getElementById('m-type').value,
            thumbnail: document.getElementById('m-thumb').value.trim(),
            videoUrl: document.getElementById('m-video').value.trim(),
            description: document.getElementById('m-desc').value.trim(),
            createdAt: Date.now(),
            publishedAt: Date.now()
        };
        if (!payload.title) return alert("Başlık gerekli");
        const key = push(ref(db, "media")).key;
        await set(ref(db, "media/" + key), payload);
        alert("Eklendi");
    };

    document.getElementById('e-add').onclick = async () => {
        const mediaId = document.getElementById('m-select').value;
        if (!mediaId) return alert("İçerik seç");
        const title = document.getElementById('e-title').value.trim();
        const num = parseInt(document.getElementById('e-num').value, 10) || 1;
        const url = document.getElementById('e-url').value.trim();
        const key = push(ref(db, "episodes")).key;
        await set(ref(db, "episodes/" + key), { mediaId, title, number: num, videoUrl: url, publishedAt: Date.now() });
        alert("Bölüm eklendi");
    };

    document.getElementById('u-mkadmin').onclick = () => setRole(true);
    document.getElementById('u-rmadmin').onclick = () => setRole(false);

    async function setRole(makeAdmin) {
        const mail = document.getElementById('u-mail').value.trim();
        if (!mail) return alert("E-posta girin");
        // E-posta'dan kullanıcıyı bul
        const users = await get(ref(db, "users"));
        if (!users.exists()) return alert("Kullanıcı bulunamadı");
        let uid = null;
        users.forEach(ch => { if (ch.val().email === mail) uid = ch.key; });
        if (!uid) return alert("Eşleşen kullanıcı yok");
        await update(ref(db, "users/" + uid), { role: makeAdmin ? "admin" : null });
        alert("Güncellendi");
    }
}

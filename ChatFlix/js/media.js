// js/media.js
const { auth, db } = window.Chatflix;
import {
    ref, onValue, get, set, update, push,
    query, orderByChild, equalTo
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export async function render() {
    const root = document.getElementById('view-root');
    root.innerHTML = `
    <div class="card">
      <div class="section-title">Medya</div>
      <div class="grid cols-3" style="align-items:end">
        <div>
          <label>Tür</label>
          <div class="tabs">
            <div class="tab active" data-type="movie">Filmler</div>
            <div class="tab" data-type="series">Diziler</div>
            <div class="tab" data-type="anime">Animeler</div>
          </div>
        </div>
        <div>
          <label>Arama</label>
          <input id="m-search" placeholder="Başlık ara…" />
        </div>
        <div>
          <label>Sırala</label>
          <select id="m-sort">
            <option value="title">Alfabetik</option>
            <option value="published">Yayın Tarihi (yeni→eski)</option>
          </select>
        </div>
      </div>
      <div id="m-list" class="grid" style="margin-top:10px"></div>
    </div>
    <div id="detail" style="margin-top:12px"></div>
  `;

    document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        loadList();
    });

    document.getElementById('m-search').oninput = () => loadList();
    document.getElementById('m-sort').onchange = () => loadList();
    loadList();
}

function currentType() {
    return document.querySelector('.tab.active').dataset.type;
}

function loadList() {
    const list = document.getElementById('m-list');
    const type = currentType();
    list.innerHTML = "Yükleniyor…";

    onValue(ref(db, "media"), (snap) => {
        const data = snap.val() || {};
        const arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));

        const s = document.getElementById('m-search').value.trim().toLowerCase();
        const sort = document.getElementById('m-sort').value;

        let items = arr.filter(m => (m.type || '').toLowerCase() === type.toLowerCase());
        if (s) items = items.filter(m => (m.title || '').toLowerCase().includes(s));
        if (sort === 'title') items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        if (sort === 'published') items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

        list.innerHTML = "";
        if (!items.length) {
            list.innerHTML = `<div class="media-card">Bu kategoride içerik bulunamadı.</div>`;
            return;
        }

        list.style.display = "grid";
        list.style.gridTemplateColumns = "repeat(auto-fill, minmax(300px, 1fr))";
        list.style.gap = "20px";
        list.style.alignItems = "stretch";

        items.forEach(m => {
            const el = document.createElement('div');
            el.className = "media-card";
            el.style.cursor = "pointer";
            el.style.display = "flex";
            el.style.flexDirection = "column";
            el.style.background = "rgba(255,255,255,0.05)";
            el.style.borderRadius = "12px";
            el.style.overflow = "hidden";
            el.style.transition = "transform 0.25s, box-shadow 0.25s";

            el.innerHTML = `
        <div style="aspect-ratio: 16/9; overflow:hidden;">
          <img src="${m.thumbnail || 'assets/logo.png'}" 
               style="width:100%; height:100%; object-fit:cover;" />
        </div>
        <div style="padding:12px; flex:1;">
          <h3 style="margin:4px 0; font-size:1.1em;">${m.title || '-'}</h3>
          <p style="opacity:.8; font-size:0.9em; line-height:1.3em;">
            ${(m.description || '').slice(0, 120)}
          </p>
        </div>
      `;

            el.onmouseover = () => el.style.transform = "scale(1.03)";
            el.onmouseout = () => el.style.transform = "scale(1)";
            el.onclick = () => openDetail(m.id);
            list.appendChild(el);
        });
    });
}

async function openDetail(id) {
    const root = document.getElementById('view-root');
    const s = await get(ref(db, "media/" + id));
    const m = s.val() || {};

    root.innerHTML = `
    <div class="media-detail-full" style="
      position: relative;
      min-height: 100vh;
      background: url('${m.thumbnail || 'assets/logo.png'}') center/cover no-repeat;
      color: #fff;">
      <div style="position:absolute; inset:0; backdrop-filter: blur(20px) brightness(0.5);"></div>
      <div style="position:relative; padding:40px; max-width:900px; margin:auto;">
        <button id="back-btn" class="btn alt" style="margin-bottom:20px;">← Geri</button>
        <h1 style="font-size:2.5em;">${m.title || '-'}</h1>
        <p style="opacity:.9; font-size:1.1em; margin-top:12px;">${m.description || ''}</p>
        ${m.videoUrl ? `<button class="btn" id="watch-btn" style="margin-top:20px;">🎬 İzle</button>` : ''}
        ${m.type !== 'movie' ? `
          <div style="margin-top:30px;">
            <h3>Bölümler</h3>
            <div id="eps" style="margin-top:10px;">Yükleniyor…</div>
          </div>` : ''}
        <div style="margin-top:30px;">
          <h3>Yorumlar</h3>
          <div id="comments" style="margin-top:10px;">Yükleniyor…</div>
          <div class="grid cols-2" style="margin-top:8px; gap:8px;">
            <input id="cmt-text" placeholder="Yorum yaz…" />
            <button id="cmt-add" class="btn">Gönder</button>
          </div>
        </div>
      </div>
    </div>
  `;

    if (m.videoUrl) {
        document.getElementById('watch-btn').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const playerUrl = `player.html?src=${encodeURIComponent(m.videoUrl)}`;
            window.open(playerUrl, '_blank');
        };
    }

    if (m.type !== 'movie') loadEpisodes(id);
    loadComments(id);

    document.getElementById('back-btn').onclick = () => render();
    document.getElementById('cmt-add').onclick = () => addComment(id);
}

function loadEpisodes(mediaId) {
    const box = document.getElementById('eps');
    const q = query(ref(db, "episodes"), orderByChild("mediaId"), equalTo(mediaId));
    onValue(q, (snap) => {
        const rows = [];
        snap.forEach(ch => {
            const e = { id: ch.key, ...ch.val() };
            rows.push(`
        <div class="media-card">
          <div style="flex:1">
            <div style="font-weight:700">${e.title || ('Bölüm ' + e.number)}</div>
            <div style="opacity:.8">${new Date(e.publishedAt || Date.now()).toLocaleString()}</div>
          </div>
          ${e.videoUrl ? `<button class="btn ep-watch" data-src="${e.videoUrl}">İzle</button>` : ''}
        </div>`);
        });
        box.innerHTML = rows.length ? rows.join('') : `<div class="media-card">Bölüm yok.</div>`;

        // Bölüm izleme yönlendirmesi
        box.querySelectorAll('.ep-watch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const src = btn.dataset.src;
                window.open(`player.html?src=${encodeURIComponent(src)}`, '_blank');
            });
        });
    });
}

async function loadComments(mediaId) {
    const box = document.getElementById('comments');
    const me = auth.currentUser;
    const meSnap = await get(ref(db, "users/" + me.uid));
    const meData = meSnap.val() || {};
    const isAdmin = (meData.role === "admin"); // 👈 sadece role="admin" olanlar yetkili

    onValue(ref(db, "media/" + mediaId + "/comments"), async (snap) => {
        if (!snap.exists()) {
            box.innerHTML = `<div class="comment">Henüz yorum yok.</div>`;
            return;
        }

        const arr = [];
        snap.forEach(ch => {
            const v = ch.val() || {};
            arr.push({ id: ch.key, ...v });
        });

        // Yeni yorumlar üstte
        arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Her kullanıcıyı sadece bir kez getir
        const userCache = {};
        const htmlParts = [];
        for (const c of arr) {
            if (!userCache[c.uid]) {
                const uSnap = await get(ref(db, "users/" + c.uid));
                userCache[c.uid] = uSnap.val() || {};
            }
            const u = userCache[c.uid];
            const photo = u.photoURL || 'assets/logo.png';
            const username = u.username || 'Kullanıcı';
            const isOwn = c.uid === me.uid;

            htmlParts.push(`
        <div class="comment" style="display:flex;gap:10px;padding:10px;border-radius:8px;
             background:rgba(255,255,255,0.05);margin-bottom:10px;">
          <img src="${photo}" data-uid="${c.uid}" 
               style="width:45px;height:45px;border-radius:50%;object-fit:cover;cursor:pointer;border:1px solid rgba(255,255,255,0.1);" />
          <div style="flex:1;">
            <div class="meta" style="font-size:0.9em;opacity:0.9;">
              <strong data-uid="${c.uid}" style="cursor:pointer;">${username}</strong>
              <span style="opacity:0.7;"> — ${new Date(c.createdAt || Date.now()).toLocaleString()}</span>
            </div>
            <div style="margin-top:4px;">${c.deleted ? '<i>Yorum silindi</i>' : escapeHtml(c.text || '')}</div>
            ${(!c.deleted && (isOwn || isAdmin)) ? `
              <div class="grid cols-2" style="margin-top:6px;gap:6px;">
                ${isOwn ? `<button class="btn ghost" data-act="edit" data-id="${c.id}" data-mid="${mediaId}">Düzenle</button>` : ''}
                <button class="btn alt" data-act="del" data-id="${c.id}" data-mid="${mediaId}">Sil</button>
              </div>` : ''}
          </div>
        </div>
      `);
        }

        box.innerHTML = htmlParts.join('');

        // Profil tıklamaları
        box.querySelectorAll('[data-uid]').forEach(el => {
            el.onclick = () => window.viewProfile(el.dataset.uid);
        });

        // Düğmeler
        box.querySelectorAll('[data-act="edit"]').forEach(b =>
            b.onclick = () => editComment(b.dataset.mid, b.dataset.id)
        );
        box.querySelectorAll('[data-act="del"]').forEach(b =>
            b.onclick = () => delComment(b.dataset.mid, b.dataset.id)
        );
    });
}


async function addComment(mediaId) {
    const input = document.getElementById('cmt-text');
    const text = input.value.trim();
    if (!text) return;
    const key = push(ref(db, "media/" + mediaId + "/comments")).key;
    const u = (await get(ref(db, "users/" + auth.currentUser.uid))).val() || {};
    await set(ref(db, "media/" + mediaId + "/comments/" + key), {
        uid: auth.currentUser.uid,
        username: u.username || 'Kullanıcı',
        text,
        createdAt: Date.now(),
        deleted: false,
        edited: false
    });
    input.value = "";
}

async function editComment(mid, cid) {
    const val = prompt("Yeni yorum:");
    if (!val) return;
    await update(ref(db, `media/${mid}/comments/${cid}`), { text: val, edited: true });
}

async function delComment(mid, cid) {
    if (!confirm("Silinsin mi?")) return;
    await update(ref(db, `media/${mid}/comments/${cid}`), { deleted: true });
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#039;"
    }[m]));
}

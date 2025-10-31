// js/messages.js
const { auth, db } = window.Chatflix;
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, onValue, get, set, update, onChildAdded, onChildChanged, off } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

let state = {
    currentChatId: null,
    currentPeer: null,
    unsub: null
};

export async function render() {
    const root = document.getElementById('view-root');
    root.innerHTML = `
  <div class="msg-layout card" id="msg-layout">
    <div class="conv-list" id="conv-list">Yükleniyor…</div>
    <div class="chat-pane" id="chat-pane">
      <div class="chat-top">
        <div class="chat-title">
          <img id="peer-avatar" src="assets/logo.png" class="avatar" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--line);object-fit:cover"/>
          <div>
            <div id="peer-name" style="font-weight:700">Sohbet seçin</div>
            <div style="font-size:12px;opacity:.8">
              <span id="peer-status"><span class="status"></span></span>
              <a id="peer-open" style="display:none;cursor:pointer;margin-left:6px;">Profili Gör</a>
            </div>
          </div>
        </div>
        <div>
          <button id="btn-back" class="btn alt" style="display:none">Geri</button>
        </div>
      </div>
      <div class="chat-body" id="chat-body">
        <div class="msg">Bir sohbet seçin.</div>
      </div>
      <div class="chat-send">
        <input id="msg-input" placeholder="Mesaj yazın…" />
        <button id="msg-send" class="btn">Gönder</button>
      </div>
    </div>
  </div>
`;

    onAuthStateChanged(auth, (u) => {
        if (!u) return;
        loadConversations(u.uid);
        document.getElementById('msg-send').onclick = () => sendMessage();
        document.getElementById('btn-back').onclick = () => showList();
    });
}

function compactMode(on) {
    const layout = document.getElementById('msg-layout');
    if (!layout) return;
    layout.classList.toggle('compact', !!on);
    document.getElementById('btn-back').style.display = on ? 'inline-block' : 'none';
}

function showList() {
    if (state.unsub) {
        state.unsub();
        state.unsub = null;
    }
    state.currentChatId = null;
    state.currentPeer = null;
    compactMode(false);
}

function chatIdFor(a, b) {
    return [a, b].sort().join('_');
}

function loadConversations(uid) {
    const list = document.getElementById('conv-list');
    onValue(ref(db, "chats"), (snap) => {
        const items = [];
        snap.forEach(ch => {
            const v = ch.val();
            if (v.participants && v.participants[uid]) items.push({ id: ch.key, ...v });
        });
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        list.innerHTML = "";
        if (!items.length) list.innerHTML = `<div class="conv-item">Henüz sohbet yok.</div>`;
        items.forEach(item => {
            const otherUid = Object.keys(item.participants).find(x => x !== uid);
            const el = document.createElement('div');
            el.className = 'conv-item';
            el.innerHTML = `
      <img class="avatar" id="ava-${item.id}" src="assets/logo.png"/>
      <div>
        <div class="name" id="name-${item.id}">${otherUid}</div>
        <div class="last">${item.lastMessage || 'Yeni sohbet'}</div>
      </div>`;
            el.onclick = () => openChat(item.id, otherUid);
            list.appendChild(el);

            onValue(ref(db, "users/" + otherUid), (uSnap) => {
                const u = uSnap.val() || {};
                const nameEl = document.getElementById('name-' + item.id);
                const avaEl = document.getElementById('ava-' + item.id);
                if (nameEl) nameEl.textContent = u.username || otherUid;
                if (avaEl && u.photoURL) avaEl.src = u.photoURL;
            });
        });
    });
}

function bindOnline(peerUid) {
    onValue(ref(db, "users/" + peerUid), (s) => {
        const u = s.val() || {};
        document.getElementById('peer-name').textContent = u.username || peerUid;
        const st = document.querySelector('.chat-title .status');
        st.classList.toggle('online', !!u.isOnline);
        document.getElementById('peer-open').style.display = 'inline-block';
        document.getElementById('peer-open').onclick = () => openProfile(peerUid);
        const avatar = document.getElementById('peer-avatar');
        if (u.photoURL) avatar.src = u.photoURL;
    });
}

// ✅ Sohbet sadece arkadaşla mümkündür
async function openChat(chatId, peerUid) {
    const me = auth.currentUser.uid;

    // Arkadaşlık kontrolü
    const friendSnap = await get(ref(db, `users/${me}/friends/${peerUid}`));
    if (!friendSnap.exists() || friendSnap.val() !== 'accepted') {
        alert("Bu kişiyle sohbet başlatabilmek için önce arkadaş olmalısınız.");
        return;
    }

    state.currentChatId = chatId;
    state.currentPeer = peerUid;
    compactMode(window.innerWidth <= 900);

    const body = document.getElementById('chat-body');
    body.innerHTML = "";
    bindOnline(peerUid);

    const cmRef = ref(db, "messages/" + chatId);
    if (state.unsub) {
        off(cmRef);
    }

    // 🔹 Tek dinleyici (çift mesaj hatasını engeller)
    state.unsub = () => off(cmRef);
    onChildAdded(cmRef, (snap) => renderMessage(snap.key, snap.val()));
    onChildChanged(cmRef, (snap) => renderMessage(snap.key, snap.val(), true));
}

function renderMessage(key, msg, changed = false) {
    const body = document.getElementById('chat-body');
    if (changed) {
        const existing = document.getElementById('msg-' + key);
        if (existing) {
            if (msg.deleted) {
                existing.querySelector('.text').textContent = 'Mesaj silindi';
                existing.querySelector('.menu')?.remove();
            }
            return;
        }
    }
    const div = document.createElement('div');
    div.className = "msg " + (msg.from === auth.currentUser.uid ? 'me' : '');
    div.id = 'msg-' + key;

    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.innerHTML = msg.deleted ? 'Mesaj silindi' : escapeHtml(msg.text || "");
    div.appendChild(textDiv);

    if (!msg.deleted && msg.from === auth.currentUser.uid) {
        const menuBtn = document.createElement('button');
        menuBtn.className = "btn alt menu";
        menuBtn.textContent = "⋮";
        menuBtn.style.float = "right";
        menuBtn.onclick = () => {
            const conf = confirm("Bu mesajı silmek istiyor musun?");
            if (conf) update(ref(db, `messages/${state.currentChatId}/${key}`), { deleted: true });
        };
        div.appendChild(menuBtn);
    }

    const meta = document.createElement('div');
    meta.className = "meta";
    meta.textContent = new Date(msg.createdAt || Date.now()).toLocaleString();
    div.appendChild(meta);

    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !state.currentChatId || !state.currentPeer) return;

    // Göndermeden önce tekrar kontrol et
    const friendSnap = await get(ref(db, `users/${auth.currentUser.uid}/friends/${state.currentPeer}`));
    if (!friendSnap.exists() || friendSnap.val() !== 'accepted') {
        alert("Arkadaş olmadığınız için mesaj gönderemezsiniz.");
        return;
    }

    const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await set(ref(db, `messages/${state.currentChatId}/${key}`), {
        from: auth.currentUser.uid,
        text,
        createdAt: Date.now(),
        edited: false,
        deleted: false
    });
    await update(ref(db, "chats/" + state.currentChatId), { lastMessage: text, updatedAt: Date.now() });
    input.value = "";
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
    );
}

function openProfile(uid) {
    window.viewProfile(uid);
}

// js/friends.js
const { auth, db } = window.Chatflix;
import { ref, onValue, get, set, update, remove } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export async function render() {
    const root = document.getElementById("view-root");
    root.innerHTML = `
    <div class="card">
      <div class="section-title">Arkadaşlar</div>
      <div class="tabs">
        <div class="tab active" data-tab="mine">Listem</div>
        <div class="tab" data-tab="requests">İstekler</div>
        <div class="tab" data-tab="blocked">Engellenenler</div>
        <div class="tab" data-tab="search">Kullanıcı Ara</div>
      </div>
      <div id="friends-content"></div>
    </div>
  `;
    document.querySelectorAll(".tab").forEach((el) => {
        el.onclick = () => {
            document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
            el.classList.add("active");
            loadTab(el.dataset.tab);
        };
    });
    loadTab("mine");
}

function loadTab(tab) {
    const c = document.getElementById("friends-content");
    if (tab === "mine") renderMine(c);
    if (tab === "requests") renderRequests(c);
    if (tab === "blocked") renderBlocked(c);
    if (tab === "search") renderSearch(c);
}

function userRow(u, uid, actions = []) {
    return `
    <div class="friend-row">
      <img class="avatar" src="${u.photoURL || 'assets/logo.png'}"
        style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid var(--line);cursor:pointer"
        data-uid="${uid}" />
      <div style="flex:1;cursor:pointer" data-uid="${uid}">
        <div style="font-weight:700">${u.username || 'Kullanıcı'}</div>
        ${u.about ? `<div style="opacity:.8">${u.about}</div>` : ''}
      </div>
      ${actions.join('')}
    </div>
  `;
}


function attachProfileClicks(container) {
    container.querySelectorAll("[data-uid]").forEach((el) => {
        el.addEventListener("click", (e) => {
            if (!e.target.closest("button")) {
                window.viewProfile(el.dataset.uid);
            }
        });
    });
}

function renderMine(c) {
    onValue(ref(db, "users/" + auth.currentUser.uid + "/friends"), async (s) => {
        const friends = s.val() || {};
        const rows = [];
        for (const fid of Object.keys(friends)) {
            if (friends[fid] !== "accepted") continue;
            const u = (await get(ref(db, "users/" + fid))).val() || {};
            rows.push(
                userRow(u, fid, [
                    `<button class="btn alt" data-act="open" data-uid="${fid}">Sohbet</button>`,
                    `<button class="btn ghost" data-act="remove" data-uid="${fid}">Arkadaşlıktan Çıkar</button>`,
                    `<button class="btn ghost" data-act="block" data-uid="${fid}">Engelle</button>`,
                ])
            );
        }
        c.innerHTML = rows.length ? rows.join("") : `<div class="friend-row">Arkadaş yok.</div>`;

        c.querySelectorAll('[data-act="open"]').forEach((b) =>
            b.addEventListener("click", async (e) => {
                e.stopPropagation();
                await openChatWith(b.dataset.uid);
            })
        );

        c.querySelectorAll('[data-act="remove"]').forEach((b) =>
            b.addEventListener("click", async (e) => {
                e.stopPropagation();
                await removeFriend(b.dataset.uid);
            })
        );

        c.querySelectorAll('[data-act="block"]').forEach((b) =>
            b.addEventListener("click", async (e) => {
                e.stopPropagation();
                await blockUser(b.dataset.uid);
            })
        );

        attachProfileClicks(c);
    });
}

function renderRequests(c) {
    onValue(ref(db, "users/" + auth.currentUser.uid + "/friends"), async (s) => {
        const map = s.val() || {};
        const rows = [];
        for (const uid of Object.keys(map)) {
            if (map[uid] !== "pending") continue;
            const u = (await get(ref(db, "users/" + uid))).val() || {};
            rows.push(
                userRow(u, uid, [
                    `<button class="btn" data-act="accept" data-uid="${uid}">Kabul</button>`,
                    `<button class="btn alt" data-act="decline" data-uid="${uid}">Reddet</button>`,
                ])
            );
        }

        c.innerHTML = rows.length ? rows.join("") : `<div class="friend-row">İstek yok.</div>`;

        c.querySelectorAll('[data-act="accept"]').forEach((b) => {
            b.onclick = async (e) => {
                e.stopPropagation();
                await acceptRequest(b.dataset.uid);
                renderRequests(c);
            };
        });

        c.querySelectorAll('[data-act="decline"]').forEach((b) => {
            b.onclick = async (e) => {
                e.stopPropagation();
                await declineRequest(b.dataset.uid);
                renderRequests(c);
            };
        });

        attachProfileClicks(c);
    });
}

function renderBlocked(c) {
    onValue(ref(db, "users/" + auth.currentUser.uid + "/friends"), async (s) => {
        const map = s.val() || {};
        const rows = [];
        for (const uid of Object.keys(map)) {
            if (map[uid] !== "blocked") continue;
            const u = (await get(ref(db, "users/" + uid))).val() || {};
            rows.push(userRow(u, uid, [`<button class="btn" data-act="unblock" data-uid="${uid}">Engeli Kaldır</button>`]));
        }
        c.innerHTML = rows.length ? rows.join("") : `<div class="friend-row">Engelli kullanıcı yok.</div>`;
        c.querySelectorAll('[data-act="unblock"]').forEach((b) =>
            b.addEventListener("click", async (e) => {
                e.stopPropagation();
                await unblockUser(b.dataset.uid);
            })
        );
        attachProfileClicks(c);
    });
}

async function renderSearch(c) {
    c.innerHTML = `
    <div class="grid">
      <input id="srch" placeholder="Kullanıcı adıyla ara…" />
      <div id="results"></div>
    </div>`;
    const input = c.querySelector("#srch");
    const results = c.querySelector("#results");

    input.addEventListener("input", async () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) {
            results.innerHTML = "";
            return;
        }

        const snapshot = await get(ref(db, "users"));
        const users = snapshot.val() || {};
        const myFriendsSnap = await get(ref(db, "users/" + auth.currentUser.uid + "/friends"));
        const myFriends = myFriendsSnap.val() || {};

        const matches = Object.entries(users)
            .filter(([uid, u]) => (u.username || "").toLowerCase().includes(q))
            .slice(0, 10);

        if (!matches.length) {
            results.innerHTML = `<div class="friend-row">Sonuç yok.</div>`;
            return;
        }

        results.innerHTML = matches
            .map(([uid, u]) => {
                if (uid === auth.currentUser.uid) return "";
                const isFriend = myFriends[uid] === "accepted";
                const isPending = myFriends[uid] === "pending" || myFriends[uid] === "requested";
                let btn = "";
                if (isFriend) btn = `<span class="tag">Arkadaş</span>`;
                else if (isPending) btn = `<span class="tag">Beklemede</span>`;
                else btn = `<button class="btn" data-act="add" data-uid="${uid}">Arkadaş Ekle</button>`;
                return userRow(u, uid, [btn]);
            })
            .join("");

        results.querySelectorAll('[data-act="add"]').forEach((b) =>
            b.addEventListener("click", (e) => {
                e.stopPropagation();
                sendRequest(b.dataset.uid);
            })
        );

        attachProfileClicks(results);
    });
}

// 🔧 İşlemler
async function sendRequest(toUid) {
    await update(ref(db, "users/" + auth.currentUser.uid + "/friends"), { [toUid]: "requested" });
    await update(ref(db, "users/" + toUid + "/friends"), { [auth.currentUser.uid]: "pending" });
    alert("İstek gönderildi.");
}

async function acceptRequest(fromUid) {
    await update(ref(db, "users/" + auth.currentUser.uid + "/friends"), { [fromUid]: "accepted" });
    await update(ref(db, "users/" + fromUid + "/friends"), { [auth.currentUser.uid]: "accepted" });
}

async function declineRequest(fromUid) {
    await remove(ref(db, "users/" + auth.currentUser.uid + "/friends/" + fromUid));
    await remove(ref(db, "users/" + fromUid + "/friends/" + auth.currentUser.uid));
}

async function blockUser(uid) {
    await update(ref(db, "users/" + auth.currentUser.uid + "/friends"), { [uid]: "blocked" });
}

async function unblockUser(uid) {
    await remove(ref(db, "users/" + auth.currentUser.uid + "/friends/" + uid));
}

// ❌ Arkadaşlıktan çıkar: hem ilişkileri hem sohbeti sil
async function removeFriend(uid) {
    await remove(ref(db, "users/" + auth.currentUser.uid + "/friends/" + uid));
    await remove(ref(db, "users/" + uid + "/friends/" + auth.currentUser.uid));

    const chatId = [auth.currentUser.uid, uid].sort().join("_");
    await remove(ref(db, "chats/" + chatId));
    await remove(ref(db, "messages/" + chatId));
}

// ✅ Sadece arkadaş olanlar sohbet edebilir
async function openChatWith(otherUid) {
    const me = auth.currentUser.uid;
    const friendRef = ref(db, "users/" + me + "/friends/" + otherUid);
    const snap = await get(friendRef);

    // Arkadaş değilse sohbet yok
    if (!snap.exists() || snap.val() !== "accepted") {
        alert("Bu kişiyle sohbet başlatabilmek için önce arkadaş olmalısınız.");
        return;
    }

    const chatId = [me, otherUid].sort().join("_");
    const s = await get(ref(db, "chats/" + chatId));
    if (!s.exists()) {
        await set(ref(db, "chats/" + chatId), {
            participants: { [me]: true, [otherUid]: true },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }
    history.replaceState({ route: "messages" }, "", "#/messages");
    (await import("./messages.js")).render();
}

function viewProfile(uid) {
    window.viewProfile(uid);
}

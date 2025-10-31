// js/profile-popup.js
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { db } = window.Chatflix;

window.Chatflix.showProfilePopup = async function (uid) {
    const s = await get(ref(db, "users/" + uid));
    const u = s.val();
    if (!u) return alert("Kullanıcı bulunamadı.");

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
    <div class="modal-card">
      <img src="${u.photoURL || 'assets/logo.png'}" class="avatar" />
      <div style="font-weight:700">${u.username}</div>
      <div style="opacity:.8">${u.email || ''}</div>
      <div style="margin-top:8px">${u.about || ''}</div>
      <div class="grid" style="margin-top:10px">
        <button class="btn alt" id="close-prof">Kapat</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById("close-prof").onclick = () => modal.remove();
};

// ========================================================
// ★★★ 全局函数定义区 (保证不 crash) ★★★
// ========================================================

// 1. 日志函数
window.log = function(msg) {
    const box = document.getElementById('screen-log');
    if(box) {
        box.innerHTML += `<div>> ${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    console.log(msg);
}

// 2. 错误捕获
window.onerror = function(message) {
    window.log(`❌ ERROR: ${message}`);
};

// 3. 安全更新 DOM (防止找不到元素报错)
window.safeSetText = function(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
    else window.log(`⚠️ Missing UI: #${id}`);
};

window.safeSetSrc = function(id, src) {
    const el = document.getElementById(id);
    if(el) el.src = src;
    else window.log(`⚠️ Missing UI: #${id}`);
};

// 4. 关键交互函数 (暴露给 HTML)
window.switchTab = (id) => {
    document.querySelectorAll('.page').forEach(p => {
        if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
        else if(p.id !== 'view-main') p.classList.remove('active');
    });
};

window.goBack = () => {
    document.getElementById('view-chat').classList.remove('active');
    setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
    document.getElementById('view-card').classList.remove('active');
    setTimeout(()=>document.getElementById('view-card').classList.add('right-sheet'), 300);
};

window.closeAll = () => {
    document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
    if(window.scanner) window.scanner.stop().catch(()=>{});
};

// ========================================================
// ★★★ 主逻辑 ★★★
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // ★★★ 替换 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    window.log("App Init...");

    // --- 1. 数据加载 ---
    const DB_KEY = 'pepe_v26_bulletproof';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        // 关键：检查 avatarSeed 是否存在，防止旧数据导致 null
        if(!db || !db.profile || !db.profile.avatarSeed) throw new Error("Data Upgrade");
        window.log("DB Loaded.");
    } catch(e) {
        window.log("Creating Fresh DB...");
        db = { 
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random() },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 渲染 UI (使用安全函数) ---
    safeSetText('my-id-display', MY_ID);
    safeSetText('card-id-text', MY_ID);
    // 使用默认头像防止 null
    const avatarUrl = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed || 'default'}`;
    safeSetSrc('my-avatar', avatarUrl);
    safeSetSrc('card-avatar', avatarUrl);

    // QR
    if(window.QRCode) {
        try {
            document.getElementById("qrcode").innerHTML = "";
            new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 50, height: 50 });
            document.querySelector(".qr-img").innerHTML = "";
            new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 80, height: 80 });
        } catch(e) { window.log("QR Gen Error (Ignored)"); }
    }

    // --- 3. 按钮绑定 (确保存在才绑定) ---
    const btnAdd = document.getElementById('add-id-btn');
    if(btnAdd) btnAdd.onclick = () => document.getElementById('add-overlay').classList.remove('hidden');

    const btnScan = document.getElementById('scan-btn');
    if(btnScan) btnScan.onclick = () => startScanner();

    const btnConfirm = document.getElementById('confirm-add-btn');
    if(btnConfirm) btnConfirm.onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAll();
            addFriend(id);
            openChat(id);
        } else { alert("ID Must be 4 digits"); }
    };

    const btnSend = document.getElementById('chat-send-btn');
    if(btnSend) btnSend.onclick = sendText;

    const btnSticker = document.getElementById('sticker-btn');
    if(btnSticker) btnSticker.onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // --- 4. 网络连接 ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) {
        window.log("⚠️ NO SERVER URL");
    } else {
        window.log("Connecting Socket...");
        try {
            socket = io(SERVER_URL);
            
            socket.on('connect', () => {
                window.log("Online!");
                safeSetText('conn-status', 'ONLINE');
                document.getElementById('conn-status').className = "status-badge green";
                socket.emit('register', MY_ID);
            });

            socket.on('receive_msg', (msg) => {
                window.log(`Msg from ${msg.from}`);
                saveMsg(msg.from, msg.content, false, msg.type);
                addFriend(msg.from);
                
                if(activeChatId === msg.from) {
                    appendMsg(msg.content, false, msg.type);
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
            });

        } catch(e) { window.log(`Socket Error: ${e.message}`); }
    }

    // --- 5. 辅助逻辑 ---
    function addFriend(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            renderFriends();
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">User ${f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        safeSetText('chat-partner-name', "User " + id);
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsg(m.content, m.isSelf, m.type));
    }

    function sendText() {
        const txt = document.getElementById('chat-input').value;
        if(txt) {
            if(socket && socket.connected) {
                socket.emit('send_private', { targetId: activeChatId, content: txt, type: 'text' });
            }
            saveMsg(activeChatId, txt, true, 'text');
            appendMsg(txt, true, 'text');
            document.getElementById('chat-input').value = '';
        }
    }

    function saveMsg(id, content, isSelf, type) {
        if(!db.history[id]) db.history[id] = [];
        db.history[id].push({ content, isSelf, type, ts: Date.now() });
        saveDB();
    }

    function appendMsg(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        if(type === 'text') div.innerHTML = `<div class="bubble">${content}</div>`;
        else if(type === 'sticker') div.innerHTML = `<img src="${content}" class="sticker-img">`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function startScanner() {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(!window.Html5Qrcode) return alert("Scanner Error");
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                window.closeAll();
                if(txt.length===4) {
                    addFriend(txt);
                    openChat(txt);
                } else { alert("Invalid Code"); }
            }).catch(e => {
                window.log("Cam Error");
                window.closeAll();
            });
        }, 500);
    }

    // Stickers
    const sGrid = document.querySelector('.sticker-grid');
    if(sGrid) {
        for(let i=0; i<8; i++) {
            const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*100}`;
            const img = document.createElement('img');
            img.src = url; img.className = 'sticker-item'; img.style.width='60px';
            img.onclick = () => {
                if(activeChatId) {
                    if(socket) socket.emit('send_private', { targetId: activeChatId, content: url, type: 'sticker' });
                    saveMsg(activeChatId, url, true, 'sticker');
                    appendMsg(url, true, 'sticker');
                    document.getElementById('sticker-panel').classList.add('hidden');
                }
            };
            sGrid.appendChild(img);
        }
    }

    renderFriends();
});

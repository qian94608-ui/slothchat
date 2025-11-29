// 全局日志函数，保证任何错误都能看到
window.log = function(msg) {
    const box = document.getElementById('screen-log');
    if(box) {
        box.innerHTML += `<div>> ${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    console.log(msg);
}

// 捕获全局错误
window.onerror = function(message, source, lineno, colno, error) {
    window.log(`❌ Error: ${message}`);
};

document.addEventListener('DOMContentLoaded', () => {
    
    // ===========================================
    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 
    // ===========================================

    window.log("App Started.");

    // --- 1. 数据层 (极简，防崩) ---
    const DB_KEY = 'pepe_v25_core_db';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Init DB");
        window.log("DB Loaded.");
    } catch(e) {
        window.log("Creating New DB...");
        db = { 
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), seed: Math.random() },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // 渲染ID
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.seed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 50, height: 50 });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 80, height: 80 });
    }

    // --- 2. 绑定 UI (直接暴露到 window，防止闭包卡死) ---
    window.switchTab = (id) => {
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) {
                p.classList.add('active');
                p.classList.remove('right-sheet');
            } else {
                if(p.id !== 'view-main') p.classList.remove('active');
            }
        });
    };

    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        document.getElementById('view-card').classList.remove('active');
        setTimeout(()=>document.getElementById('view-card').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    window.closeAll = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    window.resetApp = () => {
        if(confirm("Reset Everything?")) { localStorage.clear(); location.reload(); }
    };

    // 绑定按钮
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('scan-btn').onclick = () => startScanner();
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) {
            window.closeAll();
            addFriend(id);
            openChat(id);
        } else { alert("ID must be 4 digits"); }
    };
    document.getElementById('chat-send-btn').onclick = () => sendText();
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // --- 3. 网络层 ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) {
        window.log("⚠️ SERVER URL NOT SET!");
        alert("Please set SERVER_URL in app.js");
    } else {
        window.log("Connecting Socket...");
        try {
            socket = io(SERVER_URL);
            
            socket.on('connect', () => {
                window.log("Socket Connected!");
                document.getElementById('conn-status').innerText = "ONLINE";
                document.getElementById('conn-status').className = "status-badge green";
                socket.emit('register', MY_ID);
            });

            socket.on('connect_error', (err) => {
                window.log(`Connect Error: ${err.message}`);
                document.getElementById('conn-status').innerText = "ERR";
            });

            socket.on('disconnect', () => {
                window.log("Socket Disconnected");
                document.getElementById('conn-status').innerText = "OFFLINE";
                document.getElementById('conn-status').className = "status-badge red";
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

        } catch(e) { window.log(`Socket Crash: ${e.message}`); }
    }

    // --- 4. 逻辑 ---
    function addFriend(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            renderFriends();
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
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
        document.getElementById('chat-partner-name').innerText = "User " + id;
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
            // 网络
            if(socket && socket.connected) {
                socket.emit('send_private', { targetId: activeChatId, content: txt, type: 'text' });
            } else {
                window.log("Offline, saving locally");
            }
            // 本地
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

    // 扫码
    function startScanner() {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(!window.Html5Qrcode) return alert("Scanner Missing");
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                window.closeAll();
                if(txt.length===4) {
                    addFriend(txt);
                    openChat(txt);
                } else { alert("Invalid Code"); }
            }).catch(e => {
                window.log("Cam Error: " + e);
                alert("Camera Error");
                window.closeAll();
            });
        }, 500);
    }

    // 表情
    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<10; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*55}`;
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

    renderFriends();
});

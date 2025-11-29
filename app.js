document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 全局工具函数 (必须先定义) ---
    window.closeAll = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

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
        activeChatId = null;
    };

    window.resetApp = () => { if(confirm("Reset?")) { localStorage.clear(); location.reload(); } };

    // --- 2. 数据层 ---
    const DB_KEY = 'pepe_v28_db';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Init");
    } catch(e) {
        db = { 
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // UI Init
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        document.getElementById("qrcode").innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 50, height: 50 });
        document.querySelector(".qr-img").innerHTML = "";
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 80, height: 80 });
    }

    renderFriends();

    // --- 3. 业务逻辑 (修复点) ---

    // A. 扫码 (强行跳转)
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(!window.Html5Qrcode) return alert("Scanner Error");
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                // 成功
                scanner.stop().catch(()=>{});
                window.closeAll();
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);

                if(txt.length === 4) {
                    handleAddFriend(txt); // 核心：加好友并跳转
                } else { alert("Invalid Code"); }
            }).catch(e => { console.log(e); });
        }, 500);
    };

    // B. 手动添加 (强行跳转)
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAll();
            handleAddFriend(id);
            document.getElementById('manual-id-input').value = '';
        } else { alert("Must be 4 digits"); }
    };

    function handleAddFriend(id) {
        // 先加本地，不等网络
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB();
            renderFriends();
        }
        // 直接打开
        openChat(id);
    }

    // C. 修改昵称 (修复)
    window.editMyName = () => {
        const n = prompt("New Name:", db.profile.nickname);
        if(n) { db.profile.nickname = n; saveDB(); document.getElementById('my-nickname').innerText = n; }
    };
    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        const n = prompt("Rename Friend:", f.alias || f.id);
        if(n) { 
            f.alias = n; 
            saveDB(); 
            document.getElementById('chat-partner-name').innerText = n; 
            renderFriends(); 
        }
    };

    // --- 4. 聊天与网络 ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL);
        socket.on('connect', () => {
            document.getElementById('conn-status').innerText = "ONLINE";
            document.getElementById('conn-status').className = "status-badge green";
            socket.emit('register', MY_ID);
        });
        socket.on('disconnect', () => {
            document.getElementById('conn-status').innerText = "OFFLINE";
            document.getElementById('conn-status').className = "status-badge red";
        });
        socket.on('receive_msg', (msg) => {
            // 收到消息
            const fid = msg.from;
            if(!db.friends.find(f => f.id === fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
            }
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
            saveDB();
            renderFriends();

            if(activeChatId === fid) appendMsg(msg.content, false, msg.type);
            else document.getElementById('msg-sound').play().catch(()=>{});
        });
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${f.alias||f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsg(m.content, m.isSelf, m.type));
    }

    // 修复：输入框模式切换
    document.getElementById('mode-switch-btn').onclick = () => {
        document.getElementById('input-mode-text').classList.toggle('hidden');
        document.getElementById('input-mode-voice').classList.toggle('hidden');
    };

    document.getElementById('chat-send-btn').onclick = sendText;
    
    function sendText() {
        const txt = document.getElementById('chat-input').value;
        if(txt) {
            if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content: txt, type: 'text' });
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

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<8; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*100}`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
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
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    document.body.onclick = () => document.getElementById('msg-sound').load();
});

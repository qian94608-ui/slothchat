document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请替换为你自己的 Render URL ★★★
    // 例如: const SERVER_URL = 'https://wojak-server-xxxx.onrender.com';
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. ID 与 数据 ---
    const DB_KEY = 'wojak_cs_db';
    let db = JSON.parse(localStorage.getItem(DB_KEY));
    if (!db || !db.profile) {
        db = {
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random() },
            friends: [],
            history: {} 
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // UI Init
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 120, height: 120 });

    // --- 2. Socket.io 连接服务器 ---
    let socket = null;
    let activeChatId = null;
    const statusEl = document.getElementById('conn-status');

    if (SERVER_URL.includes('你的Render')) {
        alert("请先在 app.js 中配置你的 Render 服务器地址！");
    } else {
        // 连接服务器
        socket = io(SERVER_URL);

        socket.on('connect', () => {
            console.log("Connected to Server!");
            statusEl.innerText = "CONNECTED";
            statusEl.className = "status-badge green";
            
            // 上线登记
            socket.emit('register', MY_ID);
        });

        socket.on('disconnect', () => {
            statusEl.innerText = "DISCONNECTED";
            statusEl.className = "status-badge red";
        });

        // 接收消息 (在线或离线消息都会走这里)
        socket.on('receive_msg', (msg) => {
            // msg: { from, content, type, timestamp }
            handleIncomingMsg(msg);
        });

        // 消息发送状态回执
        socket.on('msg_status', (data) => {
            console.log('Message Status:', data);
            // 可以在这里更新UI显示“已送达”或“已缓存”
        });
    }

    // --- 3. 消息处理 ---
    function handleIncomingMsg(msg) {
        const friendId = msg.from;
        
        // 自动保存为好友 (如果不在列表)
        if (!db.friends.find(f => f.id === friendId)) {
            db.friends.push({ id: friendId, addedAt: Date.now() });
        }

        // 保存历史
        if (!db.history[friendId]) db.history[friendId] = [];
        db.history[friendId].push({
            type: msg.type,
            content: msg.content,
            isSelf: false,
            ts: msg.timestamp
        });
        saveDB();
        renderFriends();

        // 如果正在和这个人聊天，上屏
        if (activeChatId === friendId) {
            appendMsgDOM(msg.content, false, msg.type);
        } else {
            // 提示音
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    function sendText() {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if (txt && activeChatId && socket) {
            // 发送给服务器
            socket.emit('send_private', {
                targetId: activeChatId,
                content: txt,
                type: 'text'
            });

            // 本地存储并上屏
            const now = Date.now();
            if (!db.history[activeChatId]) db.history[activeChatId] = [];
            db.history[activeChatId].push({ type: 'text', content: txt, isSelf: true, ts: now });
            saveDB();
            appendMsgDOM(txt, true, 'text');
            
            input.value = '';
        }
    }

    // --- 4. UI 逻辑 ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.id}</div>
                    <div style="font-size:12px; color:green">SAVED</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        
        // 加载历史
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
    }

    function appendMsgDOM(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        if(type === 'text') div.innerHTML = `<div class="bubble">${content}</div>`;
        else if(type === 'sticker') div.innerHTML = `<img src="${content}" class="sticker-img">`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 按钮事件
    document.getElementById('chat-send-btn').onclick = sendText;
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 添加好友
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if (id.length === 4) {
            hideAllModals();
            if (!db.friends.find(f => f.id === id)) {
                db.friends.push({ id: id, addedAt: Date.now() });
                saveDB();
                renderFriends();
            }
            openChat(id);
        }
    };

    // 扫码
    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                hideAllModals();
                if(txt.length === 4) {
                    if (!db.friends.find(f => f.id === txt)) {
                        db.friends.push({ id: txt, addedAt: Date.now() });
                        saveDB();
                        renderFriends();
                    }
                    openChat(txt);
                }
            });
        }, 300);
    };

    // 表情
    const stickerGrid = document.getElementById('sticker-grid');
    ['crying','angry','happy','clown','chad'].forEach(s => {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-img'; img.style.width='60px';
        img.onclick = () => {
            if(activeChatId && socket) {
                socket.emit('send_private', { targetId: activeChatId, content: url, type: 'sticker' });
                // Save & Show Local
                if (!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({ type:'sticker', content:url, isSelf:true, ts: Date.now() });
                saveDB();
                appendMsgDOM(url, true, 'sticker');
                document.getElementById('sticker-panel').classList.add('hidden');
            }
        };
        stickerGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 页面逻辑
    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});

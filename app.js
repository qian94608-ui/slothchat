document.addEventListener('DOMContentLoaded', () => {

    // ========================================================
    // 1. 安全配置 (Safe Config)
    // ========================================================
    // 如果没有 Render，用这个公共测试服至少能让状态变绿
    const SERVER_URL = 'https://socket-io-chat.now.sh'; 
    const DB_KEY = 'pepe_v24_safe_db';

    // 全局函数：关闭所有弹窗
    window.closeAll = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    // ========================================================
    // 2. 优先绑定 UI (Binding UI First)
    // 即使后面报错，这些按钮也必须能用
    // ========================================================
    
    // 导航
    const navHome = document.getElementById('nav-home');
    const navCard = document.getElementById('nav-card');
    
    if(navHome) navHome.onclick = () => {
        document.getElementById('view-main').classList.add('active');
        document.getElementById('view-card').classList.remove('active');
        document.getElementById('view-chat').classList.remove('active');
    };
    
    if(navCard) navCard.onclick = () => {
        document.getElementById('view-card').classList.add('active');
        document.getElementById('view-card').classList.remove('right-sheet');
    };

    // Card Back
    const cardBack = document.getElementById('card-back-btn');
    if(cardBack) cardBack.onclick = () => {
        document.getElementById('view-card').classList.remove('active');
        setTimeout(() => document.getElementById('view-card').classList.add('right-sheet'), 300);
    };

    // Chat Back
    const chatBack = document.getElementById('chat-back-btn');
    if(chatBack) chatBack.onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
    };

    // 呼出添加
    const addBtn = document.getElementById('add-id-btn');
    if(addBtn) addBtn.onclick = () => document.getElementById('add-overlay').classList.remove('hidden');

    // 确认添加
    const confirmBtn = document.getElementById('confirm-add-btn');
    if(confirmBtn) confirmBtn.onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAll();
            addFriend(id);
            openChat(id);
        } else { alert("ID Must be 4 digits"); }
    };

    // 呼出扫码
    const scanBtn = document.getElementById('scan-btn');
    if(scanBtn) scanBtn.onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(startScanner, 500);
    };

    // 发送消息
    const sendBtn = document.getElementById('chat-send-btn');
    if(sendBtn) sendBtn.onclick = sendText;

    // 表情开关
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');


    // ========================================================
    // 3. 数据层 (Data Layer)
    // ========================================================
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { 
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), seed: Math.random() },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // 渲染个人信息
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.seed}`;
    
    // QR Code
    if(window.QRCode) {
        document.getElementById("qrcode").innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 50, height: 50 });
        document.querySelector(".qr-img").innerHTML = "";
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 80, height: 80 });
    }

    renderFriends();


    // ========================================================
    // 4. 业务逻辑 (Logic)
    // ========================================================
    
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
                <div>
                    <div style="font-weight:bold">User ${f.id}</div>
                    <div style="font-size:12px; color:green">SAVED</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    let activeChatId = null;
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
        if(txt && activeChatId) {
            // 网络发送
            if(socket && socket.connected) {
                socket.emit('message', { to: activeChatId, msg: txt, type: 'text' });
            }
            // 本地存储
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

    // 扫码器
    function startScanner() {
        if(!window.Html5Qrcode) return alert("Scanner Lib Missing");
        const scanner = new Html5Qrcode("qr-reader");
        window.scanner = scanner;
        scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
            document.getElementById('success-sound').play().catch(()=>{});
            window.closeAll();
            scanner.stop();
            if(txt.length===4) {
                addFriend(txt);
                openChat(txt);
            }
        }).catch(e => {
            console.log(e);
            alert("Camera Error. Please use ADD ID manually.");
            window.closeAll();
        });
    }

    // 表情加载
    const stickerGrid = document.querySelector('.sticker-grid');
    for(let i=0; i<10; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*100}`;
        const img = document.createElement('img');
        img.src = url; img.className = 'sticker-item';
        img.style.width = '60px';
        img.onclick = () => {
            if(activeChatId) {
                saveMsg(activeChatId, url, true, 'sticker');
                appendMsg(url, true, 'sticker');
                document.getElementById('sticker-panel').classList.add('hidden');
                // 发送网络
                if(socket) socket.emit('message', { to: activeChatId, msg: url, type: 'sticker' });
            }
        };
        stickerGrid.appendChild(img);
    }


    // ========================================================
    // 5. 网络层 (最后加载，崩了也不怕)
    // ========================================================
    let socket = null;
    try {
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

        socket.on('message', (data) => {
            // 收到消息
            document.getElementById('msg-sound').play().catch(()=>{});
            saveMsg(data.from, data.msg, false, data.type);
            addFriend(data.from); // 自动加好友
            
            if(activeChatId === data.from) {
                appendMsg(data.msg, false, data.type);
            }
        });

    } catch(e) { console.error("Socket Error", e); }

});

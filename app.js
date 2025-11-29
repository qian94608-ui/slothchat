document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // ★★★ 核心配置 (请填入你的 Render 地址) ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 
    const DB_KEY = 'pepe_v23_final_db';
    // =================================================================

    console.log("App Starting...");

    // --- 1. 数据层 (Model) ---
    // 负责数据的读取和存储，不依赖网络
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        // 数据校验，防止坏档
        if (!db || !db.profile || !db.friends) throw new Error("Data Corrupt");
    } catch(e) {
        console.log("Creating new DB...");
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), // 4位随机ID
                avatarSeed: Math.random(), 
                nickname: 'Anon' 
            },
            friends: [], 
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 界面初始化 (View) ---
    // 立即渲染，不等待任何东西
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    // 渲染二维码
    if(window.QRCode) {
        document.getElementById("qrcode").innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#388E3C", colorLight: "#FFFFFF" });
        const cardQr = document.querySelector(".qr-img");
        if(cardQr) {
            cardQr.innerHTML = "";
            new QRCode(cardQr, { text: MY_ID, width: 60, height: 60 });
        }
    }

    // 渲染好友列表
    renderFriends();

    // --- 3. 交互事件绑定 (Controller) ---
    // 必须在 DOMContentLoaded 立即绑定，确保点击有效

    // 全局弹窗关闭
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    // 导航切换 (Tab)
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.add('hidden'); 
                c.style.display = 'none'; // 强制隐藏
            });
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if(targetEl) {
                targetEl.classList.remove('hidden');
                targetEl.style.display = 'block'; // 强制显示
            }
        };
    });

    // 呼出添加框
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('manual-id-input').focus(), 100);
    };

    // 确认添加 (核心修复)
    document.getElementById('confirm-add-btn').onclick = () => {
        const input = document.getElementById('manual-id-input');
        const id = input.value.trim();
        
        if (id.length === 4) {
            window.closeAllModals();
            handleAddFriend(id); // 执行添加逻辑
            input.value = '';
        } else {
            alert("ID 必须是4位数字！");
        }
    };

    // 呼出扫码
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(startScanner, 300);
    };

    // 聊天相关
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    document.getElementById('chat-send-btn').onclick = sendTextMsg;
    
    // 模式切换
    document.getElementById('mode-switch-btn').onclick = () => {
        document.getElementById('input-mode-text').classList.toggle('hidden');
        document.getElementById('input-mode-voice').classList.toggle('hidden');
    };

    // --- 4. 网络层 (Network) ---
    // 异步启动，不阻塞 UI
    let socket = null;
    let activeChatId = null;

    if (!SERVER_URL.includes('http')) {
        alert("请在 app.js 中配置正确的 SERVER_URL");
    } else {
        console.log("Connecting to:", SERVER_URL);
        socket = io(SERVER_URL, { 
            reconnection: true,
            transports: ['websocket'] // 强制 WebSocket，更稳定
        });

        const statusEl = document.getElementById('conn-status');

        socket.on('connect', () => {
            console.log("Socket Connected!");
            statusEl.innerText = "ONLINE";
            statusEl.className = "status-pill green";
            socket.emit('register', MY_ID);
        });

        socket.on('disconnect', () => {
            console.log("Socket Disconnected");
            statusEl.innerText = "OFFLINE";
            statusEl.className = "status-pill red";
        });

        socket.on('connect_error', (err) => {
            console.log("Socket Error:", err);
        });

        socket.on('receive_msg', (msg) => {
            handleIncomingMsg(msg);
        });
    }

    // --- 5. 业务逻辑函数 ---

    function handleAddFriend(id) {
        // 乐观 UI：不管网络如何，先加到本地
        if (!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `Fren ${id}` });
            saveDB();
            renderFriends();
        }
        // 跳转聊天
        openChat(id);
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = ''; // 清空
        
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.alias || f.id}</div>
                    <div style="font-size:12px; color:green">SAVED</div>
                </div>
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
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    function sendTextMsg() {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if(txt) {
            sendData('text', txt);
            input.value = '';
        }
    }

    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
        
        // 1. 存本地
        const msgObj = { type, content, isSelf: true, ts: Date.now(), fileName };
        if (!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);

        // 2. 发网络 (如果通的话)
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type, fileName });
        } else {
            console.warn("Network offline, msg saved locally.");
        }
    }

    function handleIncomingMsg(msg) {
        const fid = msg.from;
        // 如果是新朋友，自动添加
        if (!db.friends.find(f => f.id === fid)) {
            db.friends.push({ id: fid, addedAt: Date.now(), alias: `Fren ${fid}` });
        }
        
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
            if(navigator.vibrate) navigator.vibrate(200);
        }
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        
        if (msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#bdfcc9':'#fff'}" onclick="new Audio('${msg.content}').play()">🎤 Voice Clip ▶</div>`;
        else if (msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img">`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 扫码核心逻辑
    function startScanner() {
        if(!window.Html5Qrcode) return alert("Scanner lib missing");
        
        const scanner = new Html5Qrcode("qr-reader");
        window.scanner = scanner;
        
        scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
            // 扫码成功
            document.getElementById('success-sound').play().catch(()=>{});
            if(navigator.vibrate) navigator.vibrate(200);
            
            scanner.stop().catch(()=>{});
            window.closeAllModals();
            
            if(txt.length === 4) {
                handleAddFriend(txt);
                alert("FOUND: " + txt);
            }
        }).catch(err => {
            console.error(err);
            alert("Camera Error: HTTPS required");
            window.closeAllModals();
        });
    }

    // 全局点击 (音频解锁)
    document.body.addEventListener('click', () => {
        document.getElementById('msg-sound').load();
        document.getElementById('success-sound').load();
    }, { once: true });

});

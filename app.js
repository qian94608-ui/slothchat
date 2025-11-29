document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. 本地存储管理 (Persistence System)
    // ==========================================
    const DB_KEY = 'wojak_data_v1';
    
    // 初始化或读取数据
    let db = JSON.parse(localStorage.getItem(DB_KEY)) || {
        profile: {
            id: 'Anon-' + crypto.randomUUID().split('-')[0].toUpperCase(), // 永久固定的ID
            avatarSeed: Math.random().toString()
        },
        friends: [], // [ {id: '...', addedAt: 123} ]
        history: {}  // { 'friendId': [ {type, content, isSelf, ts} ] }
    };
    
    // 立即保存一次以确保ID固定
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    saveDB(); // 确保初次生成的ID被写入

    const MY_ID = db.profile.id;
    let activeChatId = null;
    let connections = {};
    let peer = null;

    // UI: 显示我的信息
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    
    try {
        if(window.QRCode) {
            new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 80, height: 80 });
        }
    } catch(e){}

    // ==========================================
    // 2. 屏幕常亮与保活 (Wake Lock & Heartbeat)
    // ==========================================
    let wakeLock = null;
    const wakeStatus = document.getElementById('wake-status');

    // 请求屏幕常亮
    const requestWakeLock = async () => {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeStatus.innerText = "👁️ AWAKE (ON)";
            wakeStatus.className = "wake-badge on";
            console.log("Wake Lock active");
            
            wakeLock.addEventListener('release', () => {
                wakeStatus.innerText = "💤 Sleepy";
                wakeStatus.className = "wake-badge off";
                console.log("Wake Lock released");
            });
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
            wakeStatus.innerText = "❌ Error";
        }
    };

    // 点击切换保活状态
    wakeStatus.onclick = () => {
        if(wakeStatus.classList.contains('off')) {
            requestWakeLock();
        } else {
            if(wakeLock) wakeLock.release();
            wakeLock = null;
        }
    };

    // 自动重连心跳 (Keep-Alive Heartbeat)
    setInterval(() => {
        if(peer && !peer.destroyed) {
            db.friends.forEach(f => {
                // 如果连接不存在或断开，尝试重连
                if(!connections[f.id] || !connections[f.id].open) {
                    console.log('Heartbeat: Reconnecting to', f.id);
                    connectTo(f.id);
                } else {
                    // 如果连接存在，发送 ping 包保活
                    connections[f.id].send({type: 'ping'});
                }
            });
        } else if (peer && peer.disconnected) {
            peer.reconnect();
        }
    }, 5000); // 每5秒心跳

    // ==========================================
    // 3. 好友与聊天渲染 (Data Rendering)
    // ==========================================
    
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.id}</div>
                    <div style="font-size:12px; color:${isOnline?'green':'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function addFriend(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            renderFriends();
        }
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        
        // 渲染历史记录
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        // 推入历史记录 (Android/iOS 返回键支持)
        window.history.pushState({view: 'chat'}, '', '#chat');
        updateStatusDot(id);
    }
    
    // 监听返回键
    window.addEventListener('popstate', () => {
        document.getElementById('view-chat').classList.remove('active');
        activeChatId = null;
    });
    document.getElementById('chat-back-btn').onclick = () => window.history.back();

    function updateStatusDot(id) {
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }

    // ==========================================
    // 4. 网络层 (PeerJS)
    // ==========================================
    try {
        peer = new Peer(MY_ID);
        peer.on('open', () => {
            console.log('Peer ID:', MY_ID);
            // 上线后尝试连接所有已保存好友
            db.friends.forEach(f => connectTo(f.id));
        });
        peer.on('connection', setupConn);
        peer.on('error', err => console.log(err));
    } catch(e) {}

    function connectTo(id) {
        if(id === MY_ID) return;
        const conn = peer.connect(id);
        setupConn(conn);
    }

    function setupConn(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            // 自动添加陌生人为好友 (可选，方便测试)
            addFriend(conn.peer); 
            renderFriends();
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
        
        conn.on('data', d => {
            // 处理心跳
            if(d.type === 'ping') {
                renderFriends(); // 收到ping证明对方在线
                return; 
            }
            
            // 收到消息
            handleIncoming(conn.peer, d);
        });
        
        conn.on('close', () => {
            renderFriends();
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
    }

    // ==========================================
    // 5. 消息收发与存储
    // ==========================================
    
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const sound = document.getElementById('ping-sound');

    function saveMessage(friendId, content, type, isSelf) {
        if(!db.history[friendId]) db.history[friendId] = [];
        db.history[friendId].push({
            content, type, isSelf, ts: Date.now()
        });
        saveDB();
    }

    function sendText() {
        const txt = chatInput.value.trim();
        if(txt && activeChatId) {
            // 发送网络包
            if(connections[activeChatId] && connections[activeChatId].open) {
                connections[activeChatId].send({type: 'text', content: txt});
            }
            // 本地显示与存储
            saveMessage(activeChatId, txt, 'text', true);
            appendMsgDOM(txt, true, 'text');
            chatInput.value = '';
        }
    }

    function handleIncoming(senderId, data) {
        // 存储
        const content = data.type === 'sticker' ? data.url : data.content;
        saveMessage(senderId, content, data.type, false);
        
        // 如果正在聊天，直接上屏
        if(activeChatId === senderId) {
            appendMsgDOM(content, false, data.type);
        } else {
            // 否则播放声音提示
            sound.play().catch(()=>{});
            alert(`New message from ${senderId}`);
        }
    }

    function appendMsgDOM(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        
        if(type === 'text') {
            div.innerHTML = `<div class="bubble">${content}</div>`;
        } else if (type === 'sticker') {
            div.innerHTML = `<img src="${content}" class="sticker-img">`;
        }
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    sendBtn.onclick = sendText;
    chatInput.onkeypress = (e) => { if(e.key==='Enter') sendText(); };

    // ==========================================
    // 6. 弹窗与辅助逻辑
    // ==========================================
    const showModal = (id) => { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).style.display='flex'; };
    const hideModal = (id) => { document.getElementById(id).classList.add('hidden'); document.getElementById(id).style.display='none'; };
    window.hideAllModals = () => {
        hideModal('qr-overlay'); hideModal('add-overlay'); hideModal('sticker-panel');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    // 扫码逻辑
    document.getElementById('scan-btn').onclick = () => {
        showModal('qr-overlay');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                hideAllModals();
                addFriend(txt);
                connectTo(txt);
                openChat(txt);
            });
        }, 300);
    };

    document.getElementById('add-id-btn').onclick = () => showModal('add-overlay');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id) { addFriend(id); connectTo(id); hideAllModals(); openChat(id); }
    };

    // 表情包
    const stickerSeeds = ['crying', 'angry', 'happy', 'clown', 'chad', 'soy', 'doomer', 'cope'];
    const stickerGrid = document.getElementById('sticker-grid');
    document.getElementById('sticker-btn').onclick = () => {
        const p = document.getElementById('sticker-panel');
        if(p.style.display==='none') { p.classList.remove('hidden'); p.style.display='block'; }
        else { p.classList.add('hidden'); p.style.display='none'; }
    };
    stickerSeeds.forEach(seed => {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}&backgroundColor=transparent`;
        const img = document.createElement('img');
        img.src = url;
        img.className = 'sticker-item sticker-img';
        img.onclick = () => {
            if(activeChatId && connections[activeChatId]) {
                connections[activeChatId].send({type:'sticker', url:url});
                saveMessage(activeChatId, url, 'sticker', true);
                appendMsgDOM(url, true, 'sticker');
                document.getElementById('sticker-panel').style.display='none';
            }
        };
        stickerGrid.appendChild(img);
    });

    // 导航切换
    const tabBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-tab'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        };
    });

    // 初始化显示
    renderFriends();
    
    // 全局点击解锁音频
    document.body.onclick = () => sound.load();
});

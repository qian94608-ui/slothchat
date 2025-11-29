document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ID 系统 (加盐前缀) ---
    // 我们的应用前缀，防止跟公共服务器其他应用冲突
    const APP_PREFIX = 'wojak-v10-';
    const DB_KEY = 'wojak_v10_db';

    let db = JSON.parse(localStorage.getItem(DB_KEY));
    
    // 强制生成4位数字ID
    if (!db || !db.profile || db.profile.id.length > 4 || isNaN(db.profile.id)) {
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), // 4位纯数字
                avatarSeed: Math.random() 
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // 显示给用户的 ID (4位)
    const DISPLAY_ID = db.profile.id;
    // 实际连接用的 ID (前缀+4位)
    const REAL_PEER_ID = APP_PREFIX + DISPLAY_ID;

    // UI 显示
    document.getElementById('my-id-display').innerText = DISPLAY_ID;
    document.getElementById('card-id-text').innerText = DISPLAY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    
    // 生成二维码 (内容是4位数字，对方扫码也是拿到4位)
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: DISPLAY_ID, width: 120, height: 120 });
    }

    // --- 2. 状态变量 ---
    let activeChatId = null;
    let connections = {}; // 存储 connection 对象
    let peer = null;


    // --- 3. 网络层 (PeerJS) ---
    const netStatus = document.getElementById('net-status');

    try {
        peer = new Peer(REAL_PEER_ID); // 使用带前缀的ID注册

        peer.on('open', (id) => {
            console.log('My Real ID:', id);
            netStatus.innerText = "CONNECTED: " + DISPLAY_ID;
            netStatus.style.background = "green";
            // 上线后重连所有好友
            reconnectAll();
        });

        peer.on('connection', (conn) => {
            handleConnection(conn);
        });

        peer.on('error', (err) => {
            console.log(err);
            if(err.type === 'peer-unavailable') {
                // 对方不在线，不报错，静默处理
            } else {
                netStatus.innerText = "ERR: " + err.type;
                netStatus.style.background = "red";
            }
        });

    } catch(e) { console.error(e); }

    function connectTo(shortId) {
        if(shortId === DISPLAY_ID) return;
        // 连接时，必须加上前缀
        const fullId = APP_PREFIX + shortId;
        console.log('Connecting to:', fullId);
        const conn = peer.connect(fullId);
        handleConnection(conn);
    }

    function handleConnection(conn) {
        conn.on('open', () => {
            // 获取对方的短 ID (去掉前缀)
            const remoteShortId = conn.peer.replace(APP_PREFIX, '');
            console.log('Connected to:', remoteShortId);
            
            connections[remoteShortId] = conn;

            // ★ 核心修复：自动握手逻辑 ★
            // 1. 发送 handshake
            conn.send({ type: 'handshake', from: DISPLAY_ID });
            
            // 2. 如果对方不在我列表里 (我是被动连接方)，自动加他
            addFriendLocal(remoteShortId);
            
            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('data', (d) => {
            const remoteShortId = conn.peer.replace(APP_PREFIX, '');
            
            if(d.type === 'handshake') {
                // 收到握手，说明链路通了
                addFriendLocal(d.from); // 确保加上对方
                renderFriends(); // 刷新列表变绿
            }
            else if(d.type === 'text') {
                saveMessage(remoteShortId, d.content, 'text', false);
                if(activeChatId === remoteShortId) {
                    appendMsgDOM(d.content, false, 'text');
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
            }
            else if(d.type === 'sticker') {
                saveMessage(remoteShortId, d.url, 'sticker', false);
                if(activeChatId === remoteShortId) {
                    appendMsgDOM(d.url, false, 'sticker');
                }
            }
        });

        conn.on('close', () => {
            const remoteShortId = conn.peer.replace(APP_PREFIX, '');
            delete connections[remoteShortId];
            renderFriends();
            updateChatStatus(remoteShortId);
        });
    }

    function reconnectAll() {
        db.friends.forEach(f => {
            if(!connections[f.id] || !connections[f.id].open) {
                connectTo(f.id);
            }
        });
    }
    // 心跳包：每3秒尝试重连
    setInterval(reconnectAll, 3000);


    // --- 4. 业务逻辑 (好友与消息) ---
    function addFriendLocal(id) {
        // 过滤非法ID
        if(!id || id.length !== 4 || isNaN(id)) return;
        
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
        }
    }

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
                    <div style="font-size:12px; font-weight:bold; color:${isOnline?'green':'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = "Fren: " + id;
        
        // CSS 切换页面
        document.getElementById('view-chat').classList.add('active'); // 移动进来
        document.getElementById('view-chat').classList.remove('right-sheet'); // 移除初始偏移动画类
        
        // 渲染历史
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        updateChatStatus(id);
    }
    
    // 修复：明确的返回逻辑
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        // 延迟一点加回样式，防止动画闪烁
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 200);
        activeChatId = null;
    };

    function updateChatStatus(id) {
        if(activeChatId !== id) return;
        const isOnline = connections[id] && connections[id].open;
        const dot = document.getElementById('chat-status-dot');
        dot.className = isOnline ? 'status-square online' : 'status-square';
    }

    function saveMessage(fid, content, type, isSelf) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type, content, isSelf, ts: Date.now() });
        saveDB();
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

    // 发送消息
    document.getElementById('chat-send-btn').onclick = () => {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if(txt && activeChatId) {
            if(connections[activeChatId]) connections[activeChatId].send({type:'text', content:txt});
            saveMessage(activeChatId, txt, 'text', true);
            appendMsgDOM(txt, true, 'text');
            input.value = '';
        }
    };
    
    // 清空聊天
    document.getElementById('clear-chat-btn').onclick = () => {
        if(confirm("Delete history?")) {
            db.history[activeChatId] = [];
            saveDB();
            document.getElementById('messages-container').innerHTML = '';
        }
    }


    // --- 5. UI 交互 (扫码与弹窗) ---
    const hideAllModals = () => {
        document.getElementById('qr-overlay').classList.add('hidden');
        document.getElementById('add-overlay').classList.add('hidden');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    }
    window.hideAllModals = hideAllModals;

    // 扫码逻辑
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                // 扫到结果
                hideAllModals();
                if(txt.length === 4) {
                    alert("FOUND: " + txt);
                    addFriendLocal(txt);
                    connectTo(txt);
                    openChat(txt);
                } else {
                    alert("Invalid ID (Must be 4 digits)");
                }
            });
        }, 300);
    };

    // 手动添加
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id.length === 4) {
            hideAllModals();
            addFriendLocal(id);
            connectTo(id);
            openChat(id);
        }
    };

    // Tab 切换
    const tabs = ['tab-friends', 'tab-identity'];
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.target;
            tabs.forEach(t => {
                const el = document.getElementById(t);
                if(t === target) {
                    el.classList.remove('hidden');
                    el.style.display = 'block';
                } else {
                    el.classList.add('hidden');
                    el.style.display = 'none';
                }
            });
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    });
    
    // 表情包
    const stickerSeeds = ['crying', 'angry', 'happy', 'clown', 'chad', 'soy', 'doomer', 'cope'];
    const stickerGrid = document.getElementById('sticker-grid');
    document.getElementById('sticker-btn').onclick = () => {
        const p = document.getElementById('sticker-panel');
        p.classList.toggle('hidden');
    };
    stickerSeeds.forEach(seed => {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}&backgroundColor=transparent`;
        const img = document.createElement('img');
        img.src = url;
        img.className = 'sticker-item sticker-img';
        img.style.width = '60px';
        img.onclick = () => {
            if(activeChatId && connections[activeChatId]) {
                connections[activeChatId].send({type:'sticker', url:url});
                saveMessage(activeChatId, url, 'sticker', true);
                appendMsgDOM(url, true, 'sticker');
                document.getElementById('sticker-panel').classList.add('hidden');
            }
        };
        stickerGrid.appendChild(img);
    });

    // 初始化
    renderFriends();
    // 隐藏 Identity tab
    document.getElementById('tab-identity').classList.add('hidden');
    document.getElementById('tab-identity').style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {

    // --- 0. 日志系统 ---
    const debugEl = document.getElementById('debug-console');
    function log(msg) {
        if (!debugEl) return;
        const line = document.createElement('div');
        line.innerText = `> ${msg}`;
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
        console.log(msg);
    }

    // --- 1. ID 系统 (4位纯数字) ---
    const PREFIX = 'wojak-v13-'; 
    const DB_KEY = 'wojak_v13_db';

    let db = JSON.parse(localStorage.getItem(DB_KEY));
    if (!db || !db.profile || db.profile.id.length !== 4) {
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), 
                avatarSeed: Math.random() 
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    const MY_ID_SHORT = db.profile.id;
    const MY_ID_FULL = PREFIX + MY_ID_SHORT;

    // UI 显示
    document.getElementById('my-id-display').innerText = MY_ID_SHORT;
    document.getElementById('card-id-text').innerText = MY_ID_SHORT;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID_SHORT, width: 120, height: 120 });

    log(`Init ID: ${MY_ID_SHORT}`);

    // --- 2. 网络配置 (关键修复：STUN + TURN) ---
    // 使用 OpenRelay 的免费层级（如果有条件建议自己搭建 Coturn）
    const PEER_CONFIG = {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
                // 下面是 OpenRelay 的免费 TURN (Project OpenRelay)
                { 
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                { 
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                { 
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ],
            sdpSemantics: 'unified-plan'
        }
    };

    // --- 3. 连接管理 (单向连接逻辑) ---
    let activeChatId = null;
    let connections = {}; 
    let peer = null;

    try {
        peer = new Peer(MY_ID_FULL, PEER_CONFIG);

        peer.on('open', (id) => {
            log(`Server OK. Ready.`);
            document.getElementById('my-status').innerText = "ONLINE";
            document.getElementById('my-status').className = "status-badge green";
            attemptConnections(); // 启动连接循环
        });

        // 被动接收连接
        peer.on('connection', (conn) => {
            handleConnection(conn, 'INCOMING');
        });

        peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                // 对方掉线，忽略
            } else if (err.type === 'disconnected') {
                log("Disconnected. Reconnecting...");
                peer.reconnect();
            } else {
                log(`Err: ${err.type}`);
            }
        });

    } catch(e) { log("Peer Init Failed"); }

    // ★ 核心逻辑：谁负责发起连接？ ★
    // 规则：ID 小的 连 ID 大的。
    // 如果我 ID 是 1000，对方是 2000 -> 我连他。
    // 如果我 ID 是 2000，对方是 1000 -> 我等他连我。
    // 这避免了 "Negotiation failed"（两个人都同时拨号占线）。
    
    function shouldIConnect(theirShortId) {
        const myVal = parseInt(MY_ID_SHORT);
        const theirVal = parseInt(theirShortId);
        return myVal < theirVal;
    }

    function attemptConnections() {
        if (!peer || peer.destroyed) return;

        db.friends.forEach(f => {
            const shortId = f.id;
            
            // 如果已经连接，跳过
            if (connections[shortId] && connections[shortId].open) return;

            // 只有当我ID比对方小时，我才主动发起
            if (shouldIConnect(shortId)) {
                log(`Dialing ${shortId} (I am smaller)...`);
                const conn = peer.connect(PREFIX + shortId, {
                    reliable: false, // 使用 UDP，穿透更好
                    serialization: 'json'
                });
                handleConnection(conn, 'OUTGOING');
            } else {
                // 否则我什么都不做，等待对方连我 (Listen Mode)
                // log(`Waiting for ${shortId} (I am bigger)...`);
            }
        });
    }
    
    // 心跳轮询 (每5秒检查一次)
    setInterval(attemptConnections, 5000);


    // --- 4. 连接处理 ---
    function handleConnection(conn, type) {
        const remoteShortId = conn.peer.replace(PREFIX, '');

        // 无论出入，一旦 open 就是成功
        conn.on('open', () => {
            log(`LINK ESTABLISHED: ${remoteShortId}`);
            
            // 存入连接池
            connections[remoteShortId] = conn;
            
            // 确保好友在列表
            addFriendLocal(remoteShortId);
            
            // 发送握手确认
            conn.send({ type: 'SYN', from: MY_ID_SHORT });
            
            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('data', (d) => {
            if (d.type === 'SYN') {
                // 收到握手，回一个 ACK
                conn.send({ type: 'ACK', from: MY_ID_SHORT });
                addFriendLocal(d.from);
                renderFriends();
            }
            else if (d.type === 'ACK') {
                // 握手完成
                renderFriends();
                updateChatStatus(d.from);
            }
            else if (d.type === 'text') {
                handleIncomingMsg(remoteShortId, d.content, 'text');
            }
            else if (d.type === 'sticker') {
                handleIncomingMsg(remoteShortId, d.url, 'sticker');
            }
        });

        conn.on('close', () => {
            log(`Closed: ${remoteShortId}`);
            delete connections[remoteShortId];
            renderFriends();
            updateChatStatus(remoteShortId);
        });

        conn.on('error', (err) => {
            log(`ConnErr ${remoteShortId}: ${err}`);
            delete connections[remoteShortId];
        });
    }


    // --- 5. 业务逻辑 (好友/消息) ---
    function addFriendLocal(id) {
        if (!id || id.length !== 4) return;
        if (!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now() });
            saveDB();
            log(`New Friend Saved: ${id}`);
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            
            const statusColor = isOnline ? '#00FF00' : '#FF0000';
            const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
            
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${f.id}</div>
                    <div style="font-size:12px; font-weight:bold; color:${statusColor}">${statusText}</div>
                </div>
            `;
            
            // 长按删除
            div.oncontextmenu = (e) => {
                e.preventDefault();
                if(confirm(`Delete ${f.id}?`)) {
                    db.friends = db.friends.filter(x => x.id !== f.id);
                    saveDB();
                    renderFriends();
                }
            };
            
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        updateChatStatus(id);
    }

    function updateChatStatus(id) {
        if(activeChatId !== id) return;
        const isOnline = connections[id] && connections[id].open;
        const dot = document.getElementById('chat-status-dot');
        dot.className = isOnline ? 'status-square online' : 'status-square';
    }

    function handleIncomingMsg(id, content, type) {
        if(!db.history[id]) db.history[id] = [];
        db.history[id].push({ type, content, isSelf: false, ts: Date.now() });
        saveDB();

        if(activeChatId === id) {
            appendMsgDOM(content, false, type);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
            log(`Msg from ${id}`);
        }
    }

    function sendText() {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if(txt && activeChatId) {
            const conn = connections[activeChatId];
            if(conn && conn.open) {
                conn.send({ type: 'text', content: txt });
                
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({ type:'text', content:txt, isSelf:true, ts: Date.now() });
                saveDB();
                
                appendMsgDOM(txt, true, 'text');
                input.value = '';
            } else {
                alert("OFFLINE. Wait for green light.");
                // 可以在这里强制尝试连接
                if(shouldIConnect(activeChatId)) connectTo(activeChatId);
            }
        }
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

    // --- 6. UI 绑定 ---
    document.getElementById('chat-send-btn').onclick = sendText;
    document.getElementById('chat-input').onkeypress = (e) => { if(e.key==='Enter') sendText(); };
    
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    }

    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            hideAllModals();
            addFriendLocal(id);
            // 立即触发一次尝试
            attemptConnections(); 
            openChat(id);
        } else { alert("ID must be 4 digits"); }
    };

    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                hideAllModals();
                document.getElementById('scan-sound').play().catch(()=>{});
                if(txt.length === 4) {
                    addFriendLocal(txt);
                    attemptConnections();
                    openChat(txt);
                }
            });
        }, 300);
    };

    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    // Stickers
    const stickerGrid = document.getElementById('sticker-grid');
    if(stickerGrid) {
        ['crying', 'angry', 'happy', 'clown', 'chad'].forEach(s => {
            const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${s}`;
            const img = document.createElement('img');
            img.src = url; img.className = 'sticker-img'; img.style.width='60px';
            img.onclick = () => {
                if(activeChatId && connections[activeChatId] && connections[activeChatId].open) {
                    connections[activeChatId].send({type:'sticker', url:url});
                    if(!db.history[activeChatId]) db.history[activeChatId] = [];
                    db.history[activeChatId].push({ type:'sticker', content:url, isSelf:true, ts: Date.now() });
                    saveDB();
                    appendMsgDOM(url, true, 'sticker');
                    document.getElementById('sticker-panel').classList.add('hidden');
                }
            };
            stickerGrid.appendChild(img);
        });
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});

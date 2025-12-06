document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (UI 风格化统一 + 自适应修复) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { 
            --glass-bg: rgba(255, 255, 255, 0.95); 
            --primary: #59BC10; 
            --primary-dark: #46960C; 
            --danger: #FF3B30; 
            --shadow-soft: 0 4px 20px rgba(0,0,0,0.06);
            --shadow-card: 0 2px 6px rgba(0,0,0,0.04);
            --bg-color: #F5F7F5;
        }
        body { background: var(--bg-color); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 30px !important; }
        
        /* 列表项 (仿 iOS 质感) */
        .k-list-item { 
            background: #fff; border-radius: 16px; padding: 12px 16px; margin-bottom: 12px; 
            box-shadow: var(--shadow-card); transition: transform 0.1s; position: relative; border: 1px solid rgba(0,0,0,0.02);
        }
        .k-list-item:active { transform: scale(0.98); background: #fafafa; }
        .list-edit-btn { padding: 8px; color: #ccc; font-size: 16px; cursor: pointer; z-index: 10; margin-left: auto; transition: color 0.2s; }
        .list-edit-btn:hover { color: var(--primary); }

        /* 拨号盘 */
        .numpad-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
        .id-display-screen { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: var(--primary); margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; width: 80%; text-align: center; height: 50px; line-height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 260px; }
        .num-btn { width: 65px; height: 65px; border-radius: 50%; background: #fff; box-shadow: 0 4px 0 #f0f0f0; border: 1px solid #eee; font-size: 24px; font-weight: bold; color: #333; display: flex; justify-content: center; align-items: center; cursor: pointer; user-select: none; }
        .num-btn:active { transform: translateY(3px); box-shadow: none; background: #f9f9f9; }
        .num-btn.clear { color: var(--danger); font-size: 18px; }
        .num-btn.connect { background: var(--primary); color: #fff; border: none; box-shadow: 0 4px 10px rgba(89, 188, 16, 0.3); font-size: 30px; }
        .num-btn.connect:active { background: var(--primary-dark); }

        /* 气泡与媒体 */
        .bubble { 
            border: none !important; border-radius: 18px !important; padding: 10px 14px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 80%; width: fit-content;
        }
        .msg-row.self .bubble { background: var(--primary); color: #fff; border-bottom-right-radius: 4px !important; }
        .msg-row.other .bubble { background: #fff; color: #333; border-bottom-left-radius: 4px !important; }
        
        .thumb-box { position: relative; display: inline-block; max-width: 200px; border-radius: 12px; overflow: hidden; background: #000; }
        .thumb-img { max-width: 100%; height: auto; display: block; object-fit: contain; }
        video.thumb-img { object-fit: cover; max-height: 200px; }
        
        /* ★ 表情包样式 ★ */
        .sticker-img { width: 100px !important; height: 100px !important; object-fit: contain !important; display: block; margin: 5px 0; }
        
        /* ★ 文档卡片 (自适应修复) ★ */
        .doc-card { 
            display: flex; align-items: center; gap: 10px; 
            background: rgba(255,255,255,0.15); /* 半透明背景适应深色气泡 */
            padding: 8px 12px; border-radius: 8px; 
            color: inherit; text-decoration: none; 
            min-width: 160px; max-width: 100%;
        }
        .msg-row.other .doc-card { background: #f5f5f5; color: #333; }
        .doc-icon { font-size: 24px; flex-shrink: 0; }
        .doc-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; min-width: 0; }
        .doc-name { 
            font-weight: 600; font-size: 13px; margin-bottom: 2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
        }
        .doc-type { font-size: 9px; opacity: 0.8; text-transform: uppercase; font-weight: 600; }

        .voice-bubble { display: flex; align-items: center; gap: 8px; min-width: 100px; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; }
        .wave-bar { width: 3px; height: 30%; background: rgba(255,255,255,0.5); border-radius: 2px; }
        .msg-row.other .wave-bar { background: #ccc; }
        .voice-bubble.playing .wave-bar { animation: wave 0.5s infinite ease-in-out; background: #fff !important; }
        .voice-bubble.other.playing .wave-bar { background: var(--primary) !important; }
        @keyframes wave { 0%,100%{height:30%;} 50%{height:100%;} }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        
        .audio-player { display: flex; align-items: center; gap: 8px; min-width: 140px; }
        .audio-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255,255,255,0.25); color: inherit; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 12px; }
        .msg-row.other .audio-btn { background: #eee; color: #333; }

        .edit-pen { margin-left: 8px; cursor: pointer; font-size: 14px; opacity: 0.7; }
        .cancel-btn { position: absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-size:12px; cursor:pointer; z-index:10; }
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(5px); }
        .modal-header { background: var(--primary) !important; color: #fff; border:none; }
        .close-x { color: #fff !important; background: rgba(0,0,0,0.2) !important; }
        .modal-box { border-radius: 20px; overflow: hidden; border: none; }
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
        
        .lan-badge { background: #E8F5E9; color: #2E7D32; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #A5D6A7; display: none; margin-left: 5px; }
        .lan-badge.active { display: inline-block; }
    `;
    document.head.appendChild(styleSheet);

    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:99999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:100000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px;">✕</button>
        <a id="preview-download-btn" href="#" download style="position:absolute; top:40px; right:80px; z-index:100000; background:var(--primary); color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; text-decoration:none;">⬇</a>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v48_ui_final';
    const CHUNK_SIZE = 12 * 1024;
    let db;
    
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};
    let uploadQueue = [];
    let globalAudio = null;
    let peerConnection = null;
    let dataChannel = null;
    let isP2PReady = false;

    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 核心 UI 函数 ---

    const renderFriends = () => {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            let nameHtml = `
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-weight:bold; font-size:16px; color:#333;">${f.alias || f.id}</div>
                    <div class="list-edit-btn" onclick="event.stopPropagation(); window.editContactAlias('${f.id}')">✎</div>
                </div>`;
            if(f.unread) nameHtml = `<div style="display:flex;align-items:center;gap:6px;"><div style="font-weight:bold;color:#333;">${f.alias||f.id}</div><div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div></div>`;
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:48px; height:48px; border-radius:50%; background:#f2f2f2; border:1px solid #eee;">
                    <div style="flex:1;">${nameHtml}<div style="font-size:12px; color:#888; margin-top:2px;">${f.unread ? '<span style="color:var(--danger)">● New Message</span>' : 'Tap to chat'}</div></div>
                </div>`;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    };

    window.editContactAlias = (fid) => {
        const f = db.friends.find(x => x.id === fid);
        if(f) { const n = prompt("Set Alias for " + fid, f.alias || fid); if(n) { f.alias = n; saveDB(); renderFriends(); } }
    };

    const appendMsgDOM = (msg, isSelf) => {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); 
        div.className = `msg-row ${isSelf?'self':'other'}`;
        const uid = Date.now() + Math.random().toString().substr(2,5); 
        let html = '';

        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<div style="padding:0;"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type==='voice') {
            html=`<div class="bubble audio-player"><span>🎤</span><button class="audio-btn" onclick="handleAudio('play','${msg.content}')">▶</button><button class="audio-btn" onclick="handleAudio('pause')">⏸</button><button class="audio-btn" onclick="handleAudio('stop')">⏹</button></div>`;
        } 
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type==='video') html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-size:30px;">▶</div></div></div>`;
        else if(msg.type==='file') {
            // ★ 自适应文档卡片 ★
            const lowerName = msg.fileName.toLowerCase();
            let icon = '📄';
            if(lowerName.match(/\.(doc|docx)$/)) icon = '📝';
            else if(lowerName.match(/\.(xls|xlsx|csv)$/)) icon = '📊';
            else if(lowerName.match(/\.(ppt|pptx)$/)) icon = '📉';
            else if(lowerName.match(/\.pdf$/)) icon = '📕';
            else if(lowerName.match(/\.zip|rar|7z$/)) icon = '📦';

            html = `
                <div class="bubble" style="padding:5px;">
                    <a class="doc-card" href="${msg.content}" download="${msg.fileName}">
                        <div class="doc-icon">${icon}</div>
                        <div class="doc-info">
                            <div class="doc-name">${msg.fileName}</div>
                            <div class="doc-type">CLICK TO SAVE</div>
                        </div>
                    </a>
                </div>`;
        }
        
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    };

    const sendData = (type, content) => {
        if(!activeChatId) { alert("Open chat first!"); return; }
        if (isP2PReady && dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify({ type, content })); 
                const msgObj = { type, content, isSelf: true, ts: Date.now() };
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(msgObj); saveDB(); appendMsgDOM(msgObj, true);
                return;
            } catch(e) {}
        }
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type });
        } else {
            alert("Connecting..."); return;
        }
        const msgObj = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj); saveDB(); appendMsgDOM(msgObj, true);
    };

    const closeChatUI = () => {
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('active');
        setTimeout(() => chatView.classList.add('right-sheet'), 300);
        activeChatId = null;
        if(peerConnection) { peerConnection.close(); peerConnection = null; isP2PReady = false; }
        renderFriends();
    };

    window.goBack = () => { 
        if (window.history.state && window.history.state.chatOpen) {
            window.history.back();
        } else {
            closeChatUI();
        }
    };

    const openChat = (id) => {
        try { if('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch(e){}
        activeChatId = id; 
        const f = db.friends.find(x => x.id === id);
        
        document.getElementById('chat-partner-name').innerHTML = `${f.alias || f.id} <span class="edit-pen" onclick="event.stopPropagation(); window.editFriendName()">✎</span> <span id="lan-badge" class="lan-badge">⚡ LAN</span>`;
        document.getElementById('chat-online-dot').className = "status-dot red";
        
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        
        window.history.pushState({ chatOpen: true, id: id }, "");

        const container = document.getElementById('messages-container'); 
        container.innerHTML = '';
        const msgs = db.history[id] || []; 
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));

        initP2P(id, true);
    };

    const handleAddFriend = (id) => {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB(); renderFriends();
        }
        openChat(id);
    };

    // --- 3. 拨号盘 ---
    let dialInput = "";
    const setupDialpad = () => {
        const modalBody = document.querySelector('#add-overlay .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="numpad-container">
                    <div id="dial-display" class="id-display-screen">____</div>
                    <div class="numpad-grid">
                        <div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div>
                        <div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div>
                        <div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div>
                        <div class="num-btn clear" onclick="dial('C')">C</div>
                        <div class="num-btn" onclick="dial(0)">0</div>
                        <div class="num-btn connect" onclick="dial('OK')">🤝</div>
                    </div>
                </div>`;
        }
    };
    
    window.dial = (key) => {
        const display = document.getElementById('dial-display');
        if (key === 'C') { dialInput = ""; display.innerText = "____"; return; }
        if (key === 'OK') {
            if (dialInput.length === 4) {
                if (dialInput === MY_ID) { alert("Cannot add yourself!"); return; }
                try { handleAddFriend(dialInput); window.closeAllModals(); dialInput = ""; display.innerText = "____"; } catch(e) { alert("Err: " + e.message); }
            } else { alert("Enter 4 digits"); }
            return;
        }
        if (dialInput.length < 4 && typeof key === 'number') {
            dialInput += key; display.innerText = dialInput.padEnd(4, '_');
            if(navigator.vibrate) navigator.vibrate(30);
        }
    };

    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        setTimeout(() => {
            const qrEl = document.getElementById("qrcode");
            if(qrEl && window.QRCode) { qrEl.innerHTML = ''; new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" }); }
        }, 500);
    };
    renderProfile();
    setupDialpad();

    // --- 4. 网络 ---
    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'], upgrade: false });
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };
        socket.on('connect', () => { document.getElementById('conn-status').className = "status-dot green"; registerSocket(); isSending = false; processQueue(); });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (socket.disconnected) socket.connect(); else registerSocket(); } });

        socket.on('p2p_signal', async (data) => {
            if (!peerConnection && data.type === 'offer') { initP2P(data.from, false); }
            if (!peerConnection) return;
            try {
                if (data.type === 'offer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('p2p_signal', { targetId: data.from, type: 'answer', answer });
                } else if (data.type === 'answer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                } else if (data.type === 'candidate') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch(e) {}
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) { friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false }; db.friends.push(friend); }

            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                friend.unread = true; saveDB(); renderFriends();
                if('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(100);
            }

            if(msg.type === 'tunnel_file_packet') {
                try { const p = JSON.parse(msg.content); handleTunnelPacket(p, fid); } catch(e){} return;
            }
            if(msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB();
                if(activeChatId === fid) appendMsgDOM(msg, false);
            }
        });
    }

    const initP2P = async (targetId, isInitiator) => {
        if(peerConnection) peerConnection.close();
        isP2PReady = false;
        const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }], iceTransportPolicy: 'all' }; 
        peerConnection = new RTCPeerConnection(config);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit('p2p_signal', { targetId, type: 'candidate', candidate: event.candidate });
        };
        
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                document.getElementById('chat-online-dot').className = "status-dot green";
                document.getElementById('lan-badge').classList.add('active');
                isP2PReady = true;
            } else {
                document.getElementById('lan-badge').classList.remove('active');
                isP2PReady = false;
            }
        };

        if (isInitiator) {
            dataChannel = peerConnection.createDataChannel("chat");
            setupDataChannel(dataChannel);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('p2p_signal', { targetId, type: 'offer', offer });
        } else {
            peerConnection.ondatachannel = (event) => { dataChannel = event.channel; setupDataChannel(dataChannel); };
        }
    };

    const setupDataChannel = (dc) => {
        dc.onopen = () => { isP2PReady = true; document.getElementById('lan-badge').classList.add('active'); };
        dc.onmessage = (e) => { try { const msg = JSON.parse(e.data); handleTunnelPacket(msg, activeChatId); } catch(e) {} };
    };

    function handleTunnelPacket(p, fid) {
        if(p.type && !p.subType) { 
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: p.type, content: p.content, isSelf: false, ts: Date.now() });
            saveDB();
            if(activeChatId === fid) appendMsgDOM({ type: p.type, content: p.content }, false);
            return;
        }
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastBytes:0, lastTime:Date.now(), fileName:p.fileName, fileType:p.fileType };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data);
            dl.receivedSize += Math.floor(p.data.length * 0.75);
            const now = Date.now();
            if(now - dl.lastTime > 500) {
                const spd = ((dl.receivedSize - dl.lastBytes)/1024)/((now-dl.lastTime)/1000);
                if(activeChatId === fid) updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, spd);
                dl.lastBytes = dl.receivedSize; dl.lastTime = now;
            }
        } else if(p.subType === 'end') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                let type = 'file';
                if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'voice';
                
                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); 
                saveDB();
                
                delete activeDownloads[p.fileId];
                document.getElementById('success-sound').play().catch(()=>{});
            }
        }
    }

    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; const file = uploadQueue.shift(); sendFileChunked(file); }

    function sendFileChunked(file) {
        if(!activeChatId) { alert("Connect first"); return; }
        const useP2P = isP2PReady && dataChannel && dataChannel.readyState === 'open';
        if(!useP2P && (!socket || !socket.connected)) { alert("No Connection"); return; }
        
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0; let lastTime = Date.now(); let lastBytes = 0; const total = file.size;
        const readNext = () => {
            if(cancelFlag[fileId]) { isSending = false; setTimeout(processQueue, 500); return; }
            if(!useP2P && !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }

            if(offset >= total) {
                const endP = JSON.stringify({ subType: 'end', fileId });
                if(useP2P) dataChannel.send(endP);
                else socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: endP });
                
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                const finalMsg = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
                replaceProgressWithContent(fileId, finalMsg);
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(finalMsg); saveDB();
                isSending = false; setTimeout(processQueue, 300); return;
            }

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                const packet = JSON.stringify({ subType: 'chunk', fileId, data: b64, fileName: sendName, fileType: sendType, totalSize: total });
                if(useP2P) { try { dataChannel.send(packet); } catch(e) { isSending=false; return; } } 
                else { socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: packet }); }
                
                offset += chunk.size;
                const now = Date.now();
                if(now - lastTime > 200) {
                    const spd = ((offset - lastBytes)/1024)/((now - lastTime)/1000);
                    updateProgressUI(fileId, offset, total, spd);
                    lastTime = now; lastBytes = offset;
                }
                setTimeout(readNext, useP2P ? 5 : 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    function traverseFileTree(item, path) {
        if (item.isFile) { item.file(function(file) { addToQueue(file); }); } 
        else if (item.isDirectory) {
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
                for (var i = 0; i < entries.length; i++) traverseFileTree(entries[i], path + item.name + "/");
            });
        }
    }

    function b64toBlob(b64, type) {
        try {
            const bin = atob(b64); const arr = new Uint8Array(bin.length);
            for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], {type});
        } catch(e) { return new Blob([], {type}); }
    }

    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis;">${isSelf?'⬆':'⬇'} ${fileName||'File'}</div>
                <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden;"><div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#007AFF':'#34C759'}; transition:width 0.1s;"></div></div>
                <div style="display:flex; justify-content:space-between; margin-top:2px; opacity:0.6;"><span id="spd-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span></div>
            </div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function updateProgressUI(id, cur, total, spd) {
        const bar = document.getElementById(`bar-${id}`);
        const spdEl = document.getElementById(`spd-${id}`);
        const pctEl = document.getElementById(`pct-${id}`);
        if(bar) {
            const p = total>0 ? Math.floor((cur/total)*100) : 0;
            bar.style.width = `${p}%`; pctEl.innerText = `${p}%`; spdEl.innerText = `${spd.toFixed(1)} KB/s`;
        }
    }

    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg, msg.isSelf); }
    }

    window.handleAudio = (action, url) => {
        if (!globalAudio) globalAudio = new Audio();
        if (action === 'play') {
            if (globalAudio.src !== url) globalAudio.src = url;
            globalAudio.play().catch(e=>alert("Err: "+e.message));
        } else if (action === 'pause') globalAudio.pause();
        else if (action === 'stop') { globalAudio.pause(); globalAudio.currentTime = 0; }
    };

    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async () => { try { await navigator.mediaDevices.getUserMedia({audio:true}); } catch(e){} };
    document.body.addEventListener('click', reqPerms, {once:true});

    const startR = async(e) => {
        e.preventDefault();
        try {
            const s = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[];
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            rec.onstop = () => {
                const b = new Blob(chunks, {type:mime});
                const f = new File([b], "voice.wav", {type:mime});
                addToQueue(f); s.getTracks().forEach(t=>t.stop());
            };
            rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){ alert("Mic Required!"); }
    };
    const stopR = (e) => {
        e.preventDefault();
        if(rec && rec.state!=='inactive') { rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; }
    };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { sendData('text', t.value); t.value=''; }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });

    window.addEventListener('popstate', () => {
        const preview = document.getElementById('media-preview-modal');
        if(!preview.classList.contains('hidden')) { window.closePreview(); return; }
        if (document.getElementById('view-chat').classList.contains('active')) {
            closeChatUI();
        }
    });

    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(!activeChatId) return;
        const items = e.dataTransfer.items;
        if(items) {
            for(let i=0; i<items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if(item) traverseFileTree(item);
            }
        } else if(e.dataTransfer.files[0]) addToQueue(e.dataTransfer.files[0]);
    });

    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const s = new Html5Qrcode("qr-reader"); window.scanner = s;
                s.start({facingMode:"environment"}, {fps:10, qrbox:200}, t => {
                    s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) handleAddFriend(t); });
                });
            } else alert("Scanner Loading...");
        }, 300);
    };

    document.getElementById('mode-switch-btn').onclick = () => {
        const v = document.getElementById('voice-record-btn'); const t = document.getElementById('text-input-wrapper'); const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); t.style.display='flex'; v.classList.add('hidden'); v.style.display='none'; b.innerText='🎤'; } 
        else { t.classList.add('hidden'); t.style.display='none'; v.classList.remove('hidden'); v.style.display='block'; b.innerText='⌨️'; }
    };

    const fileInput = document.getElementById('chat-file-input');
    fileInput.setAttribute('multiple', ''); 
    document.getElementById('file-btn').onclick = () => fileInput.click();
    fileInput.onchange = e => { 
        if(e.target.files.length > 0) Array.from(e.target.files).forEach(file => addToQueue(file));
    };
    
    // ★ 动态表情源 ★
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    const gifs = [
        "https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif",
        "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif",
        "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif",
        "https://media.tenor.com/9y_9y_9yAAAAi/pepe-happy.gif",
        "https://media.tenor.com/Q21qM6E5QOwAAAAi/pepe-love.gif",
        "https://media.tenor.com/1-1-1-1-1-1-1-1-1-1-1-1/pepe-clown.gif",
        "https://media.tenor.com/images/3071375525525795861/pepe-punch.gif",
        "https://media.tenor.com/images/123/pepe-run.gif"
    ];
    gifs.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.onerror = () => { img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${index}`; };
        img.className='sticker-item'; 
        img.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
        img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    });
    
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };
    window.cancelTransfer = (id, isSelf) => { if(isSelf) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>'; };
    
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dlBtn = document.getElementById('preview-download-btn');
        if(dlBtn) { dlBtn.href = url; dlBtn.download = `file_${Date.now()}`; }
        let el = type==='image' ? document.createElement('img') : document.createElement('video');
        el.src = url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; if(type==='video') { el.controls=true; el.autoplay=true; }
        c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; 
        window.history.pushState({p:1},"");
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    window.playVoice = (url, id) => { const a = new Audio(url); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    
    window.editFriendName = () => { 
        if(activeChatId) { 
            const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Set Alias:", f.alias||f.id); 
            if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } 
        } 
    };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    renderFriends(); 
    document.body.addEventListener('click', () => { document.getElementById('msg-sound').load(); }, {once:true});
});

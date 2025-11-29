document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 全局工具函数 ---
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        // 安全停止扫描器
        if(window.scanner && window.scanner.getState() === Html5QrcodeScannerState.SCANNING) {
            window.scanner.stop().then(() => console.log("Scanner stopped")).catch(err => console.error(err));
        }
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
        document.getElementById('view-identity').classList.remove('active');
        setTimeout(()=>document.getElementById('view-identity').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    window.resetApp = () => { if(confirm("Reset Data?")) { localStorage.clear(); location.reload(); } };

    // --- 2. 数据层 ---
    const DB_KEY = 'pepe_v27_stable';
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
    document.getElementById('card-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 60, height: 60 });
    }

    renderFriends();

    // --- 3. 核心功能实现 (逻辑修复) ---

    // A. 添加好友 (防抖 + 自动重连)
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        
        // 1. 存本地
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB();
            renderFriends();
        }
        
        // 2. 确保网络连接
        if(!socket || !socket.connected) {
            console.log("Socket disconnected, trying to reconnect...");
            socket.connect();
        }
        
        // 3. 跳转
        openChat(id);
    }

    // B. 扫码 (优雅停止)
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                // 成功扫码
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
                
                // 关键：先停止，再处理逻辑
                scanner.stop().then(() => {
                    window.closeAllModals();
                    if(txt.length === 4) {
                        handleAddFriend(txt);
                    } else {
                        alert("Invalid QR Code");
                    }
                }).catch(err => {
                    console.error("Stop failed", err);
                    window.closeAllModals();
                });
                
            }).catch(e=>{ console.log(e); });
        }, 300);
    };

    // C. 手动添加
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAllModals();
            handleAddFriend(id);
            document.getElementById('manual-id-input').value = '';
        } else { alert("Must be 4 digits"); }
    };

    // --- 4. 聊天与网络 ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { 
            reconnection: true,
            reconnectionAttempts: Infinity,
            transports: ['websocket'] // 强制 websocket
        });
        
        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            socket.emit('register', MY_ID);
        });

        socket.on('disconnect', () => {
            document.getElementById('conn-status').className = "status-dot red";
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            // 被动添加好友
            if(!db.friends.find(f => f.id === fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
            }
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
            saveDB();
            renderFriends();

            if(activeChatId === fid) appendMsgDOM(msg, false);
            else document.getElementById('msg-sound').play().catch(()=>{});
        });
    }
    
    // 手动重连
    window.forceReconnect = () => {
        if(socket) {
            socket.disconnect();
            socket.connect();
        }
    };

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${f.alias || f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>
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
        document.getElementById('chat-online-dot').className = "status-dot online";
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));
        // 自动重连一下，确保在线
        if(socket && !socket.connected) socket.connect();
    }

    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type, fileName });
        }
        const msgObj = { type, content, isSelf: true, ts: Date.now(), fileName };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<img src="${msg.content}" class="sticker-img">`;
        else if(msg.type==='voice') html=`<div class="bubble" style="cursor:pointer; background:${isSelf?'#59BC10':'#fff'}; color:${isSelf?'#fff':'#000'}" onclick="new Audio('${msg.content}').play()">🎤 Voice Clip ▶</div>`;
        else if(msg.type==='file') html=`<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}">Download</a></div>`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // UI Buttons
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    const modeSwitch = document.getElementById('mode-switch-btn');
    let isVoice = true;
    modeSwitch.onclick = () => {
        isVoice = !isVoice;
        if(isVoice) {
            document.getElementById('input-mode-text').classList.add('hidden');
            document.getElementById('input-mode-voice').classList.remove('hidden');
            modeSwitch.innerText = "⌨️";
        } else {
            document.getElementById('input-mode-voice').classList.add('hidden');
            document.getElementById('input-mode-text').classList.remove('hidden');
            modeSwitch.innerText = "🎤";
        }
    };

    // Voice
    let mediaRecorder, audioChunks;
    const voiceBtn = document.getElementById('voice-record-btn');
    const startRec = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, {type:'audio/webm'});
                const reader = new FileReader(); reader.readAsDataURL(blob);
                reader.onloadend = () => sendData('voice', reader.result);
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording'); voiceBtn.innerText="RECORDING...";
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('mousedown', startRec); voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()}); voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // Nickname & FM
    window.editMyName = () => { const n = prompt("New Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); document.getElementById('my-nickname').innerText=n; } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Rename:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => { if(fm.paused) { fm.play(); alert("FM ON"); } else { fm.pause(); alert("FM OFF"); } };

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<12; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item'; img.style.width='60px';
        img.onclick = () => { if(activeChatId) { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Drag
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); drag.classList.add('hidden'); if(activeChatId && e.dataTransfer.files[0]) { const f=e.dataTransfer.files[0]; const r=new FileReader(); r.readAsDataURL(f); r.onload=()=>sendData('file', r.result, f.name); } });

    document.body.onclick = () => document.getElementById('msg-sound').load();
});

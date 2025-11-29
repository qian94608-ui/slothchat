document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 务必填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v20_db';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if (!db || !db.profile) throw new Error("Init");
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
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#388E3C", colorLight: "#FFFFFF" });
    }

    // --- 2. Socket 连接 ---
    let socket = null;
    let activeChatId = null;

    if (!SERVER_URL.includes('onrender')) alert("Error: Set SERVER_URL in app.js");

    socket = io(SERVER_URL);

    socket.on('connect', () => {
        document.getElementById('conn-status').innerText = "ONLINE";
        document.getElementById('conn-status').className = "status-pill green";
        socket.emit('register', MY_ID);
    });

    socket.on('disconnect', () => {
        document.getElementById('conn-status').innerText = "OFFLINE";
        document.getElementById('conn-status').className = "status-pill red";
    });

    socket.on('receive_msg', (msg) => {
        const fid = msg.from;
        if (!db.friends.find(f => f.id === fid)) db.friends.push({ id: fid, addedAt: Date.now(), alias: `Fren ${fid}` });
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            document.getElementById('success-sound').play().catch(()=>{});
            if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    });

    // --- 3. 核心修复逻辑 ---

    // A. 扫码 (保证有反馈)
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:250}, txt => {
                // 1. 成功音效 + 震动
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(500); // 强震动
                
                // 2. 停止
                scanner.stop().catch(()=>{});
                window.closeAllModals();

                // 3. 逻辑处理
                if(txt.length === 4) {
                    if(!db.friends.find(f=>f.id===txt)) { 
                        db.friends.push({id:txt, addedAt:Date.now()}); 
                        saveDB(); 
                        renderFriends(); 
                    }
                    setTimeout(() => openChat(txt), 300); // 强制跳转
                } else {
                    alert("Invalid QR Code (Not 4 digits)");
                }
            }).catch(e=>{ console.log(e); });
        }, 300);
    };

    // B. 修改昵称 (已修复)
    window.editMyName = () => {
        const n = prompt("New Nickname:", db.profile.nickname);
        if(n) { db.profile.nickname = n; saveDB(); document.getElementById('my-nickname').innerText = n; }
    };

    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        const n = prompt("Rename Fren:", f.alias || f.id);
        if(n) { 
            f.alias = n; 
            saveDB(); 
            document.getElementById('chat-partner-name').innerText = n; 
            renderFriends(); 
        }
    };

    // --- 4. 基础逻辑 ---
    
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            const name = f.alias || f.id;
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${name}</div><div style="font-size:12px; color:green">FREN</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        const name = f ? (f.alias || f.id) : id;
        document.getElementById('chat-partner-name').innerText = name;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        document.getElementById('chat-online-dot').className = "status-dot online";
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    function sendData(type, content, fileName = null) {
        if(!activeChatId || !socket.connected) return alert("Offline!");
        socket.emit('send_private', { targetId: activeChatId, content: content, type: type, fileName: fileName });
        const msgObj = { type: type, content: content, isSelf: true, ts: Date.now(), fileName: fileName };
        if (!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        if (msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if (msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img">`;
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#bdfcc9':'#fff'}" onclick="new Audio('${msg.content}').play()">🎤 Voice ▶</div>`;
        else if (msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}">⬇ Save</a></div>`;
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // Add ID
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) {
            window.closeAllModals();
            if(!db.friends.find(f=>f.id===id)) { db.friends.push({id:id, addedAt:Date.now()}); saveDB(); renderFriends(); }
            openChat(id);
        }
    };

    // Chat UI
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    document.getElementById('mode-switch-btn').onclick = () => {
        document.getElementById('input-mode-text').classList.toggle('hidden');
        document.getElementById('input-mode-voice').classList.toggle('hidden');
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
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => sendData('voice', reader.result);
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
            voiceBtn.innerText = "RECORDING...";
        } catch(e) { alert("Mic Error (HTTPS needed)"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('mousedown', startRec); voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()}); voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // File Drop
    const dropOverlay = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) dropOverlay.classList.remove('hidden'); });
    dropOverlay.addEventListener('dragleave', (e) => { if(e.target===dropOverlay) dropOverlay.classList.add('hidden'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
        e.preventDefault(); dropOverlay.classList.add('hidden');
        if (activeChatId && e.dataTransfer.files[0]) {
            const f = e.dataTransfer.files[0];
            if(f.size>2*1024*1024) return alert("File too big");
            const r = new FileReader(); r.readAsDataURL(f);
            r.onload = () => sendData('file', r.result, f.name);
        }
    });

    // Stickers & FM
    const sGrid = document.getElementById('sticker-grid');
    for(let i=1; i<=30; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    
    window.toggleFM = () => {
        const fm = document.getElementById('fm-radio');
        if(fm.paused) { fm.play(); alert("FM ON"); } else { fm.pause(); alert("FM OFF"); }
    };

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});

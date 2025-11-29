document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 数据 ---
    const DB_KEY = 'wojak_v19_db';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if (!db || !db.profile) throw new Error("Init");
    } catch(e) {
        db = {
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'ME' },
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
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    document.getElementById('card-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 70, height: 70 });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 70, height: 70 });
    }

    // --- 2. Socket 连接 ---
    let socket = null;
    let activeChatId = null;

    if (!SERVER_URL.includes('onrender')) alert("Error: Set SERVER_URL in app.js");

    socket = io(SERVER_URL, { reconnection: true, reconnectionAttempts: 10 });

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
        const fid = msg.from;
        if (!db.friends.find(f => f.id === fid)) db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
            // 震动提示
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
    });

    // --- 3. 核心功能修复 ---

    // A. Add ID (乐观UI + 修复)
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('manual-id-input').focus(), 100);
    };

    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if (id.length === 4) {
            window.closeAllModals();
            if (!db.friends.find(f => f.id === id)) {
                db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
                saveDB();
                renderFriends();
            }
            openChat(id);
            document.getElementById('manual-id-input').value = ""; // 清空
        } else {
            alert("ID must be 4 digits!");
        }
    };

    // B. 扫码 (自动关闭 + 震动)
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.scanner) window.scanner.clear();
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                // 成功
                scanner.stop().catch(()=>{});
                window.closeAllModals();
                document.getElementById('scan-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
                
                if (txt.length === 4) {
                    if (!db.friends.find(f => f.id === txt)) {
                        db.friends.push({ id: txt, addedAt: Date.now(), alias: `User ${txt}` });
                        saveDB();
                        renderFriends();
                    }
                    setTimeout(() => openChat(txt), 200);
                } else {
                    alert("Invalid QR Code");
                }
            }).catch(e => { console.log(e); });
        }, 300);
    };

    // C. 语音录制 (压缩 + 修复)
    const voiceBtn = document.getElementById('voice-record-btn');
    let mediaRecorder, audioChunks;

    const startRec = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            // 降低码率以防 Socket 丢包
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 16000 });
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if(e.data.size > 0) audioChunks.push(e.data); };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, {type:'audio/webm'});
                // 限制大小
                if(blob.size > 500 * 1024) return alert("Voice too long!");
                
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => sendData('voice', reader.result);
            };
            
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
            voiceBtn.innerText = "RECORDING...";
        } catch(e) { alert("Mic Error. Use HTTPS."); }
    };
    
    const stopRec = () => {
        if(mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            voiceBtn.classList.remove('recording');
            voiceBtn.innerText = "HOLD TO SPEAK";
        }
    };

    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);

    // D. 文件拖拽 (全局监听)
    const dragOverlay = document.getElementById('drag-overlay');
    // 全局拖拽进入
    window.addEventListener('dragenter', (e) => {
        // 只有在聊天界面才激活
        if(document.getElementById('view-chat').classList.contains('active')) {
            dragOverlay.classList.remove('hidden');
            dragOverlay.classList.add('active'); // 允许指针
        }
    });
    // 拖拽离开
    dragOverlay.addEventListener('dragleave', (e) => {
        if(e.target === dragOverlay) {
            dragOverlay.classList.add('hidden');
            dragOverlay.classList.remove('active');
        }
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
        e.preventDefault();
        dragOverlay.classList.add('hidden');
        dragOverlay.classList.remove('active');
        
        if (activeChatId && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            processFile(file);
        }
    });

    function processFile(file) {
        if(file.size > 1.5 * 1024 * 1024) return alert("File too big (Max 1.5MB)");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const type = file.type.startsWith('image/') ? 'image' : 'file';
            sendData(type, reader.result, file.name);
        };
    }

    // --- 4. 基础功能 ---
    function sendData(type, content, fileName = null) {
        if(!activeChatId || !socket.connected) return alert("Offline!");
        
        // UI 立即显示
        const msgObj = { type, content, isSelf: true, ts: Date.now(), fileName };
        if (!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);

        // 发送
        socket.emit('send_private', { targetId: activeChatId, content, type, fileName });
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        
        if (msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if (msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img">`;
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#bdfcc9':'#fff'}" onclick="new Audio('${msg.content}').play()">🎤 Voice ▶</div>`;
        else if (msg.type === 'image') html = `<div class="bubble"><img src="${msg.content}" style="max-width:150px; border-radius:5px;"><br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Save</button></div>`;
        else if (msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName}<br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Download</button></div>`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    window.downloadBase64 = (base64, name) => {
        const a = document.createElement('a');
        a.href = base64; a.download = name || 'download'; a.click();
    };

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.id = `friend-item-${f.id}`;
            const name = f.alias || f.id;
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${name}</div><div style="font-size:12px; color:green">SAVED</div></div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    // Buttons
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
    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });
    // FM & Reset
    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => {
        if(fm.paused) { fm.play(); document.getElementById('fm-btn').classList.add('playing'); }
        else { fm.pause(); document.getElementById('fm-btn').classList.remove('playing'); }
    };
    window.resetApp = () => { if(confirm("Reset All Data?")) { localStorage.clear(); location.reload(); } };
    
    // Sticker
    const stickerUrls = [];
    for(let i=1; i<=30; i++) stickerUrls.push(`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*99}&backgroundColor=transparent`);
    const sGrid = document.getElementById('sticker-grid');
    stickerUrls.forEach(url => {
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});

document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 替换为你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. ID 与 数据 ---
    const DB_KEY = 'wojak_v16_db';
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
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60 });
        // Cyber Card QR
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 60, height: 60 });
    }

    // --- 2. Socket.io ---
    let socket = null;
    let activeChatId = null;
    let onlineUsers = new Set(); // 简单的在线列表

    if (!SERVER_URL.includes('onrender')) alert("Please set SERVER_URL in app.js");

    socket = io(SERVER_URL);

    socket.on('connect', () => {
        document.getElementById('conn-status').innerText = "ONLINE";
        document.getElementById('conn-status').className = "status-badge green";
        socket.emit('register', MY_ID);
        // 保活心跳
        setInterval(() => socket.emit('ping', MY_ID), 15000);
    });

    socket.on('disconnect', () => {
        document.getElementById('conn-status').innerText = "OFFLINE";
        document.getElementById('conn-status').className = "status-badge red";
    });

    // 接收消息
    socket.on('receive_msg', (msg) => {
        handleIncomingMsg(msg);
    });

    function handleIncomingMsg(msg) {
        const fid = msg.from;
        // 自动加好友
        if (!db.friends.find(f => f.id === fid)) {
            db.friends.push({ id: fid, addedAt: Date.now() });
        }
        
        // 存历史
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            // 列表抖动 + 语音提醒
            const item = document.getElementById(`friend-item-${fid}`);
            if(item) {
                item.classList.add('shake');
                setTimeout(()=>item.classList.remove('shake'), 500);
            }
            speakNotification("Message coming now");
        }
    }

    // TTS 语音提醒 (Sexy MILF Voice attempt)
    function speakNotification(text) {
        if('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            // 尝试找一个女性声音
            const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google US English'));
            if(femaleVoice) utter.voice = femaleVoice;
            utter.pitch = 0.8; // 低沉一点
            utter.rate = 0.9;  // 慢一点
            window.speechSynthesis.speak(utter);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    // --- 3. 聊天与发送 ---
    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
        
        // 上传到 Socket
        socket.emit('send_private', {
            targetId: activeChatId,
            content: content, // 文本 或 Base64
            type: type,
            fileName: fileName
        });

        // 本地保存
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
        if (msg.type === 'text') {
            html = `<div class="bubble">${msg.content}</div>`;
        } else if (msg.type === 'sticker') {
            html = `<img src="${msg.content}" class="sticker-img">`;
        } else if (msg.type === 'voice') {
            html = `<div class="bubble" style="cursor:pointer" onclick="new Audio('${msg.content}').play()">🎤 Voice Msg ▶</div>`;
        } else if (msg.type === 'image') {
            html = `<div class="bubble"><img src="${msg.content}" style="max-width:150px; border-radius:5px;"><br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Save</button></div>`;
        } else if (msg.type === 'file') {
            html = `<div class="bubble">📂 ${msg.fileName}<br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Download</button></div>`;
        }
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    window.downloadBase64 = (base64, name) => {
        const a = document.createElement('a');
        a.href = base64;
        a.download = name || 'download';
        a.click();
    };

    // --- 4. 30+ Wojak Stickers (CDN Links) ---
    // 使用 imgur 相册的链接 (此处为示例，需确保链接有效，否则用 Base64 或 Dicebear 占位)
    const stickerUrls = [];
    for(let i=1; i<=30; i++) {
        // 使用 DiceBear 生成 30 个不同的 Pepe/Wojak 风格头像代替，保证不裂图
        // 真实开发需替换为 30 个具体的 jpg/png URL
        stickerUrls.push(`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i}&backgroundColor=transparent`);
    }
    
    const sGrid = document.getElementById('sticker-grid');
    stickerUrls.forEach(url => {
        const img = document.createElement('img');
        img.src = url; img.className = 'sticker-item';
        img.onclick = () => {
            sendData('sticker', url);
            document.getElementById('sticker-panel').classList.add('hidden');
        };
        sGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // --- 5. 语音录制 (Hold to Speak) ---
    const voiceBtn = document.getElementById('voice-record-btn');
    let mediaRecorder, audioChunks;

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
                reader.onloadend = () => {
                    const base64 = reader.result;
                    sendData('voice', base64);
                }
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
            voiceBtn.innerText = "RECORDING...";
        } catch(e) { alert("Mic Error or HTTPS required"); }
    };
    const stopRec = () => {
        if(mediaRecorder) {
            mediaRecorder.stop();
            voiceBtn.classList.remove('recording');
            voiceBtn.innerText = "HOLD TO SPEAK";
        }
    };
    
    // 触屏与鼠标事件
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // 模式切换
    let isVoice = true;
    const switchBtn = document.getElementById('mode-switch-btn');
    switchBtn.onclick = () => {
        isVoice = !isVoice;
        if(isVoice) {
            document.getElementById('input-mode-text').classList.add('hidden');
            document.getElementById('input-mode-voice').classList.remove('hidden');
        } else {
            document.getElementById('input-mode-voice').classList.add('hidden');
            document.getElementById('input-mode-text').classList.remove('hidden');
        }
    };

    // --- 6. 文件拖拽与发送 ---
    const dropOverlay = document.getElementById('drag-overlay');
    // 拖拽
    window.addEventListener('dragenter', () => dropOverlay.classList.remove('hidden'));
    dropOverlay.addEventListener('dragleave', (e) => { if(e.target===dropOverlay) dropOverlay.classList.add('hidden'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
        e.preventDefault();
        dropOverlay.classList.add('hidden');
        if(activeChatId && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });

    // 按钮选择
    const fileInput = document.getElementById('global-file-input');
    // 注意：聊天界面的文件夹按钮没有ID，需要在HTML里绑定
    // 这里我们用通用逻辑
    window.processFile = (file) => {
        if(file.size > 2 * 1024 * 1024) return alert("File too large (>2MB). Socket limit.");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const type = file.type.startsWith('image/') ? 'image' : 'file';
            sendData(type, reader.result, file.name);
        };
    };

    // --- 7. FM 电台 ---
    const fmAudio = document.getElementById('fm-radio');
    const fmBtn = document.getElementById('fm-btn');
    fmBtn.onclick = () => {
        if(fmAudio.paused) {
            fmAudio.play();
            fmBtn.innerText = "📻 FM: ON";
            fmBtn.style.color = "#0f0";
        } else {
            fmAudio.pause();
            fmBtn.innerText = "📻 FM: OFF";
            fmBtn.style.color = "#fff";
        }
    };

    // --- 8. 基础 UI 逻辑 ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.id = `friend-item-${f.id}`;
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${f.id}</div><div style="font-size:12px; color:green">SAVED</div></div>
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
        document.getElementById('chat-online-dot').className = "status-dot online"; // 假定 C/S 永远在线
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    // 返回与发送文本
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };

    // 扫码与添加
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                document.getElementById('manual-id-input').value = txt;
                window.hideAllModals();
                document.getElementById('confirm-add-btn').click();
            });
        },300);
    };
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) {
            window.hideAllModals();
            if(!db.friends.find(f=>f.id===id)) { db.friends.push({id:id}); saveDB(); renderFriends(); }
            openChat(id);
        }
    };
    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop();
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

    // 唤醒锁 (Wakelock)
    async function requestWakeLock() {
        try { await navigator.wakeLock.request('screen'); console.log('Wake Lock ON'); } catch(e){}
    }
    document.body.onclick = () => { 
        requestWakeLock();
        // 首次点击初始化 TTS 语音
        window.speechSynthesis.getVoices(); 
    };

    renderFriends();
});

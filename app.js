document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 替换 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 全局工具函数 ---
    window.closeAll = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    window.resetApp = () => { if(confirm("Reset Data?")) { localStorage.clear(); location.reload(); } };

    // --- 2. 数据层 ---
    const DB_KEY = 'pepe_v31_final';
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
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
    }

    renderFriends();

    // --- 3. 核心功能实现 (修复 Bug) ---

    // A. 添加好友 (单向逻辑：加了就跳转，无需对方同意)
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        // 1. 存本地
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB();
            renderFriends();
        }
        // 2. 直接跳转
        openChat(id);
    }

    // B. 手动添加
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAll();
            handleAddFriend(id);
            document.getElementById('manual-id-input').value = '';
        } else { alert("Must be 4 digits"); }
    };

    // C. 扫码 (修复逻辑顺序)
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                // 1. 停止
                scanner.stop().catch(()=>{});
                window.closeAll();
                
                // 2. 反馈
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);

                // 3. 执行
                if(txt.length === 4) {
                    handleAddFriend(txt);
                } else {
                    alert("Invalid QR");
                }
            }).catch(e=>{ console.log(e); });
        }, 300);
    };

    // --- 4. 聊天与网络 ---
    let socket = null;
    let activeChatId = null;

    if(SERVER_URL.includes('onrender')) {
        socket = io(SERVER_URL, { reconnection: true });
        
        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-pill green";
            document.getElementById('conn-status').innerText = "ONLINE";
            socket.emit('register', MY_ID);
        });

        socket.on('disconnect', () => {
            document.getElementById('conn-status').className = "status-pill red";
            document.getElementById('conn-status').innerText = "OFFLINE";
        });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            // 自动加好友 (被动单向)
            if(!db.friends.find(f => f.id === fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
            }
            if(!db.history[fid]) db.history[fid] = [];
            db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
            saveDB();
            renderFriends();

            if(activeChatId === fid) {
                appendMsgDOM(msg, false);
            } else {
                document.getElementById('msg-sound').play().catch(()=>{});
            }
        });
    }

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
    }

    // --- UI 切换 (修复语音/文本挤压) ---
    const switchBtn = document.getElementById('mode-switch-btn');
    let isVoiceMode = true;

    switchBtn.onclick = () => {
        isVoiceMode = !isVoiceMode;
        if(isVoiceMode) {
            document.getElementById('mode-text').classList.add('hidden');
            document.getElementById('mode-voice').classList.remove('hidden');
            switchBtn.innerText = "⌨️";
        } else {
            document.getElementById('mode-voice').classList.add('hidden');
            document.getElementById('mode-text').classList.remove('hidden');
            switchBtn.innerText = "🎤";
        }
    };

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
        else if(msg.type==='voice') html=`<div class="bubble" style="cursor:pointer;" onclick="new Audio('${msg.content}').play()">🔊 Voice</div>`;
        else if(msg.type==='sticker') html=`<img src="${msg.content}" class="sticker-img">`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };

    // 录音
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
            voiceBtn.classList.add('recording'); voiceBtn.innerText="RECORDING...";
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('mousedown', startRec); voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()}); voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // 备注与FM
    window.editMyName = () => {
        const n = prompt("New Name:", db.profile.nickname);
        if(n) { db.profile.nickname=n; saveDB(); document.getElementById('my-nickname').innerText=n; }
    };
    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x=>x.id===activeChatId);
        const n = prompt("Rename:", f.alias||f.id);
        if(n) { f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); }
    };
    const fm = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => {
        if(fm.paused) { fm.play(); alert("FM ON"); } else { fm.pause(); alert("FM OFF"); }
    };

    document.body.onclick = () => document.getElementById('msg-sound').load();
});

document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 数据与状态 ---
    const DB_KEY = 'pepe_v27_db';
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
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
    }

    // --- 2. Socket 连接 ---
    let socket = null;
    let activeChatId = null;

    if (!SERVER_URL.includes('onrender')) alert("Error: Set SERVER_URL in app.js");

    socket = io(SERVER_URL, { reconnection: true });

    socket.on('connect', () => {
        document.getElementById('conn-status').className = "status-dot green";
        socket.emit('register', MY_ID);
    });

    socket.on('disconnect', () => {
        document.getElementById('conn-status').className = "status-dot red";
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
            // 语音播报
            speakNotification("New message");
            // 震动
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
    });

    function speakNotification(text) {
        if('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const female = voices.find(v => v.name.includes('Female'));
            if(female) utter.voice = female;
            utter.rate = 0.9;
            window.speechSynthesis.speak(utter);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    // --- 3. 核心功能实现 ---

    // A. 渲染列表 + 左滑删除 (Swipe Logic)
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        
        db.friends.forEach(f => {
            const wrapper = document.createElement('div');
            wrapper.className = 'list-item-wrapper';
            
            // 底层删除按钮
            const bg = document.createElement('div');
            bg.className = 'delete-bg';
            bg.innerHTML = '🗑 DELETE';
            
            // 表层内容
            const content = document.createElement('div');
            content.className = 'k-list-item';
            const name = f.alias || f.id;
            content.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:16px;">${name}</div>
                    <div class="status-text on">Connected</div>
                </div>
                <div style="font-size:20px; color:#ddd;">›</div>
            `;

            // 手势逻辑
            let startX, currentX;
            content.addEventListener('touchstart', e => { startX = e.touches[0].clientX; content.style.transition = 'none'; });
            content.addEventListener('touchmove', e => {
                let diff = e.touches[0].clientX - startX;
                if(diff < 0 && diff > -100) content.style.transform = `translateX(${diff}px)`;
            });
            content.addEventListener('touchend', e => {
                content.style.transition = 'transform 0.2s';
                let diff = e.changedTouches[0].clientX - startX;
                if(diff < -50) content.style.transform = `translateX(-80px)`; // 展开
                else content.style.transform = `translateX(0px)`; // 回弹
            });

            // 点击逻辑
            content.onclick = (e) => {
                if(content.style.transform === 'translateX(-80px)') {
                    content.style.transform = 'translateX(0px)'; // 收起
                } else {
                    openChat(f.id);
                }
            };

            // 删除点击
            bg.onclick = (e) => {
                e.stopPropagation();
                if(confirm(`Delete ${name}?`)) {
                    db.friends = db.friends.filter(x => x.id !== f.id);
                    saveDB();
                    renderFriends();
                }
            };

            wrapper.appendChild(bg);
            wrapper.appendChild(content);
            list.appendChild(wrapper);
        });
    }

    // B. 文件拖拽发送 (Drag & Drop)
    const dragOverlay = document.getElementById('drag-overlay');
    // 全局监听
    window.addEventListener('dragenter', (e) => {
        if(document.getElementById('view-chat').classList.contains('active')) {
            dragOverlay.classList.remove('hidden');
            dragOverlay.classList.add('active');
        }
    });
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
        if(activeChatId && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    function processFile(file) {
        if(file.size > 2 * 1024 * 1024) return alert("Max File Size: 2MB");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const type = file.type.startsWith('image/') ? 'image' : 'file';
            sendData(type, reader.result, file.name);
        };
    }

    // C. 语音/文本切换
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

    // D. 备注修改
    window.editMyName = () => {
        const n = prompt("New Nickname:", db.profile.nickname);
        if(n) { db.profile.nickname = n; saveDB(); document.getElementById('my-nickname').innerText = n; }
    };
    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        const n = prompt("Rename Fren:", f.alias || f.id);
        if(n) { f.alias = n; saveDB(); document.getElementById('chat-partner-name').innerText = n; renderFriends(); }
    };

    // E. 基础聊天功能
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

    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type, fileName });
        }
        
        const msgObj = { type, content, isSelf: true, ts: Date.now(), fileName };
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
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#59BC10':'#fff'}; color:${isSelf?'#fff':'#000'}" onclick="new Audio('${msg.content}').play()">🎤 Voice Clip ▶</div>`;
        else if (msg.type === 'image') html = `<div class="bubble"><img src="${msg.content}" style="max-width:150px; border-radius:10px;"></div>`;
        else if (msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName}</div>`;
        else if (msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img">`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 事件绑定
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // Add & Scan
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
        if(id.length === 4) {
            window.closeAllModals();
            if(!db.friends.find(f=>f.id===id)) { db.friends.push({id:id, addedAt:Date.now()}); saveDB(); renderFriends(); }
            openChat(id);
        }
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                scanner.stop().catch(()=>{});
                window.closeAllModals();
                document.getElementById('success-sound').play().catch(()=>{});
                if(txt.length === 4) {
                    if(!db.friends.find(f=>f.id===txt)) { db.friends.push({id:txt, addedAt:Date.now()}); saveDB(); renderFriends(); }
                    openChat(txt);
                }
            });
        }, 300);
    };

    // FM Radio
    const fmAudio = document.getElementById('fm-radio');
    const fmBtn = document.getElementById('fm-btn');
    fmBtn.onclick = () => {
        if(fmAudio.paused) { fmAudio.play(); fmBtn.classList.add('playing'); }
        else { fmAudio.pause(); fmBtn.classList.remove('playing'); }
    };

    // Voice Record
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
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('mousedown', startRec); voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()}); voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // Reset
    window.resetApp = () => { if(confirm("Reset Data?")) { localStorage.clear(); location.reload(); } };

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    for(let i=1; i<=30; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});

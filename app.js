document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 务必填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v30_restore';
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
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 80, height: 80 });
    }

    renderFriends();

    // --- 2. 交互逻辑 (最先绑定，确保可点) ---
    
    window.closeAll = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
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
        document.getElementById('view-card').classList.remove('active');
        setTimeout(()=>document.getElementById('view-card').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    window.resetApp = () => { if(confirm("Reset App?")) { localStorage.clear(); location.reload(); } };

    // 绑定按钮
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('scan-btn').onclick = () => startScanner();
    document.getElementById('chat-send-btn').onclick = sendText;
    document.getElementById('chat-back-btn').onclick = window.goBack;
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    document.getElementById('mode-switch-btn').onclick = () => {
        document.getElementById('input-mode-text').classList.toggle('hidden');
        document.getElementById('input-mode-voice').classList.toggle('hidden');
    };

    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length === 4) {
            window.closeAll();
            addFriend(id);
            openChat(id);
            document.getElementById('manual-id-input').value = '';
        } else { alert("Must be 4 digits"); }
    };

    // FM
    const fm = document.getElementById('fm-radio');
    const fmBtn = document.getElementById('fm-btn');
    fmBtn.onclick = () => {
        if(fm.paused) { fm.play(); fmBtn.classList.add('playing'); }
        else { fm.pause(); fmBtn.classList.remove('playing'); }
    };

    // --- 3. 网络 (Socket) ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
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
            addFriend(fid);
            saveMsg(fid, msg.content, false, msg.type);
            
            if(activeChatId === fid) {
                appendMsg(msg.content, false, msg.type);
            } else {
                document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
            }
        });
    }

    // --- 4. 业务逻辑 ---
    function addFriend(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB();
            renderFriends();
        }
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
        msgs.forEach(m => appendMsg(m.content, m.isSelf, m.type));
    }

    function sendText() {
        const txt = document.getElementById('chat-input').value;
        if(txt) {
            if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content: txt, type: 'text' });
            saveMsg(activeChatId, txt, true, 'text');
            appendMsg(txt, true, 'text');
            document.getElementById('chat-input').value = '';
        }
    }

    function saveMsg(id, content, isSelf, type) {
        if(!db.history[id]) db.history[id] = [];
        db.history[id].push({ content, isSelf, type, ts: Date.now() });
        saveDB();
    }

    function appendMsg(content, isSelf, type) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        if(type === 'text') div.innerHTML = `<div class="bubble">${content}</div>`;
        else if(type === 'sticker') div.innerHTML = `<img src="${content}" class="sticker-img">`;
        else if(type === 'voice') div.innerHTML = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#59BC10':'#fff'}" onclick="new Audio('${content}').play()">🎤 Voice Clip ▶</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 扫码
    function startScanner() {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(!window.Html5Qrcode) return alert("Scanner Error");
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                scanner.stop().catch(()=>{});
                window.closeAll();
                document.getElementById('success-sound').play().catch(()=>{});
                if(txt.length===4) { addFriend(txt); openChat(txt); }
            }).catch(e=>{ alert("Camera Error"); window.closeAll(); });
        }, 500);
    }

    // Stickers
    const sGrid = document.getElementById('sticker-grid');
    for(let i=0; i<12; i++) {
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*100}`;
        const img = document.createElement('img'); img.src=url; img.className='sticker-item'; img.style.width='60px';
        img.onclick = () => {
            if(activeChatId) {
                if(socket) socket.emit('send_private', { targetId: activeChatId, content: url, type: 'sticker' });
                saveMsg(activeChatId, url, true, 'sticker');
                appendMsg(url, true, 'sticker');
                document.getElementById('sticker-panel').classList.add('hidden');
            }
        };
        sGrid.appendChild(img);
    }

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
                reader.onloadend = () => {
                    if(socket) socket.emit('send_private', { targetId: activeChatId, content: reader.result, type: 'voice' });
                    saveMsg(activeChatId, reader.result, true, 'voice');
                    appendMsg(reader.result, true, 'voice');
                };
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording'); voiceBtn.innerText="RECORDING...";
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);

    document.body.onclick = () => document.getElementById('msg-sound').load();
});

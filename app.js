document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 基础 UI 绑定 ---
    const tabBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-tab'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        };
    });

    window.showEl = (id) => { document.getElementById(id).style.display = 'flex'; };
    window.hideEl = (id) => { document.getElementById(id).style.display = 'none'; };
    window.hideAllModals = () => {
        hideEl('qr-overlay'); hideEl('add-overlay');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    document.getElementById('scan-btn').onclick = () => {
        showEl('qr-overlay');
        try {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10}, (txt)=>{
                hideAllModals(); addFriend(txt); connectTo(txt); openChat(txt);
            });
        } catch(e) { alert('Camera broke. Cope harder.'); }
    };

    document.getElementById('add-id-btn').onclick = () => showEl('add-overlay');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id) { addFriend(id); connectTo(id); hideAllModals(); openChat(id); }
    };

    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        activeChatId = null;
    };

    document.getElementById('sticker-btn').onclick = () => {
        const panel = document.getElementById('sticker-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    // --- 2. 逻辑与网络 ---
    // 生成一个看起来比较中二的ID
    const MY_ID = localStorage.getItem('wojak_id') || 'Anon-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('wojak_id', MY_ID);
    let friends = JSON.parse(localStorage.getItem('wojak_frens')) || [];
    let activeChatId = null;
    let connections = {};
    let peer = null;

    // 使用看起来比较怪异的头像风格
    const getAvatar = (seed) => `https://api.dicebear.com/7.x/micah/svg?seed=${seed}&baseColor=f9c9b6&hairColor=000000,363636&mouth=pucker,smile,smirk&eyes=eyes,round,smiling`;

    try {
        document.getElementById('my-id-display').innerText = `ID: ${MY_ID}`;
        document.getElementById('card-id-text').innerText = MY_ID;
        document.getElementById('my-avatar-small').src = getAvatar(MY_ID);
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 80, height: 80, colorDark: "#000000", colorLight: "#ffffff" });
    } catch(e){}

    renderFriends();

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        friends.forEach(id => {
            const isOnline = connections[id] && connections[id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="${getAvatar(id)}" class="avatar-img"></div>
                <div class="item-content">
                    <div class="item-title">${id}</div>
                    <div class="status-text">${isOnline ? 'Online (Coping)' : 'Offline (Sleeping)'}</div>
                </div>
            `;
            div.onclick = () => openChat(id);
            list.appendChild(div);
        });
    }

    function addFriend(id) {
        if(!friends.includes(id)) {
            friends.push(id);
            localStorage.setItem('wojak_frens', JSON.stringify(friends));
            renderFriends();
        }
    }

    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('messages-container').innerHTML = '';
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }

    // 消息发送
    const msgContainer = document.getElementById('messages-container');
    const chatInput = document.getElementById('chat-input');
    const sound = document.getElementById('msg-sound');

    function sendText() {
        const txt = chatInput.value.trim();
        if(txt && activeChatId && connections[activeChatId]) {
            connections[activeChatId].send({ type: 'text', content: txt });
            appendMsg(txt, true);
            chatInput.value = '';
        }
    }
    document.getElementById('chat-send-btn').onclick = sendText;
    chatInput.onkeypress = (e) => { if(e.key==='Enter') sendText(); };

    function appendMsg(txt, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble">${txt}</div>`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function handleData(id, data) {
        if(activeChatId !== id) { sound.play().catch(()=>{}); return; }
        if(data.type === 'text') appendMsg(data.content, false);
        else if(data.type === 'sticker') appendSticker(data.url, false);
    }

    // Wojak 表情包定义 (使用公共图床的透明PNG)
    const wojakStickers = [
        'https://i.imgur.com/9Y9w4fU.png', // Crying
        'https://i.imgur.com/8QQzY7d.png', // Angry/Seething
        'https://i.imgur.com/tXX9X9Y.png', // Doomer smoke
        'https://i.imgur.com/0QQzY7d.png', // Happy/Troll
        'https://i.imgur.com/5QQzY7d.png', // Soyjak point
        'https://i.imgur.com/3QQzY7d.png', // Pink wojak screaming
        'https://i.imgur.com/2QQzY7d.png', // Clown
        'https://i.imgur.com/1QQzY7d.png'  // Brainlet
    ];

    const stickerGrid = document.getElementById('sticker-grid');
    wojakStickers.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'sticker-item sticker-img';
        // 如果图片加载失败，用一个占位符代替，防止丑陋的破图图标
        img.onerror = function() { this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23ccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Wojak 404</text></svg>'; };
        img.onclick = () => {
            if(activeChatId && connections[activeChatId]) {
                connections[activeChatId].send({type:'sticker', url:url});
                appendSticker(url, true);
                document.getElementById('sticker-panel').style.display = 'none';
            }
        };
        stickerGrid.appendChild(img);
    });

    function appendSticker(url, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<img src="${url}" class="sticker-img">`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // PeerJS 启动
    try {
        peer = new Peer(MY_ID);
        peer.on('open', () => friends.forEach(connectTo));
        peer.on('connection', setupConn);
    } catch(e){ console.log('Network Error'); }

    function connectTo(id) {
        if(id === MY_ID) return;
        const conn = peer.connect(id);
        setupConn(conn);
    }

    function setupConn(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            addFriend(conn.peer);
            renderFriends();
            if(activeChatId === conn.peer) document.getElementById('chat-status-dot').className = 'status-square online';
        });
        conn.on('data', d => handleData(conn.peer, d));
        conn.on('close', () => {
             if(activeChatId === conn.peer) document.getElementById('chat-status-dot').className = 'status-square';
             renderFriends();
        });
    }

    document.body.onclick = () => sound.load();
});